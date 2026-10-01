import type { ListingSummary } from './listing'

export interface WishlistItem {
  id: number
  wishlist_id: number
  listing_id: number
  added_at: string
  listing: ListingSummary
}

export interface Wishlist {
  id: number
  name: string
  created_at: string
  items: WishlistItem[]
}

export interface WishlistCreate {
  name: string
}

export interface WishlistItemCreate {
  listing_id: number
}

export interface MigrateRequest {
  listing_ids: number[]
}

export interface MigrateResponse {
  wishlist_id: number
  added: number
  skipped: number
}
