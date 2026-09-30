import { api } from './client'
import type { ListingListResponse, CityInfo } from '@/types/listing'

export interface ListListingsParams {
  page?: number
  page_size?: number
  city?: string
  property_type?: string
}

export const listingsApi = {
  async list(params: ListListingsParams = {}): Promise<ListingListResponse> {
    const res = await api.get<ListingListResponse>('/listings', { params })
    return res.data
  },

  async cities(): Promise<CityInfo[]> {
    const res = await api.get<CityInfo[]>('/listings/cities')
    return res.data
  },
}
