"""Agent Tool 实际实现 (Block 9: 7 个核心 tool)

约定:
- 每个 tool 函数签名: (user: User, db: Session, **kwargs) -> dict
- 抛 ToolError(message, code) 表示业务错误, orchestrator 转成结构化错误给 LLM
- 返回 dict 让 LLM 看到结构化数据
- 同步函数 (直接读 DB), orchestrator 直接调用无需 await
- 例外: parse_travel_plan_pdf / recommend_from_plan 是 async (内部要调 LLM 抽取),
  orchestrator 派发点用 iscoroutine 兼容两种
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
from app.core.llm_client import get_llm_client
from app.services.agent.retry import retry_on_llm_error

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

# 简易日期/城市正则 (LLM 抽取失败时的兜底)
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


# LLM 结构化抽取 prompt: 字段与 regex 版完全同构, 下游 (AgentPlanCard / recommend_from_plan) 无感知
_LLM_EXTRACT_PROMPT = """你是旅行计划结构化助手。从旅行计划文本中抽取信息，只输出一个 JSON 对象，不要输出任何解释或 markdown 代码块。字段定义:
- "cities": 目的地城市数组（按文中出现顺序，最多 5 个，用文中原始写法，中英文均可）
- "duration_days": 行程天数（整数；无法判断为 null）
- "guests_estimate": 出行人数（整数；"带爸妈"=3 人、"一家三口"=3 人；无法判断为 null）
- "budget_estimate": 住宿预算（数字，每晚或总额按文义；无法判断为 null）
- "dates": 文中出现的具体日期（ISO 格式 YYYY-MM-DD 字符串数组，最多 10 个；无具体日期为空数组）
- "themes": 旅行主题标签数组（最多 5 个，如 ["亲子", "海岛", "购物"]；无则空数组）

旅行计划文本:
---
{plan_text}
---
"""


def _extract_json_object(text: str) -> Any:
    """从 LLM 回复中剥出 JSON 对象 (容忍 ``` 围栏 / 前后废话)"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("回复中不含 JSON 对象")
    return json.loads(text[start:end + 1])


def _str_list(v: Any, cap: int) -> list[str] | None:
    """校验 LLM 输出的数组字段: 非法返回 None, 合法裁剪到 cap"""
    if not isinstance(v, list):
        return None
    return [str(x).strip() for x in v if str(x).strip()][:cap]


def _int_or_none(v: Any) -> int | None:
    if isinstance(v, bool) or v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _num_or_none(v: Any) -> int | float | None:
    """预算字段: 允许小数, 整数则收敛为 int"""
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return int(f) if f.is_integer() else round(f, 2)


def _coerce_llm_plan(data: Any) -> dict | None:
    """校验并裁剪 LLM 输出到与 regex 版同构的 schema; 不合格返回 None"""
    if not isinstance(data, dict):
        return None
    cities = _str_list(data.get("cities"), 5)
    themes = _str_list(data.get("themes"), 5)
    dates = _str_list(data.get("dates"), 10)
    if not cities:
        return None  # 城市是核心字段, 抽不到视为整体失败
    duration = _int_or_none(data.get("duration_days"))
    if duration is None and len(dates or []) >= 2:
        duration = len(dates) - 1
    return {
        "cities": cities,
        "dates": dates or [],
        "duration_days": duration,
        "themes": themes or [],
        "guests_estimate": _int_or_none(data.get("guests_estimate")),
        "budget_estimate": _num_or_none(data.get("budget_estimate")),
    }


async def _llm_parse_plan(plan_text: str) -> dict | None:
    """LLM 结构化抽取. 任何失败返回 None, 由调用方降级 regex (单点 try 保证绝不向上抛)."""
    try:
        resp = await retry_on_llm_error(get_llm_client().chat)(
            messages=[
                {"role": "system", "content": "你只输出 JSON，不输出任何其他文字。"},
                {"role": "user", "content": _LLM_EXTRACT_PROMPT.format(plan_text=plan_text[:6000])},
            ],
            temperature=0.0,
            max_tokens=500,
        )
        data = _extract_json_object(resp["choices"][0]["message"]["content"] or "")
        return _coerce_llm_plan(data)
    except Exception as e:  # noqa: BLE001 - 兜底路径, 任何异常都降级 regex
        logger.warning("LLM plan 抽取失败, 降级 regex: %s: %s", type(e).__name__, e)
        return None


async def parse_travel_plan_pdf(
    user: User, db,
    plan_text: str,
    **_kwargs,
) -> dict:
    """从已抽取的 PDF 文本中解析结构化字段. LLM 优先, 失败降级 regex."""
    if not plan_text or not plan_text.strip():
        raise ToolError("plan_text 不能为空", code="INVALID_ARGS")

    parsed = await _llm_parse_plan(plan_text)
    if parsed is not None:
        return {
            "status": "ok",
            "method": "llm",
            "parsed": parsed,
            "raw_excerpt": plan_text[:500],
        }
    return {
        "status": "ok",
        "method": "regex",
        "parsed": _regex_parse_plan(plan_text),
        "raw_excerpt": plan_text[:500],
        "note": "LLM 抽取失败, 已降级 regex 兜底",
    }


# ============ Tool 11: recommend_from_plan ============

async def recommend_from_plan(
    user: User, db,
    plan_text: str,
    max_results: int = 5,
    **_kwargs,
) -> dict:
    """
    根据 PDF 文本推荐房源. 流程:
    1. 结构化抽取 (LLM 优先, regex 兜底)
    2. 取首个城市调 search_listings
    3. 返回房源 + 抽取的 plan summary
    """
    if not plan_text or not plan_text.strip():
        raise ToolError("plan_text 不能为空", code="INVALID_ARGS")

    # 1. 结构化抽取: LLM 优先 (能懂"带爸妈"=3人 / 任意城市), 失败降级 regex
    parsed = await _llm_parse_plan(plan_text)
    if parsed is not None:
        method = "llm"
    else:
        parsed = _regex_parse_plan(plan_text)
        method = "regex"
    city = parsed["cities"][0] if parsed["cities"] else None

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
            "cities": parsed["cities"],
            "dates": parsed["dates"],
            "themes": parsed["themes"],
            "duration_days": parsed["duration_days"],
            "guests_estimate": parsed["guests_estimate"],
            "budget_estimate": parsed["budget_estimate"],
            "method": method,
        },
        "recommendations": search_result.get("items", []),
        "sources": "search_listings",
        "note": "parsing LLM 优先 regex 兜底; recommend 走 search_listings",
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
