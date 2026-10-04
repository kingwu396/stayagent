"""Agent API 的 Pydantic schemas (请求/响应)"""
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, ConfigDict


# ============ 请求 ============

class AgentChatRequest(BaseModel):
    """用户发一条消息给 Agent"""
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = Field(
        default=None,
        description="续接的对话 ID, None=新建对话",
    )


class ToolConfirmRequest(BaseModel):
    """Block 11 用的 HITL 确认请求 (Block 9 预留, 不触发)"""
    run_id: int
    approved: bool


# ============ 响应 ============

class AgentStepResponse(BaseModel):
    step_index: int
    tool_name: str | None = None
    tool_args: dict | None = None
    tool_result: dict | None = None
    tool_error: str | None = None
    reasoning: str | None = None
    duration_ms: int | None = None

    model_config = ConfigDict(from_attributes=True)


class AgentChatResponse(BaseModel):
    run_id: int
    conversation_id: int
    status: str  # running/pending_confirmation/completed/failed/timeout
    content: str | None = None
    error: str | None = None
    steps: list[AgentStepResponse] = []
    prompt_tokens: int = 0
    completion_tokens: int = 0


class PendingConfirmationResponse(BaseModel):
    """Block 11 用的 HITL 响应 (Block 9 预留)"""
    run_id: int
    pending_tool_call: dict


# ============ 对话管理 (Block 10 UI 用) ============

class ConversationSummary(BaseModel):
    id: int
    title: str | None
    created_at: datetime
    updated_at: datetime
    run_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AgentRunResponse(BaseModel):
    id: int
    conversation_id: int
    user_message: str
    status: str
    final_content: str | None
    error: str | None
    prompt_tokens: int
    completion_tokens: int
    started_at: datetime
    finished_at: datetime | None
    steps: list[AgentStepResponse] = []

    model_config = ConfigDict(from_attributes=True)
