"""房源 API：列表 / 详情 / 城市筛选"""
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func, distinct

from app.deps import DBSession
from app.models import Listing
from app.schemas.listing import (
    ListingSummary,
    ListingResponse,
    ListingListResponse,
    CityInfo,
)


router = APIRouter()


def _to_summary(listing: Listing) -> ListingSummary:
    """DB row → 卡片摘要（计算 primary_image）"""
    return ListingSummary(
        id=listing.id,
        title=listing.title,
        city=listing.city,
        country=listing.country,
        property_type=listing.property_type,
        price_per_night=listing.price_per_night,
        rating=listing.rating,
        review_count=listing.review_count,
        primary_image=(listing.images or [None])[0] if listing.images else None,
    )


def _to_response(listing: Listing) -> ListingResponse:
    """DB row → 完整详情"""
    return ListingResponse(
        id=listing.id,
        title=listing.title,
        description=listing.description,
        host_name=listing.host_name,
        city=listing.city,
        country=listing.country,
        latitude=listing.latitude,
        longitude=listing.longitude,
        property_type=listing.property_type,
        price_per_night=listing.price_per_night,
        cleaning_fee=listing.cleaning_fee or Decimal("0"),
        service_fee=listing.service_fee or Decimal("0"),
        max_guests=listing.max_guests,
        bedrooms=listing.bedrooms or 1,
        beds=listing.beds or 1,
        bathrooms=listing.bathrooms or 1,
        rating=listing.rating or Decimal("0"),
        review_count=listing.review_count or 0,
        amenities=listing.amenities or [],
        images=listing.images or [],
        primary_image=(listing.images or [None])[0] if listing.images else None,
        created_at=listing.created_at,
    )


@router.get("", response_model=ListingListResponse)
async def list_listings(
    db: DBSession,
    city: Optional[str] = Query(default=None, description="城市名（精确）"),
    property_type: Optional[str] = Query(default=None, description="房源类型"),
    min_price: Optional[Decimal] = Query(default=None, ge=0),
    max_price: Optional[Decimal] = Query(default=None, ge=0),
    min_guests: Optional[int] = Query(default=None, ge=1),
    q: Optional[str] = Query(default=None, description="标题模糊搜索"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    """列表 + 过滤 + 分页"""
    stmt = select(Listing)
    count_stmt = select(func.count()).select_from(Listing)

    # 过滤条件
    if city:
        stmt = stmt.where(Listing.city == city)
        count_stmt = count_stmt.where(Listing.city == city)
    if property_type:
        stmt = stmt.where(Listing.property_type == property_type)
        count_stmt = count_stmt.where(Listing.property_type == property_type)
    if min_price is not None:
        stmt = stmt.where(Listing.price_per_night >= min_price)
        count_stmt = count_stmt.where(Listing.price_per_night >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.price_per_night <= max_price)
        count_stmt = count_stmt.where(Listing.price_per_night <= max_price)
    if min_guests is not None:
        stmt = stmt.where(Listing.max_guests >= min_guests)
        count_stmt = count_stmt.where(Listing.max_guests >= min_guests)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Listing.title.like(like))
        count_stmt = count_stmt.where(Listing.title.like(like))

    # 排序：评分降序 + 评论数降序
    stmt = stmt.order_by(Listing.rating.desc(), Listing.review_count.desc())

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    listings = db.execute(stmt).scalars().all()
    total = db.execute(count_stmt).scalar_one()

    return ListingListResponse(
        items=[_to_summary(l) for l in listings],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/cities", response_model=list[CityInfo])
async def list_cities(db: DBSession):
    """返回所有城市 + 房源数量，给筛选下拉用"""
    rows = db.execute(
        select(
            Listing.city,
            Listing.country,
            func.count(Listing.id).label("count"),
        )
        .group_by(Listing.city, Listing.country)
        .order_by(Listing.city)
    ).all()
    return [
        CityInfo(city=row.city, country=row.country, count=row.count)
        for row in rows
    ]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: int, db: DBSession):
    """房源详情"""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")
    return _to_response(listing)
