"""Agent API: /api/agent/chat + 对话/Run 管理

Block 9 范围:
- POST /api/agent/chat: 跑一次 agent 调用循环, 返回最终结果
- GET /api/agent/conversations: 用户的对话列表 (含 run count)
- GET /api/agent/conversations/{cid}/runs: 某对话的所有 run + steps

Block 10+ 才接 SSE 流式 + AgentPanel UI.
"""
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DBSession
from app.models import Conversation, AgentRun, AgentStep
from app.schemas.agent import (
    AgentChatRequest,
    AgentChatResponse,
    AgentStepResponse,
    AgentRunResponse,
    ConversationSummary,
)
from app.services.agent.orchestrator import run_agent

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
