"""预订规则校验 (Block 27 冲突 + Block 29 全量校验)

三个入口共用同一套校验 (api/bookings.py / agent tool / orchestrator HITL 预校验):
- api: BookingRuleError → HTTPException(status=http_status)
- agent tool: BookingRuleError → ToolError(code) 喂回 LLM
- HITL 预校验: 失败不进 pending_confirmation, 让 tool 执行抛同样错误喂回 LLM 提醒用户

校验项: 房源存在 / 退房晚于入住 / 入住不早于今天 / 人数 1-20 且 ≤ max_guests / 日期冲突.
冲突判定: b.check_in < check_out AND b.check_out > check_in
(首尾相接不算冲突: 前一单的 check_out == 后一单的 check_in 是合法的)
cancelled / completed 不占日期.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Listing


class BookingRuleError(Exception):
    """预订校验失败. code 对齐 ToolError 体系, http_status 供 API 转换."""

    def __init__(self, message: str, code: str = "INVALID_ARGS", http_status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code  # NOT_FOUND | INVALID_ARGS | CONFLICT
        self.http_status = http_status

    def __str__(self) -> str:
        return self.message


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


def validate_booking_request(
    db: Session,
    listing_id: int,
    check_in: date,
    check_out: date,
    guests: int,
) -> None:
    """下单请求全量校验. 通过静默返回, 失败 raise BookingRuleError.

    check_in/check_out 须是 date 对象 (str 由调用方先 parse, 格式错自己报).
    """
    listing = db.get(Listing, listing_id)
    if not listing:
        raise BookingRuleError(f"房源 #{listing_id} 不存在", code="NOT_FOUND", http_status=404)

    if check_out <= check_in:
        raise BookingRuleError("退房日期必须晚于入住日期")

    # Block 29: 不能预订过去的日期 (用户说"10月1号到2号"但今天已 10月10号之类)
    today = date.today()
    if check_in < today:
        raise BookingRuleError(
            f"入住日期 {check_in} 不能早于今天 ({today}), 请选择未来的日期"
        )

    if guests < 1 or guests > 20:
        raise BookingRuleError(f"人数 {guests} 超出合法范围 (1-20)")

    if guests > listing.max_guests:
        raise BookingRuleError(
            f"该房源最多接待 {listing.max_guests} 位客人 (你输入 {guests})"
        )

    # 日期冲突 (pending/confirmed 订单占位)
    conflict = find_conflict(db, listing_id, check_in, check_out)
    if conflict:
        raise BookingRuleError(
            f"该房源 {check_in} ~ {check_out} 已被预订 "
            f"(订单 #{conflict.id}, {conflict.check_in} ~ {conflict.check_out}), "
            "请更换日期或选择其他房源",
            code="CONFLICT",
            http_status=409,
        )
