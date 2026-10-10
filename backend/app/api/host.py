"""Host dashboard API (Block 15) + 房东端管理 (Block 27)

路由:
- GET /api/host/me - 当前房东信息
- GET /api/host/listings - 房东所有房源 + 统计 (view / booking / revenue)
- POST /api/host/listings - 发布房源 (Block 27)
- PATCH /api/host/listings/{id} - 编辑房源 (Block 27)
- DELETE /api/host/listings/{id} - 删除房源 (有订单则 409) (Block 27)
- GET /api/host/listings/{id}/calendar - 房态日历 (Block 27)
- GET /api/host/bookings - 房东订单列表 (Block 27)
- POST /api/host/bookings/{id}/confirm|cancel|complete - 订单状态流转 (Block 27)

校验 is_host == True, 否则 403.
"""
import logging
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func, case

from app.api.payments import expire_stale_payments
from app.deps import CurrentUser, DBSession
from app.models import Listing, Booking, Payment, User
from app.api.listings import _to_response as _listing_to_response
from app.schemas.listing import ListingResponse
from app.schemas.host import (
    HostListingStat,
    HostMeResponse,
    HostDashboardResponse,
    ListingCreateRequest,
    ListingUpdateRequest,
    HostBookingItem,
    HostBookingListResponse,
    HostCalendarBooking,
    HostCalendarResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_host(current_user: User) -> None:
    if not current_user.is_host:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前用户不是房东, 无法访问 /api/host/*",
        )


def _get_owned_listing(db, current_user: User, listing_id: int) -> Listing:
    """取房源并校验归属, 否则 404/403"""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")
    if listing.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作他人房源")
    return listing


@router.get("/me", response_model=HostMeResponse)
async def get_me(current_user: CurrentUser, db: DBSession):
    """当前房东基本信息"""
    _require_host(current_user)

    listing_count = db.scalar(
        select(func.count()).select_from(Listing).where(Listing.host_id == current_user.id)
    ) or 0
    total_views = db.scalar(
        select(func.coalesce(func.sum(Listing.view_count), 0))
        .where(Listing.host_id == current_user.id)
    ) or 0
    confirmed_rev = db.scalar(
        select(func.coalesce(func.sum(Booking.total), 0))
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Listing.host_id == current_user.id, Booking.status == "confirmed")
    ) or 0

    return HostMeResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        is_host=current_user.is_host,
        listing_count=listing_count,
        total_views=total_views,
        total_confirmed_revenue=str(confirmed_rev),
    )


@router.get("/listings", response_model=HostDashboardResponse)
async def get_listings(current_user: CurrentUser, db: DBSession):
    """房东的所有房源 + 聚合统计"""
    _require_host(current_user)

    # 子查询: 每个 listing 的 booking_count + confirmed_revenue + pending_revenue
    booking_subq = (
        select(
            Booking.listing_id.label("lid"),
            func.count(Booking.id).label("bcount"),
            func.coalesce(
                func.sum(case((Booking.status == "confirmed", Booking.total), else_=0)),
                0,
            ).label("confirmed_rev"),
            func.coalesce(
                func.sum(case((Booking.status == "pending", Booking.total), else_=0)),
                0,
            ).label("pending_rev"),
            func.max(Booking.created_at).label("latest_booking"),
        )
        .group_by(Booking.listing_id)
        .subquery()
    )

    rows = db.execute(
        select(
            Listing,
            func.coalesce(booking_subq.c.bcount, 0).label("bcount"),
            func.coalesce(booking_subq.c.confirmed_rev, 0).label("confirmed_rev"),
            func.coalesce(booking_subq.c.pending_rev, 0).label("pending_rev"),
            booking_subq.c.latest_booking,
        )
        .outerjoin(booking_subq, booking_subq.c.lid == Listing.id)
        .where(Listing.host_id == current_user.id)
        .order_by(Listing.view_count.desc(), Listing.id.asc())
    ).all()

    items: list[HostListingStat] = []
    total_views = 0
    total_confirmed = 0.0
    total_pending = 0.0
    for listing, bcount, crev, prev, _latest in rows:
        # 入住状态: 从最新 booking 推
        latest_status_row = db.execute(
            select(Booking.status)
            .where(Booking.listing_id == listing.id)
            .order_by(Booking.created_at.desc())
            .limit(1)
        ).first()
        occ = latest_status_row[0] if latest_status_row else "available"

        primary = None
        if listing.images:
            primary = listing.images[0]
        items.append(HostListingStat(
            listing_id=listing.id,
            title=listing.title,
            city=listing.city,
            property_type=listing.property_type,
            price_per_night=str(listing.price_per_night),
            primary_image=primary,
            view_count=listing.view_count or 0,
            booking_count=bcount,
            confirmed_revenue=str(crev),
            pending_revenue=str(prev),
            occupancy_status=occ,
        ))
        total_views += listing.view_count or 0
        total_confirmed += float(crev)
        total_pending += float(prev)

    return HostDashboardResponse(
        total_listings=len(items),
        total_views=total_views,
        total_confirmed_revenue=str(total_confirmed),
        total_pending_revenue=str(total_pending),
        items=items,
    )


@router.get("/listings/{listing_id}/stats", response_model=HostListingStat)
async def get_listing_stats(listing_id: int, current_user: CurrentUser, db: DBSession):
    """单个 listing 的详细统计"""
    _require_host(current_user)
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")
    if listing.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看他人房源统计")

    bcount = db.scalar(
        select(func.count(Booking.id)).where(Booking.listing_id == listing_id)
    ) or 0
    crev = db.scalar(
        select(func.coalesce(func.sum(Booking.total), 0))
        .where(Booking.listing_id == listing_id, Booking.status == "confirmed")
    ) or 0
    prev = db.scalar(
        select(func.coalesce(func.sum(Booking.total), 0))
        .where(Booking.listing_id == listing_id, Booking.status == "pending")
    ) or 0
    occ_row = db.execute(
        select(Booking.status)
        .where(Booking.listing_id == listing_id)
        .order_by(Booking.created_at.desc())
        .limit(1)
    ).first()
    occ = occ_row[0] if occ_row else "available"

    primary = listing.images[0] if listing.images else None

    return HostListingStat(
        listing_id=listing.id,
        title=listing.title,
        city=listing.city,
        property_type=listing.property_type,
        price_per_night=str(listing.price_per_night),
        primary_image=primary,
        view_count=listing.view_count or 0,
        booking_count=bcount,
        confirmed_revenue=str(crev),
        pending_revenue=str(prev),
        occupancy_status=occ,
    )


@router.post("/become", response_model=HostMeResponse)
async def become_host(current_user: CurrentUser, db: DBSession):
    """当前用户一键成为房东 (idempotent). 返回最新的 HostMeResponse."""
    if not current_user.is_host:
        current_user.is_host = True
        db.commit()
        db.refresh(current_user)
    # 直接复用 get_me 的计算
    listing_count = db.scalar(
        select(func.count()).select_from(Listing).where(Listing.host_id == current_user.id)
    ) or 0
    total_views = db.scalar(
        select(func.coalesce(func.sum(Listing.view_count), 0))
        .where(Listing.host_id == current_user.id)
    ) or 0
    confirmed_rev = db.scalar(
        select(func.coalesce(func.sum(Booking.total), 0))
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Listing.host_id == current_user.id, Booking.status == "confirmed")
    ) or 0
    return HostMeResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        is_host=current_user.is_host,
        listing_count=listing_count,
        total_views=total_views,
        total_confirmed_revenue=str(confirmed_rev),
    )


# ============ Block 27: 房源 CRUD ============

@router.post("/listings", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreateRequest, current_user: CurrentUser, db: DBSession
):
    """发布房源. host_name 取当前用户名, rating/review_count/view_count 从 0 开始"""
    _require_host(current_user)
    listing = Listing(
        host_id=current_user.id,
        host_name=current_user.username,
        title=payload.title,
        description=payload.description,
        city=payload.city,
        country=payload.country,
        latitude=payload.latitude,
        longitude=payload.longitude,
        property_type=payload.property_type,
        price_per_night=payload.price_per_night,
        cleaning_fee=payload.cleaning_fee,
        service_fee=payload.service_fee,
        max_guests=payload.max_guests,
        bedrooms=payload.bedrooms,
        beds=payload.beds,
        bathrooms=payload.bathrooms,
        amenities=payload.amenities,
        images=payload.images,
        rating=0,
        review_count=0,
        view_count=0,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    logger.info("host create_listing: user=%d -> listing #%d", current_user.id, listing.id)
    return _listing_to_response(listing)


@router.patch("/listings/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: int,
    payload: ListingUpdateRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    """编辑房源 (部分更新, exclude_unset)"""
    _require_host(current_user)
    listing = _get_owned_listing(db, current_user, listing_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="没有需要更新的字段")
    for field, value in changes.items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    logger.info("host update_listing: user=%d listing #%d fields=%s",
                current_user.id, listing_id, sorted(changes))
    return _listing_to_response(listing)


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(listing_id: int, current_user: CurrentUser, db: DBSession):
    """删除房源. bookings 外键无级联 (RESTRICT), 有订单直接 409; 心愿单项 DB 级联清理"""
    _require_host(current_user)
    listing = _get_owned_listing(db, current_user, listing_id)
    booking_count = db.scalar(
        select(func.count()).select_from(Booking).where(Booking.listing_id == listing_id)
    ) or 0
    if booking_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"该房源有 {booking_count} 笔订单, 无法删除 (请先在订单中心处理)",
        )
    db.delete(listing)
    db.commit()
    logger.info("host delete_listing: user=%d listing #%d", current_user.id, listing_id)


# ============ Block 27: 房东订单管理 ============

@router.get("/bookings", response_model=HostBookingListResponse)
async def list_host_bookings(
    current_user: CurrentUser,
    db: DBSession,
    status_filter: str | None = Query(
        default=None, alias="status", description="按状态筛选: pending/confirmed/completed/cancelled"
    ),
    listing_id: int | None = Query(default=None, description="按房源筛选"),
):
    """房东收到的所有订单 (自己房源, 含房客名). 先惰性过期未支付订单."""
    _require_host(current_user)
    expire_stale_payments(db)

    stmt = (
        select(Booking, Listing, User.username)
        .join(Listing, Booking.listing_id == Listing.id)
        .join(User, Booking.user_id == User.id)
        .where(Listing.host_id == current_user.id)
        .order_by(Booking.check_in.desc(), Booking.id.desc())
    )
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter)
    if listing_id is not None:
        stmt = stmt.where(Booking.listing_id == listing_id)

    rows = db.execute(stmt).all()
    items = [
        HostBookingItem(
            id=b.id,
            listing_id=b.listing_id,
            listing_title=l.title,
            listing_image=(l.images or [None])[0] if l.images else None,
            guest_username=username,
            check_in=b.check_in,
            check_out=b.check_out,
            guests=b.guests,
            nights=b.nights,
            total=str(b.total),
            status=b.status,
            cancel_reason=b.cancel_reason,
            created_at=b.created_at,
        )
        for b, l, username in rows
    ]
    return HostBookingListResponse(items=items, total=len(items))


def _get_host_booking(db, current_user: User, booking_id: int) -> Booking:
    """取订单并校验房源归属 (订单 → 房源 → host_id), 否则 404/403"""
    row = db.execute(
        select(Booking, Listing)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Booking.id == booking_id)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="订单不存在")
    booking, listing = row
    if listing.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作他人房源的订单")
    return booking


@router.post("/bookings/{booking_id}/confirm")
async def confirm_host_booking(booking_id: int, current_user: CurrentUser, db: DBSession):
    """房东确认待支付订单 (线下收款场景). pending → confirmed, 支付单置 succeeded"""
    _require_host(current_user)
    booking = _get_host_booking(db, current_user, booking_id)
    if booking.status != "pending":
        raise HTTPException(status_code=400, detail=f"当前状态 {booking.status} 不可确认 (仅待支付)")
    booking.status = "confirmed"
    payment = db.execute(
        select(Payment).where(Payment.booking_id == booking.id, Payment.status == "pending")
    ).scalar_one_or_none()
    if payment:
        payment.status = "succeeded"
        payment.paid_at = datetime.now()
    db.commit()
    db.refresh(booking)
    logger.info("host confirm booking #%d -> confirmed", booking_id)
    return {"id": booking.id, "status": booking.status}


@router.post("/bookings/{booking_id}/cancel")
async def cancel_host_booking(booking_id: int, current_user: CurrentUser, db: DBSession):
    """房东取消订单. pending/confirmed → cancelled, 作废未支付支付单"""
    _require_host(current_user)
    booking = _get_host_booking(db, current_user, booking_id)
    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail=f"当前状态 {booking.status} 不可取消")
    if booking.status == "pending":
        payment = db.execute(
            select(Payment).where(Payment.booking_id == booking.id, Payment.status == "pending")
        ).scalar_one_or_none()
        if payment:
            payment.status = "failed"
    booking.status = "cancelled"
    booking.cancel_reason = "host"  # Block 28: 房东取消
    db.commit()
    db.refresh(booking)
    logger.info("host cancel booking #%d -> cancelled (host)", booking_id)
    return {"id": booking.id, "status": booking.status, "cancel_reason": booking.cancel_reason}


@router.post("/bookings/{booking_id}/complete")
async def complete_host_booking(booking_id: int, current_user: CurrentUser, db: DBSession):
    """完结订单. confirmed 且已退房 (check_out < today) → completed"""
    _require_host(current_user)
    booking = _get_host_booking(db, current_user, booking_id)
    if booking.status != "confirmed":
        raise HTTPException(status_code=400, detail=f"当前状态 {booking.status} 不可完结 (仅已确认)")
    if booking.check_out >= date.today():
        raise HTTPException(
            status_code=400,
            detail=f"退房日 {booking.check_out} 尚未过去, 不可完结",
        )
    booking.status = "completed"
    db.commit()
    db.refresh(booking)
    logger.info("host complete booking #%d -> completed", booking_id)
    return {"id": booking.id, "status": booking.status}


# ============ Block 27: 房态日历 ============

@router.get("/listings/{listing_id}/calendar", response_model=HostCalendarResponse)
async def get_listing_calendar(
    listing_id: int,
    current_user: CurrentUser,
    db: DBSession,
    month: str = Query(description="月份, 格式 YYYY-MM", pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
):
    """某房源某月的占位区间 (pending/confirmed 订单, 占 [check_in, check_out) 的夜晚). 前端展开成日历格子"""
    _require_host(current_user)
    listing = _get_owned_listing(db, current_user, listing_id)

    year, mon = int(month[:4]), int(month[5:7])
    month_start = date(year, mon, 1)
    # 下个月 1 号 (13 月自动进位到下一年)
    month_end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)

    rows = db.execute(
        select(Booking)
        .where(
            Booking.listing_id == listing_id,
            Booking.status.in_(("pending", "confirmed")),
            Booking.check_in < month_end,
            Booking.check_out > month_start,
        )
        .order_by(Booking.check_in)
    ).scalars().all()

    return HostCalendarResponse(
        listing_id=listing_id,
        month=month,
        items=[
            HostCalendarBooking(
                booking_id=b.id, check_in=b.check_in, check_out=b.check_out, status=b.status
            )
            for b in rows
        ],
    )
