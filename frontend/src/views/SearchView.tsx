import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { CompactTopbar } from '@/components/CompactTopbar'
import { EMPTY_GUESTS, type CompactSearchState } from '@/hooks/useCompactSearch' 
import { ListingCard } from '@/components/ListingCard'
import { ListingCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { listingsApi } from '@/api/listings'
import type { ListingSummary, CityInfo } from '@/types/listing'

const PAGE_SIZE = 20

/** 从 URL 解析出 CompactSearchState */
function parseSearchFromURL(sp: URLSearchParams): CompactSearchState {
  const minGuestsRaw = sp.get('min_guests')
  const minGuests = minGuestsRaw ? parseInt(minGuestsRaw) : 0
  return {
    city: sp.get('city') || '',
    checkIn: sp.get('check_in') || '',
    checkOut: sp.get('check_out') || '',
    guests: {
      ...EMPTY_GUESTS,
      adults: minGuests > 0 ? minGuests : 0,
    },
  }
}

/** 把 CompactSearchState 写到 URL（保留 page） */
function applyToURL(current: URLSearchParams, s: CompactSearchState): URLSearchParams {
  const next = new URLSearchParams(current)
  function setOrDel(k: string, v: string) {
    if (v) next.set(k, v)
    else next.delete(k)
  }
  setOrDel('city', s.city.trim())
  setOrDel('check_in', s.checkIn)
  setOrDel('check_out', s.checkOut)
  const g = s.guests.adults + s.guests.children
  setOrDel('min_guests', g > 0 ? String(g) : '')
  next.delete('page')
  return next
}

export function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = useMemo(() => parseSearchFromURL(searchParams), [searchParams])
  const pageParam = parseInt(searchParams.get('page') || '1')

  const [items, setItems] = useState<ListingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadedPage, setLoadedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cities, setCities] = useState<CityInfo[]>([])

  const reqIdRef = useRef(0)

  // 拉城市列表
  useEffect(() => {
    listingsApi.cities().then(setCities).catch(() => setCities([]))
  }, [])

  // 拉一页数据
  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      const myId = ++reqIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        const data = await listingsApi.list({
          page,
          page_size: PAGE_SIZE,
          city: search.city || undefined,
          min_guests:
            search.guests.adults + search.guests.children > 0
              ? search.guests.adults + search.guests.children
              : undefined,
        })
        if (myId !== reqIdRef.current) return
        setTotal(data.total)
        setItems((prev) => {
          if (!append) return data.items
          const seen = new Set(prev.map((x) => x.id))
          const merged = [...prev]
          for (const item of data.items) if (!seen.has(item.id)) merged.push(item)
          return merged
        })
        setLoadedPage(page)
      } catch (err: any) {
        if (myId !== reqIdRef.current) return
        setError(err.response?.data?.detail || err.message || '加载失败')
      } finally {
        if (myId === reqIdRef.current) setIsLoading(false)
      }
    },
    [search.city, search.guests.adults, search.guests.children]
  )

  // filter 变化 → 重置 + 拉第 1 页
  useEffect(() => {
    setItems([])
    setLoadedPage(1)
    fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.city, search.guests.adults, search.guests.children])

  // 用户点 Load More
  function loadMore() {
    const nextPage = loadedPage + 1
    fetchPage(nextPage, true)
    setSearchParams((sp) => {
      const np = new URLSearchParams(sp)
      np.set('page', String(nextPage))
      return np
    })
  }

  // CompactTopbar 搜索回调：更新 URL
  const handleSearch = useCallback(
    (s: CompactSearchState) => {
      setSearchParams((sp) => applyToURL(sp, s))
    },
    [setSearchParams]
  )

  const hasMore = items.length < total
  const isInitialLoad = isLoading && items.length === 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部紧凑搜索条（始终可见） */}
      <CompactTopbar
        visible={true}
        initial={search}
        recommended={cities}
        onSearch={handleSearch}
      />

      {/* 占位：让内容从 topbar 下方开始 */}
      <div className="h-16 md:h-[72px]" />

      {/* Results */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {!error && !isInitialLoad && (
              <>{total > 0 ? `${total} 处住宿` : '暂无住宿'}</>
            )}
            {error && '加载失败'}
          </h1>
          {search.city && !error && (
            <p className="text-sm text-slate-500">
              在 <span className="font-medium">{search.city}</span>
              {search.guests.adults + search.guests.children > 0 &&
                ` · ${search.guests.adults + search.guests.children} 位客人`}
              {(search.checkIn || search.checkOut) && ` · ${search.checkIn} → ${search.checkOut}`}
            </p>
          )}
        </div>

        {/* Initial skeleton */}
        {isInitialLoad && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!isInitialLoad && error && (
          <ErrorState description={error} onRetry={() => fetchPage(1, false)} />
        )}

        {/* Empty */}
        {!isInitialLoad && !error && items.length === 0 && (
          <EmptyState
            title="暂无住宿"
            description="试试调整筛选条件，或者换一个城市"
          />
        )}

        {/* Grid */}
        {!error && items.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {items.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>

            {hasMore && (
              <div className="flex flex-col items-center mt-12 gap-2">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-8 py-3 border-2 border-slate-300 hover:border-brand-500 hover:text-brand-500 disabled:opacity-50 rounded-xl font-medium transition flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? '加载中...' : '加载更多'}
                </button>
                <p className="text-sm text-slate-500">
                  已显示 {items.length} / {total}
                </p>
              </div>
            )}

            {!hasMore && items.length > 0 && (
              <p className="text-center text-sm text-slate-500 mt-12 py-4">
                已显示全部 {total} 处住宿
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
