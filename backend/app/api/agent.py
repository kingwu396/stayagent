"""Agent API: /api/agent/chat + 对话/Run 管理 + SSE 流式 (Block 10)

Block 9 范围:
- POST /api/agent/chat: 跑一次 agent 调用循环, 返回最终结果
- GET /api/agent/conversations: 用户的对话列表 (含 run count)
- GET /api/agent/conversations/{cid}/runs: 某对话的所有 run + steps

Block 10+ 才接 SSE 流式 + AgentPanel UI.
"""
import asyncio
import logging
from datetime import timedelta

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DBSession
from app.models import Conversation, AgentRun, AgentStep, Message
from app.services.agent.orchestrator import run_agent, _utcnow
from app.schemas.agent import (
    AgentChatRequest,
    AgentChatResponse,
    AgentStepResponse,
    AgentRunResponse,
    ConversationSummary,
    ToolConfirmRequest,
)
from app.services.agent.orchestrator import run_agent
from app.services.agent.tools import TOOL_DISPATCH, ToolError

logger = logging.getLogger(__name__)
router = APIRouter()


def _step_to_response(s: AgentStep) -> AgentStepResponse:
    return AgentStepResponse(
        step_index=s.step_index,
        tool_name=s.tool_name,
        tool_args=s.tool_args,
        tool_result=s.tool_result,
        tool_error=s.tool_error,
        reasoning=s.reasoning,
        duration_ms=s.duration_ms,
    )


@router.post("/chat", response_model=AgentChatResponse)
async def chat(
    payload: AgentChatRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """发一条消息给 Agent, 返回最终回复 + step 轨迹"""
    run = await run_agent(
        db=db,
        user=current_user,
        user_message=payload.message,
        conversation_id=payload.conversation_id,
        attachment=payload.attachment,
    )
    return AgentChatResponse(
        run_id=run.id,
        conversation_id=run.conversation_id,
        status=run.status,
        content=run.final_content,
        error=run.error,
        steps=[_step_to_response(s) for s in run.steps],
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
    )


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: CurrentUser,
    db: DBSession,
):
    """当前用户的所有对话 (含 run count)"""
    rows = db.execute(
        select(
            Conversation,
            func.count(AgentRun.id).label("run_count"),
        )
        .outerjoin(AgentRun, AgentRun.conversation_id == Conversation.id)
        .where(Conversation.user_id == current_user.id)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    out = []
    for conv, run_count in rows:
        out.append(ConversationSummary(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            run_count=run_count,
        ))
    return out


@router.get("/conversations/{conversation_id}/runs", response_model=list[AgentRunResponse])
async def list_runs(
    conversation_id: int,
    current_user: CurrentUser,
    db: DBSession,
):
    """某对话的所有 run (含 steps)"""
    # 校验对话归属
    conv = db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="对话不存在")

    rows = db.execute(
        select(AgentRun)
        .where(AgentRun.conversation_id == conversation_id)
        .options(selectinload(AgentRun.steps))
        .order_by(AgentRun.started_at.asc())
    ).scalars().all()

    # Block 22: 惰性清理僵尸 run —— running 超过 15 分钟视为服务器中断
    # (正常流要么几秒内完结, 要么断连时已被 persist_cancelled 标记)
    stale_cutoff = _utcnow() - timedelta(minutes=15)
    stale_runs = [r for r in rows if r.status == "running" and r.started_at and r.started_at < stale_cutoff]
    if stale_runs:
        for r in stale_runs:
            r.status = "failed"
            r.error = "服务器中断"
            r.finished_at = _utcnow()
        db.commit()

    return [
        AgentRunResponse(
            id=r.id,
            conversation_id=r.conversation_id,
            user_message=r.user_message,
            status=r.status,
            final_content=r.final_content,
            error=r.error,
            prompt_tokens=r.prompt_tokens,
            completion_tokens=r.completion_tokens,
            started_at=r.started_at,
            finished_at=r.finished_at,
            steps=[_step_to_response(s) for s in (r.steps or [])],
        )
        for r in rows
    ]


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    current_user: CurrentUser,
    db: DBSession,
):
    """删除当前用户的某个对话 (级联删除其下所有 AgentRun / AgentStep / Message).

    404 如果不存在或非本人所有 (不区分, 防枚举)。
    """
    conv = db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=404, detail="对话不存在")

    # Conversation → AgentRun (CASCADE) → AgentStep (CASCADE)
    # Message (看 Conversation 模型定义; 多数情况 CASCADE) 自动清理
    db.delete(conv)
    db.commit()
    return None


