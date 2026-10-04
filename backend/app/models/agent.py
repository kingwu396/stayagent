"""AgentRun + AgentStep 模型: 单轮运行状态 + tool 调用轨迹 (A4/A5 加分项)

设计:
- AgentRun: 一次 user message 触发的一次 agent 运行
- AgentStep: 该 run 中的一个 step (LLM 调用一次, 或一次 tool 执行)
- status='pending_confirmation' 为 Human-in-the-loop 预留 (Block 9 不触发, Block 11 加)
"""
from datetime import datetime
from sqlalchemy import (
    BigInteger, Integer, String, Text, DateTime, Enum, JSON, ForeignKey,
    UniqueConstraint, Index, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    user_message: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        Enum(
            "running", "pending_confirmation", "completed", "failed", "timeout",
            name="agent_run_status_enum",
        ),
        nullable=False,
        default="running",
    )

    # Human-in-the-loop 用, 当 status='pending_confirmation' 时存 tool_call
    pending_tool_call: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # 最终回复 (status='completed' 时)
    final_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 失败信息
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # LLM 用量统计
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    conversation: Mapped["Conversation"] = relationship(back_populates="runs")
    steps: Mapped[list["AgentStep"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AgentStep.step_index",
    )

    __table_args__ = (
        Index("idx_conv_started", "conversation_id", "started_at"),
        Index("idx_user_status", "user_id", "status"),
    )

    def __repr__(self) -> str:
        return f"<AgentRun id={self.id} conv={self.conversation_id} status={self.status}>"


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)

    tool_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_args: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tool_call_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_calls: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # 原始 tool_calls 数组

    # tool 执行结果
    tool_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tool_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # LLM 思考内容 (assistant 的 content)
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    run: Mapped["AgentRun"] = relationship(back_populates="steps")

    __table_args__ = (
        UniqueConstraint("run_id", "step_index", name="uk_run_step"),
        Index("idx_run", "run_id"),
    )

    def __repr__(self) -> str:
        return f"<AgentStep id={self.id} run={self.run_id} idx={self.step_index} tool={self.tool_name}>"
