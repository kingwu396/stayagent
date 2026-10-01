import { api } from './client'
import type { Booking, BookingCreate, BookingListResponse } from '@/types/booking'

export const bookingsApi = {
  async list(): Promise<BookingListResponse> {
    const res = await api.get<BookingListResponse>('/bookings')
    return res.data
  },

  async getById(id: number): Promise<Booking> {
    const res = await api.get<Booking>(`/bookings/${id}`)
    return res.data
  },

  async create(payload: BookingCreate): Promise<Booking> {
    const res = await api.post<Booking>('/bookings', payload)
    return res.data
  },

  async cancel(id: number): Promise<Booking> {
    const res = await api.post<Booking>(`/bookings/${id}/cancel`)
    return res.data
  },
}
