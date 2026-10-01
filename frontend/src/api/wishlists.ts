import { api } from './client'
import type {
  Wishlist, WishlistCreate, WishlistItemCreate,
  MigrateRequest, MigrateResponse,
} from '@/types/wishlist'

export const wishlistsApi = {
  async list(): Promise<Wishlist[]> {
    const res = await api.get<Wishlist[]>('/wishlists')
    return res.data
  },

  async create(payload: WishlistCreate): Promise<Wishlist> {
    const res = await api.post<Wishlist>('/wishlists', payload)
    return res.data
  },

  async getById(id: number): Promise<Wishlist> {
    const res = await api.get<Wishlist>(`/wishlists/${id}`)
    return res.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/wishlists/${id}`)
  },

  async addItem(wishlistId: number, payload: WishlistItemCreate): Promise<void> {
    await api.post(`/wishlists/${wishlistId}/items`, payload)
  },

  async removeItem(wishlistId: number, listingId: number): Promise<void> {
    await api.delete(`/wishlists/${wishlistId}/items/${listingId}`)
  },

  async migrate(payload: MigrateRequest): Promise<MigrateResponse> {
    const res = await api.post<MigrateResponse>('/wishlists/migrate', payload)
    return res.data
  },
}
