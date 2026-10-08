"""Agent Orchestrator: 手写 tool calling 循环

依据: docs/project-charter.md §6.4 伪代码
Block 10 新增 stream_agent() (async generator) 用于 SSE 流式.

设计:
1. 创建/加载 conversation + 插入 user message
2. 创建 AgentRun (status=running)
3. 加载历史 + 拼装 messages (system + 历史 + 当前 user)
4. Loop max 8 步: _execute_step() 跑一轮 LLM + tool
5. _execute_step 返回 event list (step_started / step_completed / final / error)
6. run_agent 收集 events 后返回完整 run; stream_agent 同步 yield events

约定:
- Tool 函数是 sync, 直接调用无需 await
- ToolError 转成 {"error": ..., "code": ...} 喂给 LLM, 让它自己处理
- HITL (create_booking 触发 pending_confirmation) Block 9 不实现 (Block 11)
"""
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import AsyncGenerator

from sqlalchemy import select

from app.core.llm_client import get_llm_client
from app.models import User, Conversation, Message, AgentRun, AgentStep
from app.services.agent.prompts import SYSTEM_PROMPT
from app.services.agent.tool_schemas import ALL_TOOL_SCHEMAS
from app.services.agent.retry import retry_on_llm_error
from app.services.agent.tools import TOOL_DISPATCH, ToolError
from app.schemas.agent import AttachmentPayload

logger = logging.getLogger(__name__)

MAX_STEPS = 8
HISTORY_LIMIT = 20


# ============ 公共 helper ============

