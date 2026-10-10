/** Block 15: Host dashboard API + Block 27: 房东端管理 */
import { api } from './client'
import type { ListingDetail } from '@/types/listing'
import type {
  HostMeResponse,
  HostDashboardResponse,
  HostListingStat,
  ListingFormData,
  HostBookingItem,
  HostBookingListResponse,
  HostBookingActionResponse,
  HostCalendarResponse,
} from '@/types/host'

export const hostApi = {
  /** 当前房东信息 */
  async getMe(): Promise<HostMeResponse> {
    const res = await api.get<HostMeResponse>('/host/me')
    return res.data
  },

  /** 当前房东所有房源 + 统计 */
  async getListings(): Promise<HostDashboardResponse> {
    const res = await api.get<HostDashboardResponse>('/host/listings')
    return res.data
  },

  /** 单个 listing 详细统计 */
  async getListingStats(listingId: number): Promise<HostListingStat> {
    const res = await api.get<HostListingStat>(`/host/listings/${listingId}/stats`)
    return res.data
  },

  /** 当前用户一键成为房东 (idempotent). 刷新 user 状态 */
  async becomeHost(): Promise<HostMeResponse> {
    const res = await api.post<HostMeResponse>('/host/become')
    return res.data
  },

  // ============ Block 27: 房源 CRUD ============

  /** 发布房源 */
  async createListing(data: ListingFormData): Promise<ListingDetail> {
    const res = await api.post<ListingDetail>('/host/listings', data)
    return res.data
  },

  /** 编辑房源 (部分更新, 只传变化字段) */
  async updateListing(listingId: number, data: Partial<ListingFormData>): Promise<ListingDetail> {
    const res = await api.patch<ListingDetail>(`/host/listings/${listingId}`, data)
    return res.data
  },

  /** 删除房源 (有订单时后端 409) */
  async deleteListing(listingId: number): Promise<void> {
    await api.delete(`/host/listings/${listingId}`)
  },

  // ============ Block 27: 房东订单管理 ============

  /** 房东收到的订单列表 (可按状态/房源筛选) */
  async getBookings(params: { status?: string; listing_id?: number } = {}): Promise<HostBookingListResponse> {
    const res = await api.get<HostBookingListResponse>('/host/bookings', { params })
    return res.data
  },

  /** 确认待支付订单 (线下收款) */
  async confirmBooking(bookingId: number): Promise<HostBookingActionResponse> {
    const res = await api.post<HostBookingActionResponse>(`/host/bookings/${bookingId}/confirm`)
    return res.data
  },

  /** 房东取消订单 */
  async cancelBooking(bookingId: number): Promise<HostBookingActionResponse> {
    const res = await api.post<HostBookingActionResponse>(`/host/bookings/${bookingId}/cancel`)
    return res.data
  },

  /** 完结已退房的订单 */
  async completeBooking(bookingId: number): Promise<HostBookingActionResponse> {
    const res = await api.post<HostBookingActionResponse>(`/host/bookings/${bookingId}/complete`)
    return res.data
  },

  // ============ Block 27: 房态日历 ============

  /** 某房源某月的占位区间 */
  async getListingCalendar(listingId: number, month: string): Promise<HostCalendarResponse> {
    const res = await api.get<HostCalendarResponse>(`/host/listings/${listingId}/calendar`, {
      params: { month },
    })
    return res.data
  },
}
