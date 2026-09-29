"""Pydantic schemas for listings"""
from datetime import datetime
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


PropertyType = Literal["apartment", "house", "villa", "hotel", "studio"]


# ============ Output schemas ============

class ListingSummary(BaseModel):
    """卡片用：精简字段"""
    id: int
    title: str
    city: str
    country: str
    property_type: str
    price_per_night: Decimal
    rating: Decimal
    review_count: int
    primary_image: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ListingResponse(BaseModel):
    """详情用：完整字段"""
    id: int
    title: str
    description: str | None
    host_name: str
    city: str
    country: str
    latitude: Decimal | None
    longitude: Decimal | None
    property_type: str
    price_per_night: Decimal
    cleaning_fee: Decimal
    service_fee: Decimal
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: int
    rating: Decimal
    review_count: int
    amenities: list[str] = []
    images: list[str] = []
    primary_image: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ListingListResponse(BaseModel):
    """分页列表包装"""
    items: list[ListingSummary]
    total: int
    page: int
    page_size: int


class CityInfo(BaseModel):
    """城市筛选下拉用"""
    city: str
    country: str
    count: int


# ============ Query params ============

class ListingQuery(BaseModel):
    """列表过滤参数（用 BaseModel 而非 FastAPI Depends 简化）"""
    city: str | None = None
    property_type: PropertyType | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    min_guests: int | None = Field(default=None, ge=1)
    q: str | None = Field(default=None, description="标题模糊搜索")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
