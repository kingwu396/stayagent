import { api } from './client'
import type {
  ListingListResponse,
  CityInfo,
  ListingDetail,
  FilterOptions,
  PlaceType,
} from '@/types/listing'

export interface ListListingsParams {
  page?: number
  page_size?: number
  city?: string
  property_type?: string
  place_type?: PlaceType
  property_types?: string[]
  min_price?: number
  max_price?: number
  min_guests?: number
  min_bedrooms?: number
  max_bedrooms?: number
  min_beds?: number
  max_beds?: number
  min_bathrooms?: number
  max_bathrooms?: number
  amenities?: string[]   // 后端用逗号分隔 join
  q?: string
}

export const listingsApi = {
  async list(params: ListListingsParams = {}): Promise<ListingListResponse> {
    // amenities/property_types 数组转逗号分隔字符串
    const apiParams: Record<string, string | number | string[] | undefined> = { ...params }
    if (params.amenities && params.amenities.length > 0) {
      apiParams.amenities = params.amenities.join(',')
    }
    if (params.property_types && params.property_types.length > 0) {
      apiParams.property_types = params.property_types.join(',')
    }
    // 后端不需要 place_type='any'
    if (apiParams.place_type === 'any' || !apiParams.place_type) {
      delete apiParams.place_type
    }
    const res = await api.get<ListingListResponse>('/listings', { params: apiParams })
    return res.data
  },

  async getById(id: number): Promise<ListingDetail> {
    const res = await api.get<ListingDetail>(`/listings/${id}`)
    return res.data
  },

  async cities(): Promise<CityInfo[]> {
    const res = await api.get<CityInfo[]>('/listings/cities')
    return res.data
  },

  async filterOptions(params: { city?: string } = {}): Promise<FilterOptions> {
    const res = await api.get<FilterOptions>('/listings/filter-options', { params })
    return res.data
  },
}
