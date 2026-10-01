"""Pydantic schemas for wishlist endpoints"""
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

from app.schemas.listing import ListingSummary


class WishlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class WishlistItemResponse(BaseModel):
    id: int
    wishlist_id: int
    listing_id: int
    added_at: datetime
    listing: ListingSummary

    model_config = ConfigDict(from_attributes=True)


class WishlistResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    items: list[WishlistItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class WishlistSummaryResponse(BaseModel):
    """用于列表展示：含 item_count"""
    id: int
    name: str
    created_at: datetime
    item_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class WishlistItemCreate(BaseModel):
    """添加 listing 到 wishlist"""
    listing_id: int


class MigrateRequest(BaseModel):
    """匿名 → 登录迁移：把 localStorage ids 加到默认 wishlist"""
    listing_ids: list[int]


class MigrateResponse(BaseModel):
    """迁移结果"""
    wishlist_id: int
    added: int           # 实际新增的 item 数
    skipped: int         # 已存在跳过的数
