import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WishlistState {
  ids: number[]
  toggle: (id: number) => void
  has: (id: number) => boolean
  clear: () => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (id) => {
        const current = get().ids
        set({
          ids: current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id],
        })
      },

      has: (id) => get().ids.includes(id),

      clear: () => set({ ids: [] }),
    }),
    {
      name: 'stayagent-wishlist',
    }
  )
)
