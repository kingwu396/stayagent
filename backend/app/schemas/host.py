"""Host dashboard schemas (Block 15) + 房东端管理 schemas (Block 27)"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

PropertyTypeLiteral = Literal["apartment", "house", "villa", "hotel", "studio"]


class HostListingStat(BaseModel):
    """单个 listing 的 host 视角统计"""
    listing_id: int
    title: str
    city: str
    property_type: str
    price_per_night: str  # Decimal as string
    primary_image: str | None
    view_count: int
    booking_count: int
    confirmed_revenue: str  # Decimal as string, confirmed bookings sum
    pending_revenue: str
    occupancy_status: str  # 'available' | 'pending' | 'confirmed' (from latest booking)

    model_config = ConfigDict(from_attributes=True)


class HostMeResponse(BaseModel):
    """房东基本信息"""
    id: int
    email: str
    username: str
    is_host: bool
    listing_count: int
    total_views: int
    total_confirmed_revenue: str

    model_config = ConfigDict(from_attributes=True)


class HostDashboardResponse(BaseModel):
    """房东后台列表 (含聚合统计)"""
    total_listings: int
    total_views: int
    total_confirmed_revenue: str
    total_pending_revenue: str
    items: list[HostListingStat]


# ============ Block 27: 房源 CRUD ============

class ListingCreateRequest(BaseModel):
    """发布房源. host_name 由后端取 current_user.username, 不接受前端传入"""
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    city: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=1, max_length=100)
    property_type: PropertyTypeLiteral
    price_per_night: Decimal = Field(gt=0)
    cleaning_fee: Decimal = Field(default=Decimal("0"), ge=0)
    service_fee: Decimal = Field(default=Decimal("0"), ge=0)
    max_guests: int = Field(default=1, ge=1, le=20)
    bedrooms: int = Field(default=1, ge=1)
    beds: int = Field(default=1, ge=1)
    bathrooms: int = Field(default=1, ge=1)
    amenities: list[str] = []
    images: list[str] = Field(default=[], max_length=10)
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class ListingUpdateRequest(BaseModel):
    """编辑房源 (全部可选, exclude_unset 部分更新). 城市改了 country 也要跟着给"""
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    city: str | None = Field(default=None, min_length=1, max_length=100)
    country: str | None = Field(default=None, min_length=1, max_length=100)
    property_type: PropertyTypeLiteral | None = None
    price_per_night: Decimal | None = Field(default=None, gt=0)
    cleaning_fee: Decimal | None = Field(default=None, ge=0)
    service_fee: Decimal | None = Field(default=None, ge=0)
    max_guests: int | None = Field(default=None, ge=1, le=20)
    bedrooms: int | None = Field(default=None, ge=1)
    beds: int | None = Field(default=None, ge=1)
    bathrooms: int | None = Field(default=None, ge=1)
    amenities: list[str] | None = None
    images: list[str] | None = Field(default=None, max_length=10)
    latitude: Decimal | None = None
    longitude: Decimal | None = None


# ============ Block 27: 房东订单管理 ============

class HostBookingItem(BaseModel):
    """房东视角的订单 (含房客名 + 房源摘要)"""
    id: int
    listing_id: int
    listing_title: str
    listing_image: str | None
    guest_username: str
    check_in: date
    check_out: date
    guests: int
    nights: int
    total: str  # Decimal as string
    status: str
    cancel_reason: str | None = None  # Block 28: cancelled 时的取消原因 user/host/expired
    created_at: datetime


class HostBookingListResponse(BaseModel):
    items: list[HostBookingItem]
    total: int


# ============ Block 27: 房态日历 ============

class HostCalendarBooking(BaseModel):
    """日历上的一个占位区间 (占的是 [check_in, check_out) 的夜晚)"""
    booking_id: int
    check_in: date
    check_out: date
    status: str  # pending | confirmed


class HostCalendarResponse(BaseModel):
    listing_id: int
    month: str  # "YYYY-MM"
    items: list[HostCalendarBooking]
