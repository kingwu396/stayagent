"""预订日期冲突校验 (Block 27)

同一房源的日期区间不可与已有 pending/confirmed 订单重叠:
重叠判定: b.check_in < check_out AND b.check_out > check_in
(首尾相接不算冲突: 前一单的 check_out == 后一单的 check_in 是合法的)

cancelled / completed 之外的订单才占日期; completed 已退房, 历史订单不挡未来.
被 api/bookings.py 和 services/agent/tools.py 共用.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking


def find_conflict(
    db: Session,
    listing_id: int,
    check_in: date,
    check_out: date,
    exclude_booking_id: int | None = None,
) -> Booking | None:
    """查找与 [check_in, check_out) 重叠的占位订单, 返回第一条冲突 Booking (无则 None)"""
    stmt = select(Booking).where(
        Booking.listing_id == listing_id,
        Booking.status.in_(("pending", "confirmed")),
        # 区间重叠: 已有订单的入住早于新退房, 且退房晚于新入住
        Booking.check_in < check_out,
        Booking.check_out > check_in,
    )
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)
    return db.execute(stmt.limit(1)).scalar_one_or_none()
