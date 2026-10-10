/** Block 15: Host dashboard types (对齐 backend app/schemas/host.py) */

export interface HostListingStat {
  listing_id: number
  title: string
  city: string
  property_type: string
  price_per_night: string
  primary_image: string | null
  view_count: number
  booking_count: number
  confirmed_revenue: string
  pending_revenue: string
  occupancy_status: 'available' | 'pending' | 'confirmed' | 'cancelled' | 'completed'
}

export interface HostMeResponse {
  id: number
  email: string
  username: string
  is_host: boolean
  listing_count: number
  total_views: number
  total_confirmed_revenue: string
}

export interface HostDashboardResponse {
  total_listings: number
  total_views: number
  total_confirmed_revenue: string
  total_pending_revenue: string
  items: HostListingStat[]
}

// ============ Block 27: 房源 CRUD ============

export interface ListingFormData {
  title: string
  description: string | null
  city: string
  country: string
  property_type: 'apartment' | 'house' | 'villa' | 'hotel' | 'studio'
  price_per_night: string
  cleaning_fee: string
  service_fee: string
  max_guests: number
  bedrooms: number
  beds: number
  bathrooms: number
  amenities: string[]
  images: string[]
  latitude: string | null
  longitude: string | null
}

// ============ Block 27: 房东订单管理 ============

export interface HostBookingItem {
  id: number
  listing_id: number
  listing_title: string
  listing_image: string | null
  guest_username: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  total: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  cancel_reason: 'user' | 'host' | 'expired' | null
  created_at: string
}

export interface HostBookingListResponse {
  items: HostBookingItem[]
  total: number
}

export interface HostBookingActionResponse {
  id: number
  status: string
}

// ============ Block 27: 房态日历 ============

export interface HostCalendarBooking {
  booking_id: number
  check_in: string
  check_out: string
  status: 'pending' | 'confirmed'
}

export interface HostCalendarResponse {
  listing_id: number
  month: string
  items: HostCalendarBooking[]
}
