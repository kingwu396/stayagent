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
  /** 按 id 批量查（最近浏览），后端按传入顺序返回 */
  ids?: number[]
  /** 排序：view_count = 浏览量降序（主页热门板块）；默认评分 */
  sort?: 'view_count'
}

export const listingsApi = {
  async list(params: ListListingsParams = {}): Promise<ListingListResponse> {
    // 数组参数转逗号分隔字符串
    const { ids, amenities, property_types, place_type, ...rest } = params
    const apiParams: Record<string, string | number | string[] | undefined> = { ...rest }
    if (amenities && amenities.length > 0) {
      apiParams.amenities = amenities.join(',')
    }
    if (property_types && property_types.length > 0) {
      apiParams.property_types = property_types.join(',')
    }
    if (ids && ids.length > 0) {
      apiParams.ids = ids.join(',')
    }
    // 后端不需要 place_type='any'
    if (place_type === 'any' || !place_type) {
      delete apiParams.place_type
    } else {
      apiParams.place_type = place_type
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
