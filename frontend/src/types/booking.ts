import type { ListingSummary } from './listing'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

/** Block 28: 取消原因 — user(房客取消) / host(房东取消) / expired(超时未支付) */
export type BookingCancelReason = 'user' | 'host' | 'expired'

export interface Booking {
  id: number
  listing_id: number
  listing: ListingSummary
  check_in: string
  check_out: string
  guests: number
  nights: number
  subtotal: string
  cleaning_fee: string
  service_fee: string
  total: string
  status: BookingStatus
  cancel_reason: BookingCancelReason | null
  created_at: string
}

export interface BookingCreate {
  listing_id: number
  check_in: string
  check_out: string
  guests: number
}

export interface BookingListResponse {
  items: Booking[]
  total: number
}
