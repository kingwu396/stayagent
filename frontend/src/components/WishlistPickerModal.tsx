import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { X, ImageOff } from 'lucide-react'
import { useWishlistStore } from '@/stores/wishlist'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'
import type { ListingSummary } from '@/types/listing'

/** 弹窗开关（模块级全局，ListingCard 只管 open） */
interface WishlistPickerState {
  listing: ListingSummary | null
  open: (listing: ListingSummary) => void
  close: () => void
}

export const useWishlistPicker = create<WishlistPickerState>()((set) => ({
  listing: null,
  open: (listing) => set({ listing }),
  close: () => set({ listing: null }),
}))

const FALLBACK_IMAGE = 'https://picsum.photos/seed/placeholder/400/300'

/**
 * 「保存到心愿单」选择弹窗（Airbnb 样式）：
 * 2 列清单卡（首图 + 名称 + 已收藏 N 项，已保存打角标），
 * 点卡片在该清单内 toggle，底部黑按钮内联创建新清单并自动保存当前房源。
 */
export function WishlistPickerModal() {
  const listing = useWishlistPicker((s) => s.listing)
  const close = useWishlistPicker((s) => s.close)
  const lists = useWishlistStore((s) => s.lists)
  const fetchAll = useWishlistStore((s) => s.fetchAll)
  const toggleIn = useWishlistStore((s) => s.toggleIn)
  const createWishlist = useWishlistStore((s) => s.createWishlist)
  const toast = useToast()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const isLoggedIn = !!useAuthStore((s) => s.token)
  const visible = isLoggedIn && !!listing

  // 打开时拉最新清单（含 items.listing 摘要，缩略图用）
  useEffect(() => {
    if (visible) {
      fetchAll()
      setCreating(false)
      setNewName('')
    }
  }, [visible, fetchAll])

  // Esc 关闭 / 退出创建输入
  useEffect(() => {
    if (!visible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (creating) setCreating(false)
        else close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, creating, close])

  // 背景滚动锁定
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!visible || !listing) return null

  async function handleToggle(wishlistId: number) {
    if (!listing || submitting) return
    await toggleIn(wishlistId, listing.id)
  }

  async function handleCreate() {
    if (!listing) return
    const name = newName.trim()
    if (!name) {
      nameInputRef.current?.focus()
      return
    }
    setSubmitting(true)
    const wl = await createWishlist(name)
    if (wl) {
      await toggleIn(wl.id, listing.id)
      toast.success(`已保存到「${wl.name}」`)
      setCreating(false)
      setNewName('')
      close()
    } else {
      toast.error(useWishlistStore.getState().error || '创建失败')
    }
    setSubmitting(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="w-[560px] max-w-full bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="保存到心愿单"
      >
        {/* 头部：居中标题 + 右上关闭 */}
        <div className="relative py-4 border-b border-slate-100">
          <h2 className="text-center text-base font-semibold text-slate-900">保存到心愿单</h2>
          <button
            onClick={close}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 清单卡片 2 列网格 */}
        <div className="px-6 py-5 max-h-[400px] overflow-y-auto">
          {lists.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              还没有心愿单，创建一个开始收藏吧
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-5">
              {lists.map((wl) => {
                const saved = wl.items.some((it) => it.listing_id === listing.id)
                const thumb = wl.items[0]?.listing?.primary_image
                return (
                  <button
                    key={wl.id}
                    type="button"
                    onClick={() => handleToggle(wl.id)}
                    className="text-left group cursor-pointer"
                  >
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100">
                      {thumb ? (
                        <img
                          src={thumb || FALLBACK_IMAGE}
                          alt={wl.name}
                          loading="lazy"
                          onError={(e) => {
                            ;(e.target as HTMLImageElement).src = FALLBACK_IMAGE
                          }}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                          <ImageOff className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                      {saved && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/85 text-white text-xs font-medium rounded-md">
                          已保存
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-[15px] font-medium text-slate-900 truncate">
                      {wl.name}
                    </div>
                    <div className="text-sm text-slate-500">已收藏 {wl.items.length} 项</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部：创建新清单（点击后内联输入） */}
        <div className="px-6 pb-5 pt-1">
          {creating ? (
            <div className="flex items-center gap-2">
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                autoFocus
                maxLength={100}
                placeholder="清单名称"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
                className="flex-1 min-w-0 border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-900 transition"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-medium transition disabled:opacity-50 flex-shrink-0"
              >
                {submitting ? '创建中…' : '创建'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-black text-white text-[15px] font-medium transition"
            >
              创建新的心愿单
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
