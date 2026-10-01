"""Wishlist API"""
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.deps import CurrentUser, DBSession
from app.models import Wishlist, WishlistItem, Listing
from app.schemas.wishlist import (
    WishlistCreate, WishlistResponse, WishlistSummaryResponse,
    WishlistItemResponse, WishlistItemCreate,
    MigrateRequest, MigrateResponse,
)


router = APIRouter()


def _to_item_with_listing(item: WishlistItem) -> WishlistItemResponse:
    """DB row → response（含 listing 摘要）"""
    return WishlistItemResponse(
        id=item.id,
        wishlist_id=item.wishlist_id,
        listing_id=item.listing_id,
        added_at=item.added_at,
        listing=item.listing,  # relationship 已 load
    )


def _to_wishlist(w: Wishlist) -> WishlistResponse:
    return WishlistResponse(
        id=w.id,
        name=w.name,
        created_at=w.created_at,
        items=[_to_item_with_listing(it) for it in (w.items or [])],
    )


# ============ Wishlist CRUD ============

@router.get("", response_model=list[WishlistResponse])
async def list_wishlists(current_user: CurrentUser, db: DBSession):
    """当前用户的所有 wishlist（含 items + listing）"""
    stmt = (
        select(Wishlist)
        .where(Wishlist.user_id == current_user.id)
        .options(selectinload(Wishlist.items).selectinload(WishlistItem.listing))
        .order_by(Wishlist.created_at.desc())
    )
    items = db.execute(stmt).scalars().all()
    return [_to_wishlist(w) for w in items]


@router.post("", response_model=WishlistResponse, status_code=status.HTTP_201_CREATED)
async def create_wishlist(payload: WishlistCreate, current_user: CurrentUser, db: DBSession):
    """创建新 wishlist（同名会 409）"""
    existing = db.execute(
        select(Wishlist).where(
            Wishlist.user_id == current_user.id,
            Wishlist.name == payload.name,
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="已存在同名清单")

    wishlist = Wishlist(user_id=current_user.id, name=payload.name)
    db.add(wishlist)
    db.commit()
    db.refresh(wishlist)
    return _to_wishlist(wishlist)


@router.get("/{wishlist_id}", response_model=WishlistResponse)
async def get_wishlist(wishlist_id: int, current_user: CurrentUser, db: DBSession):
    """详情（含 items）。跨用户返回 404 防枚举"""
    stmt = (
        select(Wishlist)
        .where(Wishlist.id == wishlist_id, Wishlist.user_id == current_user.id)
        .options(selectinload(Wishlist.items).selectinload(WishlistItem.listing))
    )
    w = db.execute(stmt).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="清单不存在")
    return _to_wishlist(w)


@router.delete("/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_wishlist(wishlist_id: int, current_user: CurrentUser, db: DBSession):
    """删除（CASCADE items）"""
    w = db.execute(
        select(Wishlist).where(
            Wishlist.id == wishlist_id,
            Wishlist.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="清单不存在")
    db.delete(w)
    db.commit()


# ============ Wishlist Items ============

@router.post(
    "/{wishlist_id}/items",
    response_model=WishlistItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_item(
    wishlist_id: int,
    payload: WishlistItemCreate,
    current_user: CurrentUser,
    db: DBSession,
):
    """添加 listing 到清单（重复添加 200 重复返回已存在 item）"""
    w = db.execute(
        select(Wishlist).where(
            Wishlist.id == wishlist_id,
            Wishlist.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="清单不存在")

    # 校验 listing 存在
    listing = db.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="房源不存在")

    # 已存在？直接返回
    existing = db.execute(
        select(WishlistItem).where(
            WishlistItem.wishlist_id == wishlist_id,
            WishlistItem.listing_id == payload.listing_id,
        )
    ).scalar_one_or_none()
    if existing:
        existing.listing = listing  # for response
        return _to_item_with_listing(existing)

    item = WishlistItem(wishlist_id=wishlist_id, listing_id=payload.listing_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    item.listing = listing
    return _to_item_with_listing(item)


@router.delete(
    "/{wishlist_id}/items/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_item(
    wishlist_id: int,
    listing_id: int,
    current_user: CurrentUser,
    db: DBSession,
):
    """从清单移除 listing"""
    w = db.execute(
        select(Wishlist).where(
            Wishlist.id == wishlist_id,
            Wishlist.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="清单不存在")

    item = db.execute(
        select(WishlistItem).where(
            WishlistItem.wishlist_id == wishlist_id,
            WishlistItem.listing_id == listing_id,
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="清单内无此房源")

    db.delete(item)
    db.commit()


# ============ Migration (anon → logged in) ============

@router.post("/migrate", response_model=MigrateResponse)
async def migrate(payload: MigrateRequest, current_user: CurrentUser, db: DBSession):
    """
    把匿名 localStorage 里的 listing_ids 加到用户的默认 wishlist。
    - 没有默认 wishlist 就自动建
    - 已存在的 listing 跳过
    - 不重复建 wishlist
    """
    if not payload.listing_ids:
        raise HTTPException(status_code=400, detail="listing_ids 不能为空")

    # 找或建默认 wishlist
    default_wl = db.execute(
        select(Wishlist).where(
            Wishlist.user_id == current_user.id,
            Wishlist.name == "我的心愿单",
        )
    ).scalar_one_or_none()
    if not default_wl:
        default_wl = Wishlist(user_id=current_user.id, name="我的心愿单")
        db.add(default_wl)
        db.commit()
        db.refresh(default_wl)

    added = 0
    skipped = 0
    for lid in payload.listing_ids:
        # 校验 listing 存在
        if not db.get(Listing, lid):
            skipped += 1
            continue
        # 已存在？
        dup = db.execute(
            select(WishlistItem).where(
                WishlistItem.wishlist_id == default_wl.id,
                WishlistItem.listing_id == lid,
            )
        ).scalar_one_or_none()
        if dup:
            skipped += 1
            continue
        db.add(WishlistItem(wishlist_id=default_wl.id, listing_id=lid))
        added += 1

    db.commit()
    return MigrateResponse(wishlist_id=default_wl.id, added=added, skipped=skipped)
