// 对齐后端 app/schemas/listing.py 的输出
// Decimal 字段在 JSON 里是 string，前端按 string 处理
export interface ListingSummary {
  id: number
  title: string
  city: string
  country: string
  property_type: string
  price_per_night: string
  rating: string
  review_count: number
  primary_image: string | null
  latitude: string | null
  longitude: string | null
}

export interface ListingListResponse {
  items: ListingSummary[]
  total: number
  page: number
  page_size: number
}

export interface CityInfo {
  city: string
  country: string
  count: number
}

/** 详情页用：ListingResponse 全部 22字段 */
export interface ListingDetail {
  id: number
  title: string
  description: string | null
  host_name: string
  city: string
  country: string
  latitude: string | null
  longitude: string | null
  property_type: string
  price_per_night: string
  cleaning_fee: string
  service_fee: string
  max_guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  rating: string
  review_count: number
  amenities: string[]
  images: string[]
  primary_image: string | null
  created_at: string
}

// ============ 筛选选项（modal 用） ============

export interface PriceBucket {
  min: string
  max: string
  count: number
}

export interface AmenityCount {
  name: string
  count: number
}

export interface PropertyTypeCount {
  type: string
  count: number
}

export interface FilterOptions {
  price_buckets: PriceBucket[]
  min_price: string
  max_price: string
  amenities_counts: AmenityCount[]
  property_type_counts: PropertyTypeCount[]
  bedroom_counts: number[]
  bathroom_counts: number[]
}

// ============ 筛选状态（URL 双向同步） ============

export type PlaceType = 'any' | 'room' | 'entire'

export interface FilterState {
  city: string                       // 与 search 共享
  place_type: PlaceType
  /** 多选房源类型（来自"建筑类型"区）：house / apartment / studio / hotel */
  property_types: string[]
  min_price: string
  max_price: string
  min_bedrooms: number
  min_beds: number
  min_bathrooms: number
  amenities: string[]
}
