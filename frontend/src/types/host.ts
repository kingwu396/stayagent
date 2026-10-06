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
