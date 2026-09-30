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

/** 详情页用：ListingResponse 全部 22 字段 */
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