# ============ Block 11.5: HITL /confirm 端点 ============

@router.post("/runs/{run_id}/confirm", response_model=AgentRunResponse)
async def confirm_run(
    run_id: int,
    payload: ToolConfirmRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Human-in-the-loop 确认/拒绝 create_booking.

    - approved=True: 执行待确认的 tool_call, 写入 final_content, status='completed'
    - approved=False: 写入一条拒绝 step, status='cancelled', final_content="已取消"
    """
    if payload.run_id != run_id:
        raise HTTPException(status_code=400, detail="URL run_id 与 body.run_id 不一致")

    # 1. 加载 run (含 steps), 校验归属
    run = db.execute(
        select(AgentRun)
        .where(AgentRun.id == run_id)
        .options(selectinload(AgentRun.steps))
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="AgentRun 不存在")
    if run.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作此 AgentRun")
    if run.status != "pending_confirmation":
        raise HTTPException(
            status_code=409,
            detail=f"AgentRun 当前状态为 {run.status}, 不允许确认 (需要 pending_confirmation)",
        )
    if not run.pending_tool_call:
        raise HTTPException(
            status_code=500,
            detail="AgentRun.pending_tool_call 为空, 数据异常",
        )

    tool_name = run.pending_tool_call.get("tool_name")
    tool_args = run.pending_tool_call.get("tool_args") or {}
    tool_fn = TOOL_DISPATCH.get(tool_name or "")

    # 找最初的 create_booking step (用来更新 duration_ms / step_index)
    pending_step = next(
        (s for s in run.steps if s.tool_name == tool_name),
        None,
    )
    next_step_index = (pending_step.step_index + 1) if pending_step else (len(run.steps))

    if payload.approved:
        # 2. 执行 create_booking
        try:
            result = tool_fn(user=current_user, db=db, **tool_args)
        except ToolError as e:
            # 业务错误: 把错误回写到 run, 让用户知道为什么失败
            run.status = "failed"
            run.error = f"{e.code}: {e}"
            from datetime import datetime, timezone
            run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            db.refresh(run)
            return _run_to_response(run)

        # 写一条新 step (result)
        confirm_step = AgentStep(
            run_id=run.id,
            step_index=next_step_index,
            tool_name=tool_name,
            tool_args=tool_args,
            tool_call_id=None,
            tool_calls=None,
            tool_result=result,
            tool_error=None,
            reasoning="用户已确认",
            duration_ms=0,
        )
        db.add(confirm_step)

        # 3. 写 final_content (中文 Markdown)
        run.final_content = _format_booking_confirmed(result)
        run.status = "completed"
        from datetime import datetime, timezone
        run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
        run.pending_tool_call = None

        # 4. 写 assistant Message 到 Conversation
        db.add(Message(
            conversation_id=run.conversation_id,
            role="assistant",
            content=run.final_content,
        ))

        db.commit()
        db.refresh(run)
        logger.info("AgentRun #%d HITL approved: booking #%d", run.id, result.get("booking_id"))
    else:
        # 用户拒绝: 写拒绝 step + final_content
        reject_step = AgentStep(
            run_id=run.id,
            step_index=next_step_index,
            tool_name=tool_name,
            tool_args={"approved": False},
            tool_call_id=None,
            tool_calls=None,
            tool_result=None,
            tool_error="USER_REJECTED",
            reasoning="用户已取消下单",
            duration_ms=0,
        )
        db.add(reject_step)
        run.final_content = "好的, 已取消下单。如需查看其它房源, 随时问我 🙌"
        run.status = "cancelled"
        from datetime import datetime, timezone
        run.finished_at = datetime.now(timezone.utc).replace(tzinfo=None)
        run.pending_tool_call = None
        db.add(Message(
            conversation_id=run.conversation_id,
            role="assistant",
            content=run.final_content,
        ))
        db.commit()
        db.refresh(run)
        logger.info("AgentRun #%d HITL rejected by user", run.id)

    # 重载 steps (含新加的 confirm/reject step)
    db.refresh(run)

    return AgentRunResponse(
        id=run.id,
        conversation_id=run.conversation_id,
        user_message=run.user_message,
        status=run.status,
        final_content=run.final_content,
        error=run.error,
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
        started_at=run.started_at,
        finished_at=run.finished_at,
        steps=[_step_to_response(s) for s in (run.steps or [])],
    )


def _format_booking_confirmed(result: dict) -> str:
    """把 create_booking 的 tool_result 渲染成用户友好的 Markdown 总结."""
    listing_title = result.get("listing_title") or f"房源 #{result.get('listing_id')}"
    check_in = result.get("check_in", "")
    check_out = result.get("check_out", "")
    guests = result.get("guests", 1)
    nights = result.get("nights", 1)
    total = result.get("total", 0)
    booking_id = result.get("booking_id", "?")
    return (
        f"🧾 订单已创建, **#{booking_id}**(待支付)\n\n"
        f"- 房源: {listing_title}\n"
        f"- 入住: {check_in} → {check_out} ({nights} 晚)\n"
        f"- 人数: {guests} 位\n"
        f"- **应付: ¥{total}**\n\n"
        f"请在 **15 分钟内** 到 [行程页](/trips) 完成支付, 超时订单自动取消。支付成功祝入住愉快!"
    )


def _run_to_response(run: AgentRun) -> AgentRunResponse:
    return AgentRunResponse(
        id=run.id,
        conversation_id=run.conversation_id,
        user_message=run.user_message,
        status=run.status,
        final_content=run.final_content,
        error=run.error,
        prompt_tokens=run.prompt_tokens,
        completion_tokens=run.completion_tokens,
        started_at=run.started_at,
        finished_at=run.finished_at,
        steps=[_step_to_response(s) for s in (run.steps or [])],
    )


import asyncio
import json
import logging
from fastapi.responses import StreamingResponse

from app.services.agent.orchestrator import stream_agent as _stream_agent


@router.post("/chat/stream")
async def chat_stream(
    payload: AgentChatRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    SSE 流式 agent chat (Block 10). 实时推 step 事件.

    Events:
      - run_started:    {run_id, conversation_id}
      - step_started:   {step_index, tool_name, tool_args, reasoning}
      - step_completed: {step_index, tool_result, tool_error, duration_ms}
      - final:          {run_id, conversation_id, status, content, prompt_tokens, completion_tokens}
      - error:          {message}
      - done:           {}
    """
    async def event_gen():
        try:
            async for evt in _stream_agent(
                db=db,
                user=current_user,
                user_message=payload.message,
                conversation_id=payload.conversation_id,
                attachment=payload.attachment,
            ):
                evt_type = evt.get("type", "message")
                payload_json = json.dumps(evt, ensure_ascii=False)
                yield f"event: {evt_type}\ndata: {payload_json}\n\n"
        except asyncio.CancelledError:
            logger.info("SSE stream aborted by client")
            raise
        except Exception as e:
            logger.exception("SSE stream error")
            err = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"event: error\ndata: {err}\n\n"
        finally:
            yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
