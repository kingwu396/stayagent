import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hotel, Plus, Trash2, X } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { ListingCard } from '@/components/ListingCard'
import { Skeleton } from '@/components/Skeleton'
import { ErrorState } from '@/components/ErrorState'
import { useWishlistStore } from '@/stores/wishlist'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/ConfirmModal'
import type { Wishlist } from '@/types/wishlist'

export function WishlistView() {
  const user = useAuthStore((s) => s.user)
  const lists = useWishlistStore((s) => s.lists)
  const isLoading = useWishlistStore((s) => s.isLoading)
  const error = useWishlistStore((s) => s.error)
  const fetchAll = useWishlistStore((s) => s.fetchAll)
  const createWishlist = useWishlistStore((s) => s.createWishlist)
  const deleteWishlist = useWishlistStore((s) => s.deleteWishlist)
  const removeListing = useWishlistStore((s) => s.removeListing)
  const migrateFromAnonymous = useWishlistStore((s) => s.migrateFromAnonymous)
  const clearAnonymous = useWishlistStore((s) => s.clearAnonymous)
  const anonymousIds = useWishlistStore((s) => s.anonymousIds)
  const allListedIds = useWishlistStore((s) => s.allListedIds)

  const toast = useToast()
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Wishlist | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [migrationInfo, setMigrationInfo] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // 匿名 → 登录迁移提示（仅当有匿名数据 + 还没迁移过）
  useEffect(() => {
    if (anonymousIds.length === 0) return
    if (lists.some((l) => l.items.length > 0)) return
    migrateFromAnonymous().then((result) => {
      if (result && result.added > 0) {
        clearAnonymous()
        setMigrationInfo(`已自动合并 ${result.added} 个未同步收藏到「我的心愿单」`)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalListings = lists.reduce((sum, w) => sum + w.items.length, 0)

  async function onCreate() {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    // 前端防重名，避免无意义请求
    if (lists.some((w) => w.name === name)) {
      toast.warning(`已存在同名清单「${name}」`)
      return
    }
    const wl = await createWishlist(name)
    if (wl) {
      setNewName('')
      setShowNewCollection(false)
      toast.success(`已创建「${wl.name}」`)
    } else {
      const err = useWishlistStore.getState().error
      toast.error(err || '创建失败')
    }
    setCreating(false)
  }

  async function onConfirmDelete() {
    if (!confirmDelete || deleting) return
    setDeleting(true)
    try {
      await deleteWishlist(confirmDelete.id)
      toast.info(`已删除「${confirmDelete.name}」`)
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Topbar */}
      <header className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-ink">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        {/* Title */}
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-2 tracking-tight">
            已收藏的房源
          </h1>
          <p className="text-sm text-stone-500">
            {totalListings > 0
              ? `共 ${totalListings} 处房源 · ${lists.length} 个清单`
              : '你还没有创建清单'}
          </p>
        </header>

        {/* Migration banner */}
        {migrationInfo && (
          <div className="mb-8 px-4 py-3 bg-moss-light border border-moss/30 rounded-md text-sm text-moss flex items-center justify-between">
            <span>{migrationInfo}</span>
            <button onClick={() => setMigrationInfo(null)} className="text-moss hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && lists.length === 0 && (
          <div className="space-y-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-paper border border-slate-200 rounded-md p-6">
                <Skeleton className="h-6 w-1/3 mb-6" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="space-y-3">
                      <Skeleton className="aspect-[4/3] rounded-lg" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <ErrorState description={error} onRetry={fetchAll} />
        )}

        {/* Empty */}
        {!isLoading && !error && lists.length === 0 && (
          <div className="text-center py-20 border-t border-b border-slate-200">
            <p className="text-xs uppercase tracking-wider text-stone-400 mb-3">
              — empty —
            </p>
            <h2 className="text-2xl text-ink mb-2">还没有收藏的房源</h2>
            <p className="text-stone-500 mb-6">
              Browse listings and tap the heart to save them here.
            </p>
            <Link
              to="/search"
              className="inline-block px-5 py-2.5 bg-ink text-white text-sm font-medium hover:bg-stone-700 transition rounded-md"
            >
              Browse listings
            </Link>
          </div>
        )}

        {/* Wishlists */}
        {!isLoading && !error && lists.map((wl, i) => (
          <section key={wl.id} className="mb-12 bg-paper border border-slate-200 rounded-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-xs text-stone-400">
                    [{String(i + 1).padStart(2, '0')}]
                  </span>
                  <h2 className="text-2xl font-bold text-ink tracking-tight">
                    {wl.name}
                  </h2>
                </div>
                <p className="text-xs text-stone-500 ml-9">
                  {wl.items.length} 处房源 · 创建于{' '}
                  {new Date(wl.created_at).toLocaleDateString('en-CA')}
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(wl)}
                className="text-stone-300 hover:text-red-600 transition p-1"
                aria-label="删除清单"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            {wl.items.length === 0 ? (
              <div className="px-6 py-10 text-center text-stone-400 text-sm">
                这条清单还是空的。
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wl.items.map((item) => (
                    <div key={item.id} className="relative group">
                      <ListingCard listing={item.listing} />
                      <button
                        onClick={() => removeListing(wl.id, item.listing_id)}
                        className="absolute top-2 right-12 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:md:opacity-100 hover:bg-red-50 transition shadow-sm"
                        aria-label="从清单移除"
                      >
                        <X className="w-3.5 h-3.5 text-stone-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}

        {/* New collection button */}
        {!isLoading && !error && (
          <div className="mt-8">
            {showNewCollection ? (
              <div className="bg-white border border-slate-300 rounded-md p-4 flex items-center gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="清单名，如「巴黎度假」"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCreate()
                    if (e.key === 'Escape') setShowNewCollection(false)
                  }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-ink focus:border-transparent outline-none text-sm"
                />
                <button
                  onClick={onCreate}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-2 bg-ink text-white text-sm font-medium rounded-md hover:bg-stone-700 disabled:bg-stone-300 transition"
                >
                  {creating ? '创建中…' : '创建'}
                </button>
                <button
                  onClick={() => { setShowNewCollection(false); setNewName('') }}
                  className="px-3 py-2 text-stone-500 text-sm hover:text-stone-700 transition"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-brand-500 border-b border-ink hover:border-brand-500 pb-0.5 transition"
              >
                <Plus className="w-4 h-4" />
                + 新建清单
              </button>
            )}
          </div>
        )}
      </main>

      {/* Delete confirm modal (Block 23: 通用 ConfirmModal, Esc/滚动锁/动画/pending) */}
      <ConfirmModal
        open={confirmDelete !== null}
        title="删除清单？"
        description={
          confirmDelete ? (
            <>
              「<span className="font-medium">{confirmDelete.name}</span>
              」及其中的 {confirmDelete.items.length} 个房源将被永久删除。
            </>
          ) : (
            ''
          )
        }
        confirmText="确认删除"
        loading={deleting}
        onConfirm={onConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
