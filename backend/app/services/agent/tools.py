"""Agent Tool 实际实现 (Block 9: 7 个核心 tool)

约定:
- 每个 tool 函数签名: (user: User, db: Session, **kwargs) -> dict
- 抛 ToolError(message, code) 表示业务错误, orchestrator 转成结构化错误给 LLM
- 返回 dict 让 LLM 看到结构化数据
- 同步函数 (直接读 DB), orchestrator 直接调用无需 await
"""
import logging
from decimal import Decimal
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import (
    User, Listing, Wishlist, WishlistItem,
)

logger = logging.getLogger(__name__)


# ============ 自定义异常 ============

class ToolError(Exception):
    """Tool 业务错误: orchestrator 转成 {"error": str(e), "code": e.code} 喂给 LLM"""

    def __init__(self, message: str, code: str = "TOOL_ERROR"):
        super().__init__(message)
        self.code = code


# ============ 工具函数: Listing → dict ============

def _listing_to_dict(l: Listing) -> dict[str, Any]:
    return {
        "id": l.id,
        "title": l.title,
        "city": l.city,
        "country": l.country,
        "property_type": l.property_type,
        "price_per_night": float(l.price_per_night),
        "rating": float(l.rating or 0),
        "review_count": l.review_count or 0,
        "max_guests": l.max_guests,
        "primary_image": (l.images or [None])[0] if l.images else None,
    }


# ============ Tool 1: search_listings ============

def search_listings(
    user: User, db,
    city: str | None = None,
    property_type: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_guests: int | None = None,
    q: str | None = None,
    limit: int = 5,
    **_kwargs,
) -> dict:
    """根据条件搜索房源, 返回摘要列表。"""
    limit = min(max(limit, 1), 20)
    stmt = select(Listing)
    if city:
        stmt = stmt.where(Listing.city == city)
    if property_type:
        if property_type not in ("studio", "apartment", "house", "villa", "hotel"):
            raise ToolError(f"不支持的房源类型: {property_type}", code="INVALID_ARGS")
        stmt = stmt.where(Listing.property_type == property_type)
    if min_price is not None:
        stmt = stmt.where(Listing.price_per_night >= Decimal(str(min_price)))
    if max_price is not None:
        stmt = stmt.where(Listing.price_per_night <= Decimal(str(max_price)))
    if min_guests:
        stmt = stmt.where(Listing.max_guests >= min_guests)
    if q:
        stmt = stmt.where(Listing.title.like(f"%{q}%"))
    stmt = stmt.order_by(Listing.rating.desc(), Listing.review_count.desc()).limit(limit)
    rows = db.execute(stmt).scalars().all()
    items = [_listing_to_dict(r) for r in rows]
    logger.info("search_listings: city=%s type=%s -> %d results", city, property_type, len(items))
    return {"count": len(items), "items": items}


# ============ Tool 2: get_listing_detail ============

def get_listing_detail(
    user: User, db,
    listing_id: int,
    **_kwargs,
) -> dict:
    """获取房源详情。"""
    listing = db.get(Listing, listing_id)
    if not listing:
        raise ToolError(f"房源 #{listing_id} 不存在", code="NOT_FOUND")
    d = _listing_to_dict(listing)
    d.update({
        "description": listing.description,
        "bedrooms": listing.bedrooms or 1,
        "beds": listing.beds or 1,
        "bathrooms": listing.bathrooms or 1,
        "amenities": listing.amenities or [],
        "cleaning_fee": float(listing.cleaning_fee or 0),
        "service_fee": float(listing.service_fee or 0),
        "latitude": float(listing.latitude) if listing.latitude else None,
        "longitude": float(listing.longitude) if listing.longitude else None,
        "host_name": listing.host_name,
    })
    return d


# ============ Tool 3: compare_listings ============

def compare_listings(
    user: User, db,
    listing_ids: list[int],
    **_kwargs,
) -> dict:
    """对比多个房源的关键信息。"""
    if not listing_ids or len(listing_ids) < 2:
        raise ToolError("比较至少需要 2 个房源 ID", code="INVALID_ARGS")
    ids = list(dict.fromkeys(listing_ids))[:5]  # 去重 + 限 5

    rows = db.execute(select(Listing).where(Listing.id.in_(ids))).scalars().all()
    if not rows:
        raise ToolError("没找到任何指定房源", code="NOT_FOUND")

    by_id = {r.id: r for r in rows}
    items = []
    for lid in ids:
        r = by_id.get(lid)
        if not r:
            items.append({"id": lid, "missing": True})
            continue
        items.append({
            "id": r.id,
            "title": r.title,
            "city": r.city,
            "property_type": r.property_type,
            "price_per_night": float(r.price_per_night),
            "rating": float(r.rating or 0),
            "review_count": r.review_count or 0,
            "amenities": r.amenities or [],
            "max_guests": r.max_guests,
        })
    return {"count": len(items), "items": items}


