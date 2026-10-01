from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    BigInteger, Integer, String, Date, DateTime, ForeignKey,
    DECIMAL, Index, Enum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    listing_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("listings.id"), nullable=False
    )

    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    guests: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    nights: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    subtotal: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    cleaning_fee: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False, default=Decimal("0"))
    service_fee: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False, default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    status: Mapped[str] = mapped_column(
        Enum("pending", "confirmed", "cancelled", "completed", name="booking_status_enum"),
        nullable=False,
        default="confirmed",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    listing: Mapped["Listing"] = relationship()

    __table_args__ = (
        Index("idx_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Booking id={self.id} user={self.user_id} listing={self.listing_id} {self.status}>"
