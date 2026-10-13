import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { wishlistsApi } from '@/api/wishlists'
import type { Wishlist } from '@/types/wishlist'
import { useAuthStore } from './auth'

interface WishlistState {
  // 服务端数据
  lists: Wishlist[]
  isLoading: boolean
  error: string | null

  // 匿名模式 fallback（localStorage 持久化）
  anonymousIds: number[]

  // ============ 统一接口（调用方不用关心登录态）============

  /** 拉服务端所有 wishlists（登录态有效） */
  fetchAll: () => Promise<void>

  /** toggle：已加→移除；未加→加到第一个 wishlist（无则自动建） */
  toggle: (listingId: number) => Promise<void>

  /** 在指定 wishlist 里 toggle（心愿单选择弹窗用）：在内→移除，不在→添加 */
  toggleIn: (wishlistId: number, listingId: number) => Promise<void>

  /** 从所有清单移除（卡片上再次点红心直接取消收藏用，覆盖同时在多个清单的情况） */
  removeFromAll: (listingId: number) => Promise<void>

  /** 当前是否已收藏 */
  has: (listingId: number) => boolean

  /** 查所有收藏的 listing_id（去重，用于匿名→登录迁移） */
  allListedIds: () => number[]

  /** 创建新清单 */
  createWishlist: (name: string) => Promise<Wishlist | null>

  /** 删除清单 */
  deleteWishlist: (id: number) => Promise<void>

  /** 从清单移除 listing */
  removeListing: (wishlistId: number, listingId: number) => Promise<void>

  /** 匿名 → 登录迁移 */
  migrateFromAnonymous: () => Promise<MigrateResponse | null>

  /** 清空匿名 ids（迁移成功后用） */
  clearAnonymous: () => void
}

