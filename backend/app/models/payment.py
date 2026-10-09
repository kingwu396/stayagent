from datetime import datetime
from sqlalchemy import (
    BigInteger, DateTime, ForeignKey, DECIMAL, Enum, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Payment(Base):
    """Block 26: 模拟支付单 —— 一次预订一个支付单, 支付成功后 booking → confirmed"""
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[float] = mapped_column(DECIMAL(10, 2), nullable=False)

    method: Mapped[str] = mapped_column(
        Enum("alipay", "wechat", "card", name="payment_method_enum"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum("pending", "succeeded", "failed", name="payment_status_enum"),
        nullable=False, default="pending",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    booking: Mapped["Booking"] = relationship()  # noqa: F821

    __table_args__ = (
        Index("idx_payment_user", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Payment id={self.id} booking={self.booking_id} {self.method} {self.status}>"
