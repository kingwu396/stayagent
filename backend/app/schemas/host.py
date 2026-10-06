"""Host dashboard schemas (Block 15)"""
from pydantic import BaseModel, ConfigDict


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