import type { MigrateResponse } from '@/types/wishlist'

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      lists: [],
      isLoading: false,
      error: null,
      anonymousIds: [],

      async fetchAll() {
        if (!useAuthStore.getState().token) return
        set({ isLoading: true, error: null })
        try {
          const data = await wishlistsApi.list()
          set({ lists: data, isLoading: false })
        } catch (err: any) {
          set({ error: err.response?.data?.detail || err.message || '加载失败', isLoading: false })
        }
      },

      async toggle(listingId) {
        const auth = useAuthStore.getState()

        // ============ 匿名模式 ============
        if (!auth.token) {
          const current = get().anonymousIds
          const updated = current.includes(listingId)
            ? current.filter((x) => x !== listingId)
            : [...current, listingId]
          set({ anonymousIds: updated })
          return
        }

        // ============ 登录模式 ============
        const { lists } = get()
        // 找包含该 listing 的 wishlist（去重）
        const targetWl = lists.find((w) => w.items.some((it) => it.listing_id === listingId))
        if (targetWl) {
          // 已加 → 从该 wishlist 移除
          // Optimistic Update
          set({
            lists: lists.map((w) =>
              w.id === targetWl.id
                ? { ...w, items: w.items.filter((it) => it.listing_id !== listingId) }
                : w
            ),
          })
          try {
            await wishlistsApi.removeItem(targetWl.id, listingId)
          } catch (err) {
            // 回滚
            await get().fetchAll()
          }
        } else {
          // 未加 → 加到第一个 wishlist，无则自动建
          let targetId = lists[0]?.id
          if (!targetId) {
            try {
              const created = await wishlistsApi.create({ name: '我的心愿单' })
              targetId = created.id
              set({ lists: [created, ...get().lists] })
            } catch (err: any) {
              // 409 = 已存在同名清单（race condition），重新拉列表复用现有清单
              if (err.response?.status === 409) {
                await get().fetchAll()
                targetId = get().lists[0]?.id
                if (!targetId) {
                  set({ error: '创建默认清单失败' })
                  return
                }
              } else {
                set({ error: '创建默认清单失败' })
                return
              }
            }
          }
          // Optimistic
          set({
            lists: get().lists.map((w) =>
              w.id === targetId
                ? { ...w, items: [...w.items, { id: Date.now(), wishlist_id: targetId!, listing_id: listingId, added_at: new Date().toISOString(), listing: {} as any }] }
                : w
            ),
          })
          try {
            await wishlistsApi.addItem(targetId, { listing_id: listingId })
            await get().fetchAll() // 拉真实数据回填
          } catch (err) {
            await get().fetchAll()
          }
        }
      },

      async toggleIn(wishlistId, listingId) {
        if (!useAuthStore.getState().token) return
        const { lists } = get()
        const target = lists.find((w) => w.id === wishlistId)
        if (!target) return
        const isIn = target.items.some((it) => it.listing_id === listingId)

        // Optimistic
        set({
          lists: lists.map((w) =>
            w.id === wishlistId
              ? {
                  ...w,
                  items: isIn
                    ? w.items.filter((it) => it.listing_id !== listingId)
                    : [
                        ...w.items,
                        { id: Date.now(), wishlist_id: wishlistId, listing_id: listingId, added_at: new Date().toISOString(), listing: {} as any },
                      ],
                }
              : w
          ),
        })
        try {
          if (isIn) {
            await wishlistsApi.removeItem(wishlistId, listingId)
          } else {
            await wishlistsApi.addItem(wishlistId, { listing_id: listingId })
          }
          await get().fetchAll() // 拉真实数据回填（含 listing 摘要，弹窗缩略图用）
        } catch (err) {
          await get().fetchAll()
        }
      },

      async removeFromAll(listingId) {
        if (!useAuthStore.getState().token) return
        const { lists } = get()
        const containing = lists.filter((w) => w.items.some((it) => it.listing_id === listingId))
        if (containing.length === 0) return
        // Optimistic: 从所有清单一并移除
        set({
          lists: lists.map((w) => ({
            ...w,
            items: w.items.filter((it) => it.listing_id !== listingId),
          })),
        })
        try {
          await Promise.all(containing.map((w) => wishlistsApi.removeItem(w.id, listingId)))
        } catch {
          await get().fetchAll() // 回滚
        }
      },

      has(listingId) {
        const { lists, anonymousIds } = get()
        const auth = useAuthStore.getState()
        if (!auth.token) return anonymousIds.includes(listingId)
        return lists.some((w) => w.items.some((it) => it.listing_id === listingId))
      },

      allListedIds() {
        const { lists, anonymousIds } = get()
        const ids = new Set<number>()
        lists.forEach((w) => w.items.forEach((it) => ids.add(it.listing_id)))
        anonymousIds.forEach((id) => ids.add(id))
        return Array.from(ids)
      },

      async createWishlist(name) {
        if (!useAuthStore.getState().token) return null
        try {
          const wl = await wishlistsApi.create({ name })
          set({ lists: [wl, ...get().lists] })
          return wl
        } catch (err: any) {
          const detail = err.response?.data?.detail || err.message || '创建失败'
          set({ error: detail })
          return null
        }
      },

      async deleteWishlist(id) {
        if (!useAuthStore.getState().token) return
        // Optimistic
        set({ lists: get().lists.filter((w) => w.id !== id) })
        try {
          await wishlistsApi.delete(id)
        } catch (err) {
          await get().fetchAll()
        }
      },

      async removeListing(wishlistId, listingId) {
        // Optimistic
        set({
          lists: get().lists.map((w) =>
            w.id === wishlistId
              ? { ...w, items: w.items.filter((it) => it.listing_id !== listingId) }
              : w
          ),
        })
        try {
          await wishlistsApi.removeItem(wishlistId, listingId)
        } catch (err) {
          await get().fetchAll()
        }
      },

      async migrateFromAnonymous() {
        const { anonymousIds } = get()
        if (anonymousIds.length === 0) return null
        if (!useAuthStore.getState().token) return null
        try {
          const result = await wishlistsApi.migrate({ listing_ids: anonymousIds })
          await get().fetchAll() // 拉新状态
          return result
        } catch (err: any) {
          set({ error: '迁移失败' })
          return null
        }
      },

      clearAnonymous() {
        set({ anonymousIds: [] })
      },
    }),
    {
      name: 'stayagent-wishlist',
      partialize: (state) => ({
        anonymousIds: state.anonymousIds,
        lists: state.lists,  // F5 也能立刻恢复红心状态
      }),
    }
  )
)