def _utcnow() -> datetime:
    """naive UTC datetime (SQLAlchemy DateTime 不带 tz)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_or_create_conversation(
    db, user: User, conversation_id: int | None, first_message: str | None = None
) -> Conversation:
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
    # Block 22: 会话标题 = 首条用户消息前 24 字 (列表页立即可读)
    title = first_message.strip().replace("\n", " ")[:24] if first_message else None
    conv = Conversation(user_id=user.id, title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _persist_cancelled(db, run: AgentRun, conv_id: int, partial_content: str) -> None:
    """Block 22: 客户端断连 (切走/关页/断网) 时, 保留已生成的部分内容并明确标记 cancelled"""
    if run.status != "running":
        return  # pending_confirmation / 已完结的 run 不动
    try:
        run.status = "cancelled"
        run.finished_at = _utcnow()
        if partial_content:
            run.final_content = partial_content
            db.add(Message(conversation_id=conv_id, role="assistant", content=partial_content))
        db.commit()
        logger.info("Run %s persisted as cancelled with %d chars partial", run.id, len(partial_content))
    except Exception:
        logger.exception("Failed to persist cancelled run %s", run.id)
        db.rollback()


def _load_history(db, conversation_id: int, limit: int = HISTORY_LIMIT) -> list[dict]:
    """从 DB 加载历史 user/assistant 消息, 转 OpenAI 格式."""
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
            out.append({"role": "assistant", "content": m.content or ""})
    return out




def _augment_user_message_with_attachment(user_message: str, attachment: AttachmentPayload | None) -> str:
    """Block 12 fix: 把附件 text 注入 LLM 上下文, 但不污染 user_message (DB 存的还是纯文字).

    LLM 看到的格式:
        [用户消息]

        [附件: filename.pdf, 7 页, 1234 字]
        ```
        <PDF text>
        ```
    """
    if attachment is None:
        return user_message
    return (
        f"{user_message}\n\n"
        f"[附件: {attachment.filename}, {attachment.page_count} 页, {attachment.char_count} 字]\n"
        f"```\n{attachment.text}\n```"
    )

def _build_messages(db, user: User, run_message: str, conversation_id: int) -> list[dict]:
    """拼装 messages: system + 历史 (不含刚 insert 的 user) + 当前 user"""
    history = _load_history(db, conversation_id)
    if history and history[-1].get("role") == "user" and history[-1].get("content") == run_message:
        history = history[:-1]
    return (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": run_message}]
    )


def _persist_final(db, run: AgentRun, conv_id: int, content: str, status: str = "completed") -> None:
    """写最终回复 + 更新 status"""
    run.final_content = content
    run.status = status
    run.finished_at = _utcnow()
    db.add(Message(conversation_id=conv_id, role="assistant", content=content))
    db.commit()


# ============ 核心 step executor (run_agent + stream_agent 复用) ============

async def _execute_step(
    db,
    user: User,
    messages: list[dict],
    run: AgentRun,
    step_idx: int,
) -> list[dict]:
    """
    跑一轮 LLM + tool 调用, 返回 events list.

    Returns (one of):
        [{"type": "final", "content": str}]  # LLM 返回 final answer
        [{"type": "error", "message": str}]  # LLM 调用失败
        [{"type": "step_started", ...}, {"type": "step_completed", ...}]  # 正常 tool 执行
    """
    events: list[dict] = []
    t0 = time.monotonic()

    try:
        resp = await retry_on_llm_error(get_llm_client().chat)(
            messages=messages,
            tools=ALL_TOOL_SCHEMAS,
        )
    except Exception as e:
        logger.exception("LLM call failed (after retries)")
        return [{"type": "error", "message": f"{type(e).__name__}: {e}"}]

    # 累加 token
    usage = resp.get("usage") or {}
    run.prompt_tokens += int(usage.get("prompt_tokens", 0))
    run.completion_tokens += int(usage.get("completion_tokens", 0))

    msg = resp["choices"][0]["message"]
    finish_reason = resp["choices"][0].get("finish_reason")
    tool_calls = msg.get("tool_calls")

    # Final answer
    if not tool_calls or finish_reason == "stop":
        return [{"type": "final", "content": msg.get("content") or "", "msg": msg}]

    # Tool execution
    first_tc = tool_calls[0]
    tool_name = first_tc["function"]["name"]
    try:
        tool_args = json.loads(first_tc["function"]["arguments"])
    except json.JSONDecodeError:
        tool_args = {}

    # ============ HITL 拦截: create_booking 需要用户确认 ============
    # 不调 LO, 先记 step + 设 run.status='pending_confirmation'
    if tool_name == "create_booking":
        step = AgentStep(
            run_id=run.id,
            step_index=step_idx,
            tool_name=tool_name,
            tool_args=tool_args,
            tool_call_id=first_tc["id"],
            tool_calls=tool_calls,
            reasoning=msg.get("content"),
        )
        db.add(step)
        db.commit()
        db.refresh(step)
        step.duration_ms = int((time.monotonic() - t0) * 1000)

        run.status = "pending_confirmation"
        run.pending_tool_call = {"tool_name": tool_name, "tool_args": tool_args}
        run.finished_at = _utcnow()
        db.commit()

        logger.info(
            "AgentRun #%d HITL pending_confirmation: %s(%s)",
            run.id, tool_name, tool_args,
        )

        # step_started 让前端展示「即将下单」, pending_confirmation 触发确认 UI
        events.append({
            "type": "step_started",
            "step_index": step.step_index,
            "tool_name": tool_name,
            "tool_args": tool_args,
            "reasoning": msg.get("content"),
        })
        events.append({
            "type": "step_completed",
            "step_index": step.step_index,
            "tool_result": None,
            "tool_error": "pending_confirmation",
            "duration_ms": step.duration_ms,
        })
        events.append({
            "type": "pending_confirmation",
            "run_id": run.id,
            "step_index": step.step_index,
            "tool_name": tool_name,
            "tool_args": tool_args,
        })
        return events

    step = AgentStep(
        run_id=run.id,
        step_index=step_idx,
        tool_name=tool_name,
        tool_args=tool_args,
        tool_call_id=first_tc["id"],
        tool_calls=tool_calls,
        reasoning=msg.get("content"),
    )
    db.add(step)
    db.commit()
    db.refresh(step)

    # 先 push step_started (前端立即看到 tool 名)
    events.append({
        "type": "step_started",
        "step_index": step.step_index,
        "tool_name": tool_name,
        "tool_args": tool_args,
        "reasoning": msg.get("content"),
    })

    # assistant 消息 (含 tool_calls) 加进 messages
    messages.append({
        "role": "assistant",
        "content": msg.get("content") or "",
        "tool_calls": tool_calls,
    })

    # 执行每个 tool_call, 把结果喂回 LLM
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
        except Exception as e:
            logger.exception("Tool %s 执行失败", name)
            result = {
                "error": f"内部错误: {type(e).__name__}: {e}",
                "code": "INTERNAL_ERROR",
            }

        # 只记第一个 tool_call 的 result/error 到 step
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

    events.append({
        "type": "step_completed",
        "step_index": step.step_index,
        "tool_result": step.tool_result,
        "tool_error": step.tool_error,
        "duration_ms": step.duration_ms,
    })
    return events


# ============ Sync API (Block 9) ============

async def run_agent(
    db,
    user: User,
    user_message: str,
    conversation_id: int | None = None,
    attachment: AttachmentPayload | None = None,
) -> AgentRun:
    """
    同步版: 跑一次 agent 调用循环, 返回完整 AgentRun (DB row).
    内部步骤通过 _execute_step() 共享 stream_agent 逻辑.

    Block 12: attachment 注入 LLM 上下文, 但 DB user_message 只存纯文字.
    """
    # 1. Conversation + user message (DB 只存纯文字)
    conv = _get_or_create_conversation(db, user, conversation_id, user_message)
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
    conv.updated_at = _utcnow()
    db.commit()
    logger.info(
        "AgentRun #%d started (conv=%d user=%d, has_attachment=%s)",
        run.id, conv.id, user.id, attachment is not None,
    )

    # 3. Messages: LLM 上下文 augment 附件
    llm_user_message = _augment_user_message_with_attachment(user_message, attachment)
    messages = _build_messages(db, user, llm_user_message, conv.id)

    # 4. Loop
    final_event = None
    pending_event = None
    for step_idx in range(MAX_STEPS):
        events = await _execute_step(db, user, messages, run, step_idx)
        # events: [{type, ...}] — 通常 [step_started, step_completed], 或 [final], 或 [error], 或 [pending_confirmation]
        for evt in events:
            if evt["type"] == "final":
                final_event = evt
                break
            if evt["type"] == "error":
                run.status = "failed"
                run.error = evt["message"]
                run.finished_at = _utcnow()
                db.commit()
                logger.warning("AgentRun #%d failed: %s", run.id, evt["message"])
                return run
            if evt["type"] == "pending_confirmation":
                pending_event = evt
                break
        if final_event is not None or pending_event is not None:
            break

    # 5. 处理 final / pending_confirmation / timeout
    if pending_event is not None:
        logger.info("AgentRun #%d paused (HITL pending_confirmation)", run.id)
        return run

    if final_event is not None:
        _persist_final(db, run, conv.id, final_event["content"], "completed")
        logger.info(
            "AgentRun #%d completed (steps=%d, tokens=%d/%d)",
            run.id, len(run.steps), run.prompt_tokens, run.completion_tokens,
        )
    else:
        # timeout
        run.status = "timeout"
        run.finished_at = _utcnow()
        db.commit()
        logger.warning("AgentRun #%d timeout (max %d steps)", run.id, MAX_STEPS)
    return run


# ============ Block 17: streaming 版 _execute_step (yield content_delta) ============

async def _execute_step_stream(
    db,
    user: User,
    messages: list[dict],
    run: AgentRun,
    step_idx: int,
) -> AsyncGenerator[dict, None]:
    """
    流式 LLM 调用. emit_content_delta=False 时把 LLM 的 content 累积起来,
    但不 yield content_delta events (用于避免 DeepSeek stream 模式的英文 hallucination preamble
    干扰用户体验; preamble 通常是 "I'll check..." 这种 LLM 套话).

    与 _execute_step() 行为一致, 唯一区别:
    - LLM final answer (no tool calls) 时按 token 切分, yield content_delta
    - 最后一个 content_delta 同时带 finish_reason
    - tool_calls 路径: emit_content_delta=True 也无害, 因为我们根据 finish_reason 决定走哪条路
    """
    """
    流式 LLM 调用. 每拿到一个 token 就 yield {"type": "content_delta", "delta": str}.

    与 _execute_step() 行为一致, 唯一区别:
    - LLM final answer (no tool calls) 时按 token 切分, yield content_delta
    - 最后一个 content_delta 同时带 finish_reason (type 切回 'final' 时使用)
    - tool_calls 路径保持原样 (LLM 流式返回整段 tool_calls args 也行, 但简化:
      我们只在 final-answer 路径用流式; tool-call 路径仍走非流式)
    """
    t0 = time.monotonic()

    try:
        resp_iter = get_llm_client().chat_stream(
            messages=messages,
            tools=ALL_TOOL_SCHEMAS,
        )
    except Exception as e:
        logger.exception("LLM stream init failed")
        yield {"type": "error", "message": f"{type(e).__name__}: {e}"}
        return

    # 累积 LLM 完整响应
    full_content = ""
    full_tool_calls: list[dict] = []
    finish_reason: str | None = None
    usage: dict = {}

    # 累积 LLM 完整响应

    # emit_content_delta=True 时逐 token yield (打字机效果, 用于 post-tool final)
    # emit_content_delta=False 时 buffer 不 yield, 用于 step_idx=0 第一次 LLM
    #   (DeepSeek stream 模式容易出英文 preamble, 不让它干扰)
    try:
        async for delta, fr in resp_iter:
            if delta:
                full_content += delta
                # Block 17 v3: 始终 live emit content_delta (打字机效果)
                yield {"type": "content_delta", "delta": delta}
            if fr:
                finish_reason = fr
    except Exception as e:
        logger.exception("LLM stream chunk failed")
        yield {"type": "error", "message": f"{type(e).__name__}: {e}"}
        return

    # DeepSeek stream 不会返回 usage; 退化为 0
    # 累加 token (虽然 stream 模式拿不到, 标记为 0)
    run.prompt_tokens += int(usage.get("prompt_tokens", 0))
    run.completion_tokens += int(usage.get("completion_tokens", 0))

    # ============ 处理最终响应 ============
    # 因为 streaming 模式拿不到 msg['tool_calls'] 的完整结构 (要等 finish),
    # 这里假设 DeepSeek 在 finish_reason='stop' 时是纯文本, 否则有 tool_calls.
    # 简化策略: 如果有 tool_calls 字段累积, 处理; 否则当 final text 处理.
    # 实际: DeepSeek 流式也会传 tool_calls 增量. 但要解析 tool_calls 增量很复杂.
    # 因此: 流式模式只用于纯文本 final answer; tool_calls 路径走非流式.
    # 判定 - 如果 full_content 看起来像完整 final text, 当 final 处理.
    # 否则回退到非流式 chat.
    # stream 模式下 LLM 经常先 emit "I'll check..." (英文套话), 再 emit finish_reason='tool_calls'.
    # 这是 preamble hallucination, 不是 final answer. fallback 到非流式 chat 让 _execute_step 走原路径.
    if finish_reason == "tool_calls":
        # 流式模式 LLM 在 emit preamble ("I'll check...") 后又决定调 tool.
        # preamble 不是 final answer, 让前端丢弃这段 content (保留 steps).
        yield {"type": "content_discard"}
        logger.info("Stream got finish_reason=tool_calls, fallback to non-stream _execute_step")
        events = await _execute_step(db, user, messages, run, step_idx)
        for evt in events:
            yield evt
        return

    if finish_reason == "stop" or (full_content != "" and not full_tool_calls and finish_reason is None):
        # 纯文本 final answer (content_delta 已在 live emit)
        yield {
            "type": "final",
            "content": full_content,
            "msg": {"role": "assistant", "content": full_content},
        }
        return

    # 其他情况 (含 tool_calls), 退回到非流式 chat 获取完整响应
    logger.info(
        "Stream path got finish_reason=%s, falling back to non-stream chat for tool_calls",
        finish_reason,
    )
    events = await _execute_step(db, user, messages, run, step_idx)
    for evt in events:
        yield evt


# ============ SSE Streaming API (Block 10) ============

async def stream_agent(
    db,
    user: User,
    user_message: str,
    conversation_id: int | None = None,
    attachment: AttachmentPayload | None = None,
) -> AsyncGenerator[dict, None]:
    """
    流式版: async generator, 每步 yield 一个 event dict.
    Event types:
      - run_started: {type, run_id, conversation_id}
      - step_started: {type, step_index, tool_name, tool_args, reasoning}
      - step_completed: {type, step_index, tool_result, tool_error, duration_ms}
      - final: {type, run_id, conversation_id, status, content, prompt_tokens, completion_tokens}
      - error: {type, message}
    """
    # 1. Conversation + user message
    conv = _get_or_create_conversation(db, user, conversation_id, user_message)
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

    # Block 22: 会话排序依赖 updated_at, 每条新 run 时前移
    conv.updated_at = _utcnow()
    db.commit()

    yield {
        "type": "run_started",
        "run_id": run.id,
        "conversation_id": conv.id,
    }

    # 3. Messages: LLM 上下文 augment 附件 (Block 12)
    llm_user_message = _augment_user_message_with_attachment(user_message, attachment)
    messages = _build_messages(db, user, llm_user_message, conv.id)

    # 4. Loop (Block 17: 使用 streaming LLM, 在 final answer 时 emit content_delta)
    final_event = None
    error_event = None
    pending_event = None
    final_delta_buf: list[str] = []
    try:
        for step_idx in range(MAX_STEPS):
            async for evt in _execute_step_stream(db, user, messages, run, step_idx):
                if evt["type"] == "content_delta":
                    # Block 17: 累积 final content 的 token, 同时 yield 给前端 (打字机效果)
                    final_delta_buf.append(evt["delta"])
                    yield evt
                elif evt["type"] == "content_discard":
                    # Block 17 v3: LLM 在 stream 里 emit 了英文 preamble 又决定调 tool.
                    # preamble 已传给前端 (打字机), 现在要丢弃. 清掉 buffer + 把事件透传给前端.
                    final_delta_buf = []
                    yield evt
                    continue
                elif evt["type"] == "final":
                    # 如果 streaming 路径已经累积了 tokens, 把它们填进 final.content
                    if final_delta_buf:
                        evt["content"] = "".join(final_delta_buf)
                        final_delta_buf = []
                    final_event = evt
                elif evt["type"] == "error":
                    error_event = evt
                elif evt["type"] == "pending_confirmation":
                    pending_event = evt
                else:
                    # step_started / step_completed
                    yield evt
            if final_event is not None or error_event is not None or pending_event is not None:
                break

        # 5. Final event
        if pending_event is not None:
            # HITL: 先 yield pending_confirmation, 再 yield final (status=pending_confirmation, content=None)
            yield pending_event
            yield {
                "type": "final",
                "run_id": run.id,
                "conversation_id": run.conversation_id,
                "status": "pending_confirmation",
                "content": None,
                "prompt_tokens": run.prompt_tokens,
                "completion_tokens": run.completion_tokens,
            }
            return

        if error_event is not None:
            run.status = "failed"
            run.error = error_event["message"]
            run.finished_at = _utcnow()
            db.commit()
            yield {"type": "error", "message": error_event["message"]}
            return

        if final_event is not None:
            _persist_final(db, run, conv.id, final_event["content"], "completed")
        else:
            run.status = "timeout"
            run.finished_at = _utcnow()
            db.commit()

        yield {
            "type": "final",
            "run_id": run.id,
            "conversation_id": run.conversation_id,
            "status": run.status,
            "content": run.final_content,
            "prompt_tokens": run.prompt_tokens,
            "completion_tokens": run.completion_tokens,
        }
    except (asyncio.CancelledError, GeneratorExit):
        # Block 22: 客户端断连 (切走会话/关页面/断网) —— 保留已生成的部分内容
        _persist_cancelled(db, run, conv.id, "".join(final_delta_buf))
        raise
    except Exception:
        # 非断连异常也明确落库, 不留僵尸 running
        try:
            run.status = "failed"
            run.error = run.error or "服务器内部异常"
            run.finished_at = _utcnow()
            db.commit()
        except Exception:
            db.rollback()
        raise


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
