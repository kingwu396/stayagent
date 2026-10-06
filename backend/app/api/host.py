"""Host dashboard API (Block 15)

路由:
- GET /api/host/me - 当前房东信息
- GET /api/host/listings - 房东所有房源 + 统计 (view / booking / revenue)

校验 is_host == True, 否则 403.
"""
import logging
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func, case

from app.deps import CurrentUser, DBSession
from app.models import Listing, Booking, User
from app.schemas.host import (
    HostListingStat,
    HostMeResponse,
    HostDashboardResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_host(current_user: User) -> None:
    if not current_user.is_host:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前用户不是房东, 无法访问 /api/host/*",
        )


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
