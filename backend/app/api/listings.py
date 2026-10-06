"""房源 API：列表 / 详情 / 城市筛选 / 筛选选项"""
import json
from collections import Counter
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func

from app.deps import DBSession
from app.models import Listing
from app.schemas.listing import (
    ListingSummary,
    ListingResponse,
    ListingListResponse,
    CityInfo,
    FilterOptions,
    PriceBucket,
    AmenityCount,
    PropertyTypeCount,
)


router = APIRouter()


# ============ 辅助：property_type / place_type 映射 ============

# place_type="room" → 仅 studio（私人房间）
# place_type="entire" → 整租（apartment/house/villa）
PLACE_TYPE_MAP = {
    "room": ["studio"],
    "entire": ["apartment", "house", "villa"],
}


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
        latitude=listing.latitude,
        longitude=listing.longitude,
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
    place_type: Optional[str] = Query(
        default=None, description="住宿类型: any/entire/room"
    ),
    property_types: Optional[str] = Query(
        default=None, description="房源类型多选，逗号分隔 (house/apartment/villa/hotel/studio)"
    ),
    min_price: Optional[Decimal] = Query(default=None, ge=0),
    max_price: Optional[Decimal] = Query(default=None, ge=0),
    min_guests: Optional[int] = Query(default=None, ge=1),
    min_bedrooms: Optional[int] = Query(default=None, ge=0),
    max_bedrooms: Optional[int] = Query(default=None, ge=0),
    min_beds: Optional[int] = Query(default=None, ge=0),
    max_beds: Optional[int] = Query(default=None, ge=0),
    min_bathrooms: Optional[int] = Query(default=None, ge=0),
    max_bathrooms: Optional[int] = Query(default=None, ge=0),
    amenities: Optional[str] = Query(
        default=None, description="便利设施（逗号分隔）"
    ),
    q: Optional[str] = Query(default=None, description="标题模糊搜索"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    """列表 + 过滤 + 分页"""
    stmt = select(Listing)
    count_stmt = select(func.count()).select_from(Listing)

    # 过滤条件：city
    if city:
        stmt = stmt.where(Listing.city == city)
        count_stmt = count_stmt.where(Listing.city == city)

    # property_type + property_types + place_type 合并
    final_property_types = []
    if property_type:
        final_property_types.append(property_type)
    if property_types:
        final_property_types.extend([t.strip() for t in property_types.split(",") if t.strip()])
    if place_type and place_type in PLACE_TYPE_MAP:
        final_property_types.extend(PLACE_TYPE_MAP[place_type])
    if final_property_types:
        stmt = stmt.where(Listing.property_type.in_(final_property_types))
        count_stmt = count_stmt.where(Listing.property_type.in_(final_property_types))

    # 价格
    if min_price is not None:
        stmt = stmt.where(Listing.price_per_night >= min_price)
        count_stmt = count_stmt.where(Listing.price_per_night >= min_price)
    if max_price is not None:
        stmt = stmt.where(Listing.price_per_night <= max_price)
        count_stmt = count_stmt.where(Listing.price_per_night <= max_price)

    # 人数
    if min_guests is not None:
        stmt = stmt.where(Listing.max_guests >= min_guests)
        count_stmt = count_stmt.where(Listing.max_guests >= min_guests)

    # 卧室 / 床位 / 卫生间
    if min_bedrooms is not None:
        stmt = stmt.where(Listing.bedrooms >= min_bedrooms)
        count_stmt = count_stmt.where(Listing.bedrooms >= min_bedrooms)
    if max_bedrooms is not None:
        stmt = stmt.where(Listing.bedrooms <= max_bedrooms)
        count_stmt = count_stmt.where(Listing.bedrooms <= max_bedrooms)
    if min_beds is not None:
        stmt = stmt.where(Listing.beds >= min_beds)
        count_stmt = count_stmt.where(Listing.beds >= min_beds)
    if max_beds is not None:
        stmt = stmt.where(Listing.beds <= max_beds)
        count_stmt = count_stmt.where(Listing.beds <= max_beds)
    if min_bathrooms is not None:
        stmt = stmt.where(Listing.bathrooms >= min_bathrooms)
        count_stmt = count_stmt.where(Listing.bathrooms >= min_bathrooms)
    if max_bathrooms is not None:
        stmt = stmt.where(Listing.bathrooms <= max_bathrooms)
        count_stmt = count_stmt.where(Listing.bathrooms <= max_bathrooms)

    # 标题模糊
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Listing.title.like(like))
        count_stmt = count_stmt.where(Listing.title.like(like))

    # amenities (Block 14 DB 端过滤, JSON_CONTAINS 是 MySQL JSON AND-contains 操作符)
    amenities_list: list[str] = []
    if amenities:
        amenities_list = [a.strip() for a in amenities.split(",") if a.strip()]
        if amenities_list:
            json_arr = json.dumps(amenities_list)
            stmt = stmt.where(func.json_contains(Listing.amenities, json_arr) == 1)
            count_stmt = count_stmt.where(func.json_contains(Listing.amenities, json_arr) == 1)

    # 排序：评分降序 + 评论数降序
    stmt = stmt.order_by(Listing.rating.desc(), Listing.review_count.desc())

    # Block 14: count + 分页全部走 SQL (OFFSET/LIMIT)
    total = db.execute(count_stmt).scalar() or 0
    offset = (page - 1) * page_size
    paged = db.execute(stmt.offset(offset).limit(page_size)).scalars().all()

    return ListingListResponse(
        items=[_to_summary(l) for l in paged],
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


@router.get("/filter-options", response_model=FilterOptions)
async def filter_options(
    db: DBSession,
    city: Optional[str] = Query(default=None, description="可选：按城市缩小范围"),
):
    """
    返回筛选 modal 需要的全部数据：
    - 价格直方图（30 个 buckets）
    - 便利设施频次（按 count 降序）
    - 房源类型分布
    - 卧室/卫生间可选值列表
    """
    stmt = select(Listing)
    if city:
        stmt = stmt.where(Listing.city == city)
    rows = db.execute(stmt).scalars().all()
    if not rows:
        return FilterOptions(
            price_buckets=[],
            min_price=Decimal("0"),
            max_price=Decimal("0"),
            amenities_counts=[],
            property_type_counts=[],
            bedroom_counts=[],
            bathroom_counts=[],
        )

    # ---- 价格直方图（30 buckets） ----
    prices = [float(l.price_per_night) for l in rows]
    raw_min = min(prices)
    raw_max = max(prices)
    # 取整到 50 的倍数（向下 / 向上）
    bin_min = (int(raw_min) // 50) * 50
    bin_max = ((int(raw_max) // 50) + 1) * 50
    if bin_max <= bin_min:
        bin_max = bin_min + 50

    N_BUCKETS = 30
    span = bin_max - bin_min
    width = span / N_BUCKETS

    bucket_counts = [0] * N_BUCKETS
    for p in prices:
        idx = int((p - bin_min) / width)
        if idx >= N_BUCKETS:
            idx = N_BUCKETS - 1
        if idx < 0:
            idx = 0
        bucket_counts[idx] += 1

    price_buckets = [
        PriceBucket(
            min=Decimal(str(round(bin_min + i * width, 2))),
            max=Decimal(str(round(bin_min + (i + 1) * width, 2))),
            count=bucket_counts[i],
        )
        for i in range(N_BUCKETS)
    ]

    # ---- 便利设施频次 ----
    amenity_counter: Counter[str] = Counter()
    for l in rows:
        if l.amenities:
            for a in l.amenities:
                amenity_counter[a] += 1
    amenities_counts = [
        AmenityCount(name=name, count=count)
        for name, count in amenity_counter.most_common()
    ]

    # ---- 房源类型分布 ----
    type_counter: Counter[str] = Counter(l.property_type for l in rows)
    property_type_counts = [
        PropertyTypeCount(type=t, count=c)
        for t, c in sorted(type_counter.items())
    ]

    # ---- 卧室 / 卫生间可选值（去重排序） ----
    bedroom_counts = sorted({l.bedrooms for l in rows})
    bathroom_counts = sorted({l.bathrooms for l in rows})

    return FilterOptions(
        price_buckets=price_buckets,
        min_price=Decimal(str(bin_min)),
        max_price=Decimal(str(bin_max)),
        amenities_counts=amenities_counts,
        property_type_counts=property_type_counts,
        bedroom_counts=bedroom_counts,
        bathroom_counts=bathroom_counts,
    )


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: int, db: DBSession):
    """房源详情 (Block 15: 顺便 view_count +1)"""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")
    # Block 15: 详情访问自增 (list 接口不增)
    listing.view_count = (listing.view_count or 0) + 1
    db.commit()
    db.refresh(listing)
    return _to_response(listing)
