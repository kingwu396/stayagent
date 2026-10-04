"""Agent Orchestrator: 手写 tool calling 循环

依据: docs/project-charter.md §6.4 伪代码
设计:
1. 创建/加载 conversation + 插入 user message
2. 创建 AgentRun (status=running)
3. 加载历史 + 拼装 messages (system + 历史 + 当前 user)
4. Loop max 8 步:
   - 调 LLM (with tools), tenacity 重试
   - if tool_calls → 执行 tool → 记录 step → 拼装 tool result → continue
   - else → final answer → break
5. 写 status=completed/failed/timeout
6. 每次 step 立即 commit (断网不丢进度)

约定:
- Tool 函数是 sync, 直接调用无需 await
- ToolError 转成 {"error": ..., "code": ...} 喂给 LLM, 让它自己处理
- HITL (create_booking 触发 pending_confirmation) Block 9 不实现 (Block 11)
"""
import json
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.llm_client import get_llm_client
from app.models import User, Conversation, Message, AgentRun, AgentStep
from app.services.agent.prompts import SYSTEM_PROMPT
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS
from app.services.agent.retry import retry_on_llm_error
from app.services.agent.tools import TOOL_DISPATCH, ToolError

logger = logging.getLogger(__name__)

MAX_STEPS = 8
HISTORY_LIMIT = 20


