/** Block 15: Host dashboard API */
import { api } from './client'
import type {
  HostMeResponse,
  HostDashboardResponse,
  HostListingStat,
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
}
