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