# ============ Tool 4: add_to_wishlist ============

def add_to_wishlist(
    user: User, db,
    wishlist_id: int,
    listing_id: int,
    **_kwargs,
) -> dict:
    """把房源加入心愿单。"""
    w = db.execute(
        select(Wishlist).where(Wishlist.id == wishlist_id, Wishlist.user_id == user.id)
    ).scalar_one_or_none()
    if not w:
        raise ToolError(f"心愿单 #{wishlist_id} 不存在或无权访问", code="NOT_FOUND")

    listing = db.get(Listing, listing_id)
    if not listing:
        raise ToolError(f"房源 #{listing_id} 不存在", code="NOT_FOUND")

    existing = db.execute(
        select(WishlistItem).where(
            WishlistItem.wishlist_id == wishlist_id,
            WishlistItem.listing_id == listing_id,
        )
    ).scalar_one_or_none()
    if existing:
        return {
            "status": "already_in_wishlist",
            "wishlist_id": wishlist_id,
            "wishlist_name": w.name,
            "listing_id": listing_id,
            "listing_title": listing.title,
        }

    db.add(WishlistItem(wishlist_id=wishlist_id, listing_id=listing_id))
    db.commit()
    return {
        "status": "added",
        "wishlist_id": wishlist_id,
        "wishlist_name": w.name,
        "listing_id": listing_id,
        "listing_title": listing.title,
    }


# ============ Tool 5: remove_from_wishlist ============

def remove_from_wishlist(
    user: User, db,
    wishlist_id: int,
    listing_id: int,
    **_kwargs,
) -> dict:
    """从心愿单移除房源。"""
    w = db.execute(
        select(Wishlist).where(Wishlist.id == wishlist_id, Wishlist.user_id == user.id)
    ).scalar_one_or_none()
    if not w:
        raise ToolError(f"心愿单 #{wishlist_id} 不存在或无权访问", code="NOT_FOUND")

    item = db.execute(
        select(WishlistItem).where(
            WishlistItem.wishlist_id == wishlist_id,
            WishlistItem.listing_id == listing_id,
        )
    ).scalar_one_or_none()
    if not item:
        return {
            "status": "not_in_wishlist",
            "wishlist_id": wishlist_id,
            "wishlist_name": w.name,
            "listing_id": listing_id,
        }

    db.delete(item)
    db.commit()
    return {
        "status": "removed",
        "wishlist_id": wishlist_id,
        "wishlist_name": w.name,
        "listing_id": listing_id,
    }


# ============ Tool 6: create_wishlist ============

def create_wishlist(
    user: User, db,
    name: str,
    **_kwargs,
) -> dict:
    """创建新心愿单 (同名会报错, 让 LLM 决定改名或复用)。"""
    name = (name or "").strip()
    if not name:
        raise ToolError("心愿单名称不能为空", code="INVALID_ARGS")
    if len(name) > 100:
        raise ToolError("心愿单名称不能超过 100 字", code="INVALID_ARGS")

    existing = db.execute(
        select(Wishlist).where(Wishlist.user_id == user.id, Wishlist.name == name)
    ).scalar_one_or_none()
    if existing:
        raise ToolError(
            f"心愿单 '{name}' 已存在 (id={existing.id}), 请换个名字或直接用现有的",
            code="ALREADY_EXISTS",
        )

    w = Wishlist(user_id=user.id, name=name)
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"status": "created", "wishlist_id": w.id, "name": w.name}


# ============ Tool 7: list_wishlists ============

def list_wishlists(
    user: User, db,
    **_kwargs,
) -> dict:
    """查看用户的所有心愿单 + 各自包含的房源。"""
    stmt = (
        select(Wishlist)
        .where(Wishlist.user_id == user.id)
        .options(selectinload(Wishlist.items).selectinload(WishlistItem.listing))
        .order_by(Wishlist.created_at.desc())
    )
    rows = db.execute(stmt).scalars().all()
    wishlists = []
    for w in rows:
        items = []
        for it in (w.items or []):
            items.append({
                "listing_id": it.listing_id,
                "title": it.listing.title if it.listing else None,
                "added_at": it.added_at.isoformat() if it.added_at else None,
            })
        wishlists.append({
            "id": w.id,
            "name": w.name,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "item_count": len(items),
            "items": items,
        })
    return {"count": len(wishlists), "wishlists": wishlists}


# ============ Tool dispatch (orchestrator 用) ============

TOOL_DISPATCH: dict[str, Any] = {
    "search_listings": search_listings,
    "get_listing_detail": get_listing_detail,
    "compare_listings": compare_listings,
    "add_to_wishlist": add_to_wishlist,
    "remove_from_wishlist": remove_from_wishlist,
    "create_wishlist": create_wishlist,
    "list_wishlists": list_wishlists,
}
"""Tool name → 实现函数. orchestrator 按 tc.function.name 路由."""
