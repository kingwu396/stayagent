"""Agent Tool 实际实现 (Block 9: 7 个核心 tool)

约定:
- 每个 tool 函数签名: (user: User, db: Session, **kwargs) -> dict
- 抛 ToolError(message, code) 表示业务错误, orchestrator 转成结构化错误给 LLM
- 返回 dict 让 LLM 看到结构化数据
- 同步函数 (直接读 DB), orchestrator 直接调用无需 await
"""
import json
import logging
import re
from datetime import date
from decimal import Decimal
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import (
    User, Listing, Wishlist, WishlistItem, Booking, Message,
)
from app.services.rag import retrieve_tips

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
            "bedrooms": r.bedrooms or 1,
            "coordinates": {
                "latitude": float(r.latitude) if r.latitude else None,
                "longitude": float(r.longitude) if r.longitude else None,
            },
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
    listing_id: int | None = None,
    listing_name: str | None = None,
    **_kwargs,
) -> dict:
    """从心愿单移除房源 (listing_id 或 listing_name 二选一)。"""
    if (listing_id is None) == (listing_name is None):
        raise ToolError(
            "必须且只能传入 listing_id 或 listing_name 其中一个",
            code="INVALID_ARGS",
        )

    w = db.execute(
        select(Wishlist).where(Wishlist.id == wishlist_id, Wishlist.user_id == user.id)
    ).scalar_one_or_none()
    if not w:
        raise ToolError(f"心愿单 #{wishlist_id} 不存在或无权访问", code="NOT_FOUND")

    if listing_id is not None:
        item = db.execute(
            select(WishlistItem).where(
                WishlistItem.wishlist_id == wishlist_id,
                WishlistItem.listing_id == listing_id,
            )
        ).scalar_one_or_none()
        matched_id = listing_id
        matched_title = None
    else:
        # listing_name: 在该 wishlist 的 items 内模糊匹配, 取第一个
        stmt = (
            select(WishlistItem, Listing)
            .join(Listing, WishlistItem.listing_id == Listing.id)
            .where(
                WishlistItem.wishlist_id == wishlist_id,
                Listing.title.like(f"%{listing_name}%"),
            )
        )
        rows = db.execute(stmt).all()
        if not rows:
            return {
                "status": "not_found_by_name",
                "wishlist_id": wishlist_id,
                "wishlist_name": w.name,
                "listing_name": listing_name,
            }
        item, listing = rows[0]
        matched_id = listing.id
        matched_title = listing.title
        if len(rows) > 1:
            candidates = [
                {"listing_id": l.id, "title": l.title}
                for _, l in rows[:5]
            ]
            return {
                "status": "ambiguous_match",
                "wishlist_id": wishlist_id,
                "wishlist_name": w.name,
                "listing_name": listing_name,
                "matched_listing_id": matched_id,
                "matched_title": matched_title,
                "candidates": candidates,
            }

    if item is None:
        return {
            "status": "not_in_wishlist",
            "wishlist_id": wishlist_id,
            "wishlist_name": w.name,
            "listing_id": matched_id,
            "listing_title": matched_title,
        }

    db.delete(item)
    db.commit()
    return {
        "status": "removed",
        "wishlist_id": wishlist_id,
        "wishlist_name": w.name,
        "matched_listing_id": matched_id,
        "matched_title": matched_title,
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


# ============ Tool 8: create_booking ============

def _compute_booking_totals(listing: Listing, check_in: date, check_out: date) -> dict:
    """复用 app/api/bookings.py 的同款 nights/total 计算, 抽到这里共用."""
    if check_out <= check_in:
        raise ToolError("退房日期必须晚于入住日期", code="INVALID_ARGS")
    nights = (check_out - check_in).days
    price = Decimal(str(listing.price_per_night))
    cleaning = Decimal(str(listing.cleaning_fee or 0))
    service = Decimal(str(listing.service_fee or 0))
    subtotal = price * nights
    total = subtotal + cleaning + service
    return {
        "nights": nights,
        "subtotal": subtotal,
        "cleaning_fee": cleaning,
        "service_fee": service,
        "total": total,
    }


def create_booking(
    user: User, db,
    listing_id: int,
    check_in,  # date 或 ISO 字符串 (LLM 偶尔会传 str)
    check_out,
    guests: int = 1,
    **_kwargs,
) -> dict:
    """为当前用户下单. 抛 ToolError 表示业务错 (HITL 二次确认前会先暂停)."""
    # 参数规范化
    if isinstance(check_in, str):
        check_in = date.fromisoformat(check_in)
    if isinstance(check_out, str):
        check_out = date.fromisoformat(check_out)

    if guests < 1 or guests > 20:
        raise ToolError(f"人数 {guests} 超出合法范围 (1-20)", code="INVALID_ARGS")

    listing = db.get(Listing, listing_id)
    if not listing:
        raise ToolError(f"房源 #{listing_id} 不存在", code="NOT_FOUND")

    totals = _compute_booking_totals(listing, check_in, check_out)

    if guests > listing.max_guests:
        raise ToolError(
            f"该房源最多接待 {listing.max_guests} 位客人 (你输入 {guests})",
            code="INVALID_ARGS",
        )

    booking = Booking(
        user_id=user.id,
        listing_id=listing_id,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        nights=totals["nights"],
        subtotal=totals["subtotal"],
        cleaning_fee=totals["cleaning_fee"],
        service_fee=totals["service_fee"],
        total=totals["total"],
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    logger.info(
        "create_booking: user=%d listing=%d %s -> booking #%d (¥%s)",
        user.id, listing_id, check_in, booking.id, totals["total"],
    )

    return {
        "status": "confirmed",
        "booking_id": booking.id,
        "listing_id": listing_id,
        "listing_title": listing.title,
        "check_in": check_in.isoformat(),
        "check_out": check_out.isoformat(),
        "guests": guests,
        "nights": totals["nights"],
        "subtotal": float(totals["subtotal"]),
        "cleaning_fee": float(totals["cleaning_fee"]),
        "service_fee": float(totals["service_fee"]),
        "total": float(totals["total"]),
    }


# ============ Tool 9: list_my_trips ============

def list_my_trips(
    user: User, db,
    status: str | None = None,
    limit: int = 10,
    **_kwargs,
) -> dict:
    """查当前用户的所有订单, 可按 status 过滤 (pending/confirmed/cancelled/completed)."""
    valid_statuses = {"pending", "confirmed", "cancelled", "completed"}
    if status and status not in valid_statuses:
        raise ToolError(f"status 必须从 {valid_statuses} 中选", code="INVALID_ARGS")

    limit = min(max(limit, 1), 50)
    stmt = (
        select(Booking, Listing)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Booking.user_id == user.id)
        .order_by(Booking.check_in.desc(), Booking.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Booking.status == status)

    rows = db.execute(stmt).all()
    items = []
    for b, l in rows:
        items.append({
            "booking_id": b.id,
            "listing_id": b.listing_id,
            "listing_title": l.title if l else None,
            "listing_city": l.city if l else None,
            "check_in": b.check_in.isoformat() if b.check_in else None,
            "check_out": b.check_out.isoformat() if b.check_out else None,
            "guests": b.guests,
            "nights": b.nights,
            "total": float(b.total),
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })
    return {"count": len(items), "items": items}


# ============ Tool 10: parse_travel_plan_pdf ============

# 简易日期/城市正则 (兜底用, LLM 抽取失败时)
_RE_ISO_DATE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")
# 已知常见城市名 (其它城市 LLM 应能识别)
_KNOWN_CITIES = {
    "Tokyo", "Kyoto", "Osaka", "Paris", "London", "New York", "Los Angeles",
    "Barcelona", "Rome", "Milan", "Berlin", "Amsterdam", "Bangkok", "Singapore",
    "Seoul", "Sydney", "Melbourne", "Dubai", "Istanbul", "Cairo", "Bali",
    "Busan", "Hong Kong", "Taipei", "Shanghai", "Beijing", "Hanoi", "Ho Chi Minh",
    "Jakarta", "Manila", "Kuala Lumpur", "Phuket", "Chiang Mai",
}


def _regex_parse_plan(text: str) -> dict:
    """LLM 抽取失败时的兜底: regex 抽 ISO 日期 + 城市名"""
    dates = list(dict.fromkeys(_RE_ISO_DATE.findall(text)))[:10]
    cities = []
    for city in _KNOWN_CITIES:
        if re.search(rf"\b{re.escape(city)}\b", text, re.IGNORECASE):
            cities.append(city)
        if len(cities) >= 5:
            break
    return {
        "cities": cities,
        "dates": dates,
        "duration_days": len(dates) - 1 if len(dates) >= 2 else None,
        "themes": [],
        "guests_estimate": None,
        "budget_estimate": None,
    }


def parse_travel_plan_pdf(
    user: User, db,
    plan_text: str,
    **_kwargs,
) -> dict:
    """从已抽取的 PDF 文本中解析结构化字段. 优先 LLM, 失败降级 regex."""
    if not plan_text or not plan_text.strip():
        raise ToolError("plan_text 不能为空", code="INVALID_ARGS")

    fallback = _regex_parse_plan(plan_text)
    return {
        "status": "ok",
        "method": "regex",
        "parsed": fallback,
        "raw_excerpt": plan_text[:500],
        "note": "regex 抽取 (LLM 增强留给后续 Block)",
    }


def _parse_travel_plan_pdf_sync_placeholder(  # noqa
    user: User, db, plan_text: str, parsed: dict,
) -> dict:
    """保留占位避免 orphan import (实际用不上)"""
    fallback = _regex_parse_plan(plan_text)
    return {
        "status": "ok", "method": "llm" if parsed else "regex",
        "parsed": parsed or fallback, "raw_excerpt": plan_text[:500],
}


# ============ Tool 11: recommend_from_plan ============

def recommend_from_plan(
    user: User, db,
    plan_text: str,
    max_results: int = 5,
    **_kwargs,
) -> dict:
    """
    根据 PDF 文本推荐房源. 流程:
    1. 抽结构化 (LLM 优先, regex 兜底)
    2. 取首个城市 + text 前缀作为 query, 调 search_listings
    3. 返回房源 + 抽取的 plan summary
    """
    if not plan_text or not plan_text.strip():
        raise ToolError("plan_text 不能为空", code="INVALID_ARGS")

    # 1. 先 regex 兜底拿城市 (LLM 那条路要走 async, 暂用 regex 给 search_listings 用)
    fallback = _regex_parse_plan(plan_text)
    city = fallback["cities"][0] if fallback["cities"] else None

    # 2. 提取关键词 (从 themes 或 plan_text 第一个名词) 作为 q
    # 但 LIKE 模糊匹配不靠谱, 有 city 时直接用 city 过滤, q 留空
    # 让 LLM 通过 tool description 知道 plan_text 后, 可以独立调 search_listings(q=...) 细化
    search_kwargs = {
        "limit": min(max(max_results, 1), 20),
    }
    if city:
        search_kwargs["city"] = city
        # 不再传 q, 避免整段 LIKE 不命中
    else:
        # 没 city 时才退化到 q (兜底)
        short_q = plan_text[:16].strip()
        short_q = re.sub(r"[^\w\s]", " ", short_q).strip()
        if short_q:
            search_kwargs["q"] = short_q

    try:
        from app.services.agent.tools import search_listings
        search_result = search_listings(user=user, db=db, **search_kwargs)
    except ToolError as e:
        search_result = {"count": 0, "items": [], "warning": str(e)}

    return {
        "plan_summary": {
            "cities": fallback["cities"],
            "dates": fallback["dates"],
            "themes": fallback["themes"],
            "duration_days": fallback["duration_days"],
            "method": "regex",  # async LLM 抽取放后续 Block
        },
        "recommendations": search_result.get("items", []),
        "sources": "search_listings",
        "note": "parsing 走 regex 兜底; recommend 走 search_listings",
    }


# ============ Tool 12: search_travel_tips (RAG) ============

def search_travel_tips(
    user: User, db,
    query: str,
    top_k: int = 3,
    category: str | None = None,
    **_kwargs,
) -> dict:
    """RAG 检索: 从 travel_tips 知识库找最相关的贴士."""
    if not query or not query.strip():
        raise ToolError("query 不能为空", code="INVALID_ARGS")
    top_k = min(max(top_k, 1), 10)

    try:
        tips = retrieve_tips(db=db, query=query, top_k=top_k, category=category)
    except Exception as e:
        logger.exception("search_travel_tips failed")
        raise ToolError(f"RAG 检索失败: {e}", code="RAG_UNAVAILABLE")

    if tips and isinstance(tips[0], dict) and "error" in tips[0]:
        # embedding 模型加载失败的情况
        raise ToolError(tips[0]["error"], code="RAG_UNAVAILABLE")

    return {
        "count": len(tips),
        "query": query,
        "tips": tips,
    }


# ============ Tool dispatch (orchestrator 用) ============

TOOL_DISPATCH: dict[str, Any] = {
    "search_listings": search_listings,
    "get_listing_detail": get_listing_detail,
    "compare_listings": compare_listings,
    "add_to_wishlist": add_to_wishlist,
    "remove_from_wishlist": remove_from_wishlist,
    "create_wishlist": create_wishlist,
    "list_wishlists": list_wishlists,
    "create_booking": create_booking,
    "list_my_trips": list_my_trips,
    "parse_travel_plan_pdf": parse_travel_plan_pdf,
    "recommend_from_plan": recommend_from_plan,
    "search_travel_tips": search_travel_tips,
}
"""Tool name → 实现函数. orchestrator 按 tc.function.name 路由."""
