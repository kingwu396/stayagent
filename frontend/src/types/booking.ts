import type { ListingSummary } from './listing'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

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
