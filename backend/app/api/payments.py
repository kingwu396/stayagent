"""Payment API (Block 26): 模拟支付 —— 创建支付单 / 模拟网关支付 / 查询

支付流程: 创建 booking(pending) → POST /payments(建 pending 支付单)
        → POST /payments/{id}/pay(模拟网关, booking → confirmed)
15 分钟未支付的订单惰性过期: payment → failed, booking → cancelled。
"""
import logging
from datetime import datetime

from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DBSession
from app.models import Booking, Payment
from app.schemas.payment import PaymentCreate, PaymentResponse

logger = logging.getLogger(__name__)

router = APIRouter()

PAYMENT_EXPIRE_MINUTES = 15


def expire_stale_payments(db) -> int:
    """惰性过期: 创建超过 15 分钟仍 pending 的支付单 → failed, 关联 booking → cancelled。

    用 DB 侧时间比较, 避开 python/DB 时区错位。返回过期数量。
    """
    stale = db.execute(
        select(Payment).where(
            Payment.status == "pending",
            Payment.created_at < func.date_sub(func.now(), text("INTERVAL 15 MINUTE")),
        )
    ).scalars().all()
    if not stale:
        return 0
    for p in stale:
        p.status = "failed"
        booking = db.get(Booking, p.booking_id)
        if booking and booking.status == "pending":
            booking.status = "cancelled"
            booking.cancel_reason = "expired"  # Block 28: 超时未支付自动作废
    db.commit()
    logger.info("expire_stale_payments: %d 笔支付单过期", len(stale))
    return len(stale)


def _to_response(p: Payment) -> PaymentResponse:
    return PaymentResponse(
        id=p.id,
        booking_id=p.booking_id,
        amount=p.amount,
        method=p.method,
        status=p.status,
        created_at=p.created_at,
        paid_at=p.paid_at,
    )


def _get_user_payment(db, payment_id: int, user_id: int) -> Payment:
    p = db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.user_id == user_id)
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="支付单不存在")
    return p


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(payload: PaymentCreate, current_user: CurrentUser, db: DBSession):
    """为待支付订单创建支付单"""
    expire_stale_payments(db)

    booking = db.execute(
        select(Booking)
        .where(Booking.id == payload.booking_id, Booking.user_id == current_user.id)
        .options(selectinload(Booking.listing))
    ).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="订单不存在")
    if booking.status == "confirmed":
        raise HTTPException(status_code=400, detail="该订单已支付")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"订单状态为 {booking.status}, 无法支付")

    # 幂等: 同一订单已有 pending 支付单 → 直接复用(改支付方式)
    existing = db.execute(
        select(Payment).where(
            Payment.booking_id == booking.id, Payment.status == "pending"
        )
    ).scalar_one_or_none()
    if existing:
        existing.method = payload.method
        db.commit()
        db.refresh(existing)
        return _to_response(existing)

    payment = Payment(
        booking_id=booking.id,
        user_id=current_user.id,
        amount=booking.total,
        method=payload.method,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return _to_response(payment)


@router.post("/{payment_id}/pay", response_model=PaymentResponse)
async def pay_payment(payment_id: int, current_user: CurrentUser, db: DBSession):
    """模拟支付网关: 支付成功 → booking 确认。幂等: 已成功的直接返回。"""
    expire_stale_payments(db)
    payment = _get_user_payment(db, payment_id, current_user.id)

    if payment.status == "succeeded":
        return _to_response(payment)  # 幂等
    if payment.status == "failed":
        # failed 的两种来源: 惰性过期 / 房东取消 (Block 27), 文案兼顾两者
        raise HTTPException(status_code=400, detail="支付单已失效(订单已取消或超时未支付)")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"支付单状态异常: {payment.status}")

    booking = db.get(Booking, payment.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="关联订单不存在")
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"订单状态为 {booking.status}, 无法支付")

    # 模拟网关: 本地 mock 无真实三方, 直接标记成功
    payment.status = "succeeded"
    payment.paid_at = datetime.now()
    booking.status = "confirmed"
    db.commit()
    logger.info("payment %s paid (booking %s confirmed, ¥%s)", payment.id, booking.id, payment.amount)
    return _to_response(payment)


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: int, current_user: CurrentUser, db: DBSession):
    expire_stale_payments(db)
    payment = _get_user_payment(db, payment_id, current_user.id)
    return _to_response(payment)