def _utcnow() -> datetime:
    """naive UTC datetime (SQLAlchemy DateTime 不带 tz)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_or_create_conversation(db, user: User, conversation_id: int | None) -> Conversation:
    """加载已有 conversation (校验归属), 否则新建"""
    if conversation_id is not None:
        conv = db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user.id,
            )
        ).scalar_one_or_none()
        if conv is not None:
            return conv
    conv = Conversation(user_id=user.id, title=None)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _load_history(db, conversation_id: int, limit: int = HISTORY_LIMIT) -> list[dict]:
    """从 DB 加载历史 user/assistant 消息, 转 OpenAI 格式.
    Block 9 简化: 不存 tool result message 到 DB (避免对话历史过长),
    仅存 user + final assistant content. 多轮上下文靠最近几轮的 summary.
    """
    rows = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.role.in_(("user", "assistant")))
        .order_by(Message.created_at.desc())
        .limit(limit)
    ).scalars().all()
    rows = list(reversed(rows))

    out: list[dict] = []
    for m in rows:
        if m.role == "user":
            out.append({"role": "user", "content": m.content or ""})
        elif m.role == "assistant":
            # 只存最终回复 (无 tool_calls), 这里都满足
            out.append({"role": "assistant", "content": m.content or ""})
    return out


async def run_agent(
    db,
    user: User,
    user_message: str,
    conversation_id: int | None = None,
) -> AgentRun:
    """主入口: 跑一次 agent 调用循环, 返回 AgentRun (DB row)

    Args:
        db: SQLAlchemy Session
        user: 当前用户 (CurrentUser 依赖)
        user_message: 用户消息
        conversation_id: None = 新建对话, 否则续接
    """
    # 1. Conversation + user message
    conv = _get_or_create_conversation(db, user, conversation_id)
    db.add(Message(conversation_id=conv.id, role="user", content=user_message))
    db.commit()

    # 2. AgentRun
    run = AgentRun(
        conversation_id=conv.id,
        user_id=user.id,
        user_message=user_message,
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    logger.info("AgentRun #%d started (conv=%d user=%d)", run.id, conv.id, user.id)

    # 3. 拼装 messages: system + 历史 (不含刚 insert 的 user) + 当前 user
    history = _load_history(db, conv.id)
    # 去掉 history 末尾的 user (如果它就是 user_message, 避免重复)
    if history and history[-1].get("role") == "user" and history[-1].get("content") == user_message:
        history = history[:-1]
    messages: list[dict] = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": user_message}]
    )

    # 4. Loop
    client = get_llm_client()

    for step_idx in range(MAX_STEPS):
        t0 = time.monotonic()
        try:
            resp = await retry_on_llm_error(client.chat)(
                messages=messages,
                tools=ALL_TOOL_SCHEMAS,
            )
        except Exception as e:
            logger.exception("LLM call failed (after retries)")
            run.status = "failed"
            run.error = f"LLM 调用失败: {type(e).__name__}: {e}"
            run.finished_at = _utcnow()
            db.commit()
            return run

        # 累加 token
        usage = resp.get("usage") or {}
        run.prompt_tokens += int(usage.get("prompt_tokens", 0))
        run.completion_tokens += int(usage.get("completion_tokens", 0))

        msg = resp["choices"][0]["message"]
        finish_reason = resp["choices"][0].get("finish_reason")
        tool_calls = msg.get("tool_calls")

        # Final answer
        if not tool_calls or finish_reason == "stop":
            run.final_content = msg.get("content") or ""
            run.status = "completed"
            run.finished_at = _utcnow()
            db.add(Message(
                conversation_id=conv.id,
                role="assistant",
                content=run.final_content,
            ))
            db.commit()
            logger.info(
                "AgentRun #%d completed (steps=%d, tokens=%d/%d)",
                run.id, step_idx + 1, run.prompt_tokens, run.completion_tokens,
            )
            return run

        # 有 tool_calls → 执行第一个 tool (LLM 通常一次一个 tool_call)
        first_tc = tool_calls[0]
        tool_name = first_tc["function"]["name"]
        try:
            tool_args = json.loads(first_tc["function"]["arguments"])
        except json.JSONDecodeError:
            tool_args = {}

        step = AgentStep(
            run_id=run.id,
            step_index=step_idx,
            tool_name=tool_name,
            tool_args=tool_args,
            tool_call_id=first_tc["id"],
            tool_calls=tool_calls,  # 原始数组
            reasoning=msg.get("content"),  # LLM 的思考文本
        )
        db.add(step)
        db.commit()
        db.refresh(step)

        # 把 LLM 的 assistant 消息 (含 tool_calls) 加进 messages
        messages.append({
            "role": "assistant",
            "content": msg.get("content") or "",
            "tool_calls": tool_calls,
        })

        # 执行每个 tool_call, 喂回 LLM
        any_error = False
        for tc in tool_calls:
            name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                args = {}

            try:
                tool_fn = TOOL_DISPATCH.get(name)
                if tool_fn is None:
                    result = {"error": f"未知 tool: {name}", "code": "UNKNOWN_TOOL"}
                else:
                    result = tool_fn(user=user, db=db, **args)
            except ToolError as e:
                logger.warning("Tool %s 业务错误: %s", name, e)
                result = {"error": str(e), "code": e.code}
                any_error = True
            except Exception as e:
                logger.exception("Tool %s 执行失败", name)
                result = {
                    "error": f"内部错误: {type(e).__name__}: {e}",
                    "code": "INTERNAL_ERROR",
                }
                any_error = True

            # 保存到 step (简化: 只记第一个 tool_call 的 result/error)
            if tc is first_tc:
                if "error" in result:
                    step.tool_error = result["error"]
                else:
                    step.tool_result = result

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result, ensure_ascii=False),
            })

        step.duration_ms = int((time.monotonic() - t0) * 1000)
        db.commit()

    # 超时: 8 步没收敛
    logger.warning("AgentRun #%d timeout (max %d steps)", run.id, MAX_STEPS)
    run.status = "timeout"
    run.finished_at = _utcnow()
    db.commit()
    return run


async def get_conversation_history(db, conversation_id: int, user: User) -> list[dict]:
    """供 /api/agent/conversations/{id}/runs 用: 加载某对话的所有 run + steps"""
    conv = db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    ).scalar_one_or_none()
    if conv is None:
        return []
    return _load_history(db, conv.id, limit=50)
