"""Booking API"""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DBSession
from app.api.payments import expire_stale_payments
from app.models import Payment
from app.models import Booking, Listing
from app.services.booking_rules import find_conflict, validate_booking_request, BookingRuleError
from app.schemas.booking import (
    BookingCreate, BookingResponse, BookingListResponse,
)


router = APIRouter()


def _to_response(b: Booking) -> BookingResponse:
    return BookingResponse(
        id=b.id,
        listing_id=b.listing_id,
        listing=b.listing,
        check_in=b.check_in,
        check_out=b.check_out,
        guests=b.guests,
        nights=b.nights,
        subtotal=b.subtotal,
        cleaning_fee=b.cleaning_fee,
        service_fee=b.service_fee,
        total=b.total,
        status=b.status,
        cancel_reason=b.cancel_reason,
        created_at=b.created_at,
    )


def _calc_nights(check_in: date, check_out: date) -> int:
    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="退房日期必须晚于入住日期")
    return (check_out - check_in).days


@router.get("", response_model=BookingListResponse)
async def list_bookings(current_user: CurrentUser, db: DBSession):
    """当前用户全部预订(先惰性过期未支付订单)"""
    expire_stale_payments(db)
    stmt = (
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .options(selectinload(Booking.listing))
        .order_by(Booking.check_in.desc())
    )
    rows = db.execute(stmt).scalars().all()
    items = [_to_response(b) for b in rows]
    return BookingListResponse(items=items, total=len(items))


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(payload: BookingCreate, current_user: CurrentUser, db: DBSession):
    """创建预订。服务端计算 nights/subtotal/total。"""
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")

    nights = _calc_nights(payload.check_in, payload.check_out)

    # Block 29: 统一校验 (日期合法/不能订过去日期/人数/冲突), 与 agent tool 同一套规则
    try:
        validate_booking_request(db, payload.listing_id, payload.check_in, payload.check_out, payload.guests)
    except BookingRuleError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)

    price = Decimal(str(listing.price_per_night))
    cleaning = Decimal(str(listing.cleaning_fee or 0))
    service = Decimal(str(listing.service_fee or 0))
    subtotal = price * nights
    total = subtotal + cleaning + service

    booking = Booking(
        user_id=current_user.id,
        listing_id=payload.listing_id,
        check_in=payload.check_in,
        check_out=payload.check_out,
        guests=payload.guests,
        nights=nights,
        subtotal=subtotal,
        cleaning_fee=cleaning,
        service_fee=service,
        total=total,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    booking.listing = listing
    return _to_response(booking)


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: int, current_user: CurrentUser, db: DBSession):
    b = db.execute(
        select(Booking)
        .where(Booking.id == booking_id, Booking.user_id == current_user.id)
        .options(selectinload(Booking.listing))
    ).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="预订不存在")
    return _to_response(b)


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(booking_id: int, current_user: CurrentUser, db: DBSession):
    """取消预订（仅 confirmed 可取消）"""
    b = db.execute(
        select(Booking)
        .where(Booking.id == booking_id, Booking.user_id == current_user.id)
        .options(selectinload(Booking.listing))
    ).scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="预订不存在")
    # Block 26: pending(待支付)与 confirmed 均可取消
    if b.status not in ("confirmed", "pending"):
        raise HTTPException(status_code=400, detail=f"当前状态 {b.status} 不可取消")
    # 待支付订单取消时, 连带作废其支付单
    if b.status == "pending":
        payment = db.execute(
            select(Payment).where(
                Payment.booking_id == b.id, Payment.status == "pending"
            )
        ).scalar_one_or_none()
        if payment:
            payment.status = "failed"
    b.status = "cancelled"
    b.cancel_reason = "user"  # Block 28: 房客主动取消
    db.commit()
    db.refresh(b)
    return _to_response(b)
