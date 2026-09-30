import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Hotel, Loader2 } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { FilterBar } from '@/components/FilterBar'
import { ListingCard } from '@/components/ListingCard'
import { ListingCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { listingsApi } from '@/api/listings'
import type { ListingSummary } from '@/types/listing'
import type { CityInfo } from '@/types/listing'
import type { FilterValues } from '@/components/FilterModal'

const PAGE_SIZE = 20
const EMPTY_FILTERS: FilterValues = {
  city: '',
  property_type: [],
  min_price: '',
  max_price: '',
  min_guests: '',
  check_in: '',
  check_out: '',
}

/** 从 URLSearchParams 解析出 FilterValues */
function parseFromURL(sp: URLSearchParams): FilterValues {
  return {
    city: sp.get('city') || '',
    property_type: sp.get('property_type')?.split(',').filter(Boolean) || [],
    min_price: sp.get('min_price') || '',
    max_price: sp.get('max_price') || '',
    min_guests: sp.get('min_guests') || '',
    check_in: sp.get('check_in') || '',
    check_out: sp.get('check_out') || '',
  }
}

/** 把 FilterValues 写到 URL（保留 page 参数） */
function applyToURL(current: URLSearchParams, values: FilterValues): URLSearchParams {
  const next = new URLSearchParams(current)
  function setOrDel(k: string, v: string | null) {
    if (v) next.set(k, v)
    else next.delete(k)
  }
  setOrDel('city', values.city || null)
  setOrDel('property_type', values.property_type.length ? values.property_type.join(',') : null)
  setOrDel('min_price', values.min_price || null)
  setOrDel('max_price', values.max_price || null)
  setOrDel('min_guests', values.min_guests || null)
  // 日期 placeholder：不实际传
  // filter 变更 → 重置 page
  next.delete('page')
  return next
}

export function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => parseFromURL(searchParams), [searchParams])
  const pageParam = parseInt(searchParams.get('page') || '1')

  const [items, setItems] = useState<ListingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadedPage, setLoadedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cities, setCities] = useState<CityInfo[]>([])

  const reqIdRef = useRef(0) // 防止旧请求覆盖新结果

  // 拉城市列表（一次性）
  useEffect(() => {
    listingsApi.cities().then(setCities).catch(() => setCities([]))
  }, [])

  // filter 变更 → 重置
  useEffect(() => {
    setItems([])
    setLoadedPage(1)
    setError(null)
  }, [filters.city, filters.property_type.join(','), filters.min_price, filters.max_price, filters.min_guests, filters.q])

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
          city: filters.city || undefined,
          property_type: filters.property_type[0], // API 只支持单选，多选时先按第一个查（TODO）
          min_price: filters.min_price ? Number(filters.min_price) : undefined,
          max_price: filters.max_price ? Number(filters.max_price) : undefined,
          min_guests: filters.min_guests ? Number(filters.min_guests) : undefined,
          q: filters.q || undefined,
        })
        if (myId !== reqIdRef.current) return // 过期请求
        setTotal(data.total)
        setItems((prev) => {
          if (!append) return data.items
          // 去重
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
    [filters]
  )

  // 触发拉数据：filter 变 → page=1 替换；page 变 → 追加
  useEffect(() => {
    const filterChanged = loadedPage === 0 // initial
    if (filterChanged) {
      // skip - handled below
    }
  }, [])

  // 首次加载 / filter 变化 → fetch page 1
  useEffect(() => {
    // 只在 filter 引发的重置后跑
    setLoadedPage(0)
    fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.property_type.join(','), filters.min_price, filters.max_price, filters.min_guests, filters.q])

  // 用户点 Load More → 拉下一页
  function loadMore() {
    const nextPage = loadedPage + 1
    fetchPage(nextPage, true)
    setSearchParams((sp) => {
      const np = new URLSearchParams(sp)
      np.set('page', String(nextPage))
      return np
    })
  }

  function applyFilters(v: FilterValues) {
    setSearchParams((sp) => applyToURL(sp, v))
  }

  function clearAll() {
    setSearchParams(new URLSearchParams())
  }

  const hasMore = items.length < total
  const isInitialLoad = isLoading && items.length === 0
  const activeCount =
    (filters.city ? 1 : 0) +
    filters.property_type.length +
    (filters.min_price || filters.max_price ? 1 : 0) +
    (filters.min_guests ? 1 : 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar
        values={filters}
        cities={cities}
        activeCount={activeCount}
        onApply={applyFilters}
        onClear={clearAll}
      />

      {/* Results */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {!error && !isInitialLoad && (
              <>{total > 0 ? `${total} 处住宿` : '暂无住宿'}</>
            )}
            {error && '加载失败'}
          </h1>
          {filters.q && !error && (
            <p className="text-sm text-slate-500">
              搜索 "<span className="font-medium">{filters.q}</span>"
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

            {/* Load More */}
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
