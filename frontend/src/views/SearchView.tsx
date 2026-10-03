import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { CompactTopbar } from '@/components/CompactTopbar'
import { EMPTY_GUESTS, type CompactSearchState } from '@/hooks/useCompactSearch'
import { ListingCard } from '@/components/ListingCard'
import { SearchMap } from '@/components/SearchMap'
import { ListingCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FilterBar } from '@/components/FilterBar'
import { FilterModal, EMPTY_FILTER } from '@/components/FilterModal'
import { listingsApi } from '@/api/listings'
import type {
  ListingSummary,
  CityInfo,
  FilterOptions,
  FilterState,
  PlaceType,
} from '@/types/listing'

const PAGE_SIZE = 20
const PREVIEW_DEBOUNCE_MS = 300

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
function applySearchToURL(current: URLSearchParams, s: CompactSearchState): URLSearchParams {
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

/** 从 URL 解析出 FilterState */
function parseFilterFromURL(sp: URLSearchParams): FilterState {
  const place = sp.get('place_type') || 'any'
  const placeValid: PlaceType = place === 'room' || place === 'entire' || place === 'any' ? place : 'any'
  const propTypesRaw = sp.get('property_types') || ''
  return {
    city: sp.get('city') || '',
    place_type: placeValid,
    property_types: propTypesRaw ? propTypesRaw.split(',').filter(Boolean) : [],
    min_price: sp.get('min_price') || '',
    max_price: sp.get('max_price') || '',
    min_bedrooms: sp.get('min_bedrooms') ? parseInt(sp.get('min_bedrooms')!) : 0,
    min_beds: sp.get('min_beds') ? parseInt(sp.get('min_beds')!) : 0,
    min_bathrooms: sp.get('min_bathrooms') ? parseInt(sp.get('min_bathrooms')!) : 0,
    amenities: sp.get('amenities')
      ? sp.get('amenities')!.split(',').filter(Boolean)
      : [],
  }
}

/** 把 FilterState 写到 URL（保留 page） */
function applyFilterToURL(current: URLSearchParams, f: FilterState): URLSearchParams {
  const next = new URLSearchParams(current)
  function setOrDel(k: string, v: string) {
    if (v) next.set(k, v)
    else next.delete(k)
  }
  setOrDel('place_type', f.place_type !== 'any' ? f.place_type : '')
  setOrDel('property_types', f.property_types.length ? f.property_types.join(',') : '')
  setOrDel('min_price', f.min_price)
  setOrDel('max_price', f.max_price)
  setOrDel('min_bedrooms', f.min_bedrooms > 0 ? String(f.min_bedrooms) : '')
  setOrDel('min_beds', f.min_beds > 0 ? String(f.min_beds) : '')
  setOrDel('min_bathrooms', f.min_bathrooms > 0 ? String(f.min_bathrooms) : '')
  setOrDel('amenities', f.amenities.length ? f.amenities.join(',') : '')
  next.delete('page')
  return next
}

/** 把 FilterState 转成 API params */
function filterToApiParams(f: FilterState) {
  return {
    city: f.city || undefined,
    place_type: f.place_type !== 'any' ? f.place_type : undefined,
    property_types: f.property_types.length ? f.property_types : undefined,
    min_price: f.min_price ? Number(f.min_price) : undefined,
    max_price: f.max_price ? Number(f.max_price) : undefined,
    min_bedrooms: f.min_bedrooms > 0 ? f.min_bedrooms : undefined,
    min_beds: f.min_beds > 0 ? f.min_beds : undefined,
    min_bathrooms: f.min_bathrooms > 0 ? f.min_bathrooms : undefined,
    amenities: f.amenities.length ? f.amenities : undefined,
  }
}

export function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = useMemo(() => parseSearchFromURL(searchParams), [searchParams])
  const filter = useMemo(() => parseFilterFromURL(searchParams), [searchParams])

  const [items, setItems] = useState<ListingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loadedPage, setLoadedPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cities, setCities] = useState<CityInfo[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [previewCount, setPreviewCount] = useState(0)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reqIdRef = useRef(0)
  const previewReqIdRef = useRef(0)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 拉城市列表
  useEffect(() => {
    listingsApi.cities().then(setCities).catch(() => setCities([]))
  }, [])

  // 拉 filter options（按当前 city）
  useEffect(() => {
    listingsApi
      .filterOptions({ city: filter.city || undefined })
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.city])

  // 拉一页数据
  const fetchPage = useCallback(
    async (page: number, append: boolean, fetchFilter: FilterState = filter) => {
      const myId = ++reqIdRef.current
      setIsLoading(true)
      setError(null)
      try {
        const data = await listingsApi.list({
          page,
          page_size: PAGE_SIZE,
          // search 字段
          min_guests:
            search.guests.adults + search.guests.children > 0
              ? search.guests.adults + search.guests.children
              : undefined,
          // filter 字段
          ...filterToApiParams(fetchFilter),
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
    [search.guests.adults, search.guests.children, filter]
  )

  // filter 或 search 变化 → 重置 + 拉第 1 页
  useEffect(() => {
    setItems([])
    setLoadedPage(1)
    fetchPage(1, false, filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search.guests.adults, search.guests.children])

  // 用户点 Load More
  function loadMore() {
    const nextPage = loadedPage + 1
    fetchPage(nextPage, true, filter)
    setSearchParams((sp) => {
      const np = new URLSearchParams(sp)
      np.set('page', String(nextPage))
      return np
    })
  }

  // CompactTopbar 搜索回调：更新 URL
  const handleSearch = useCallback(
    (s: CompactSearchState) => {
      setSearchParams((sp) => applySearchToURL(sp, s))
    },
    [setSearchParams]
  )

  // FilterBar / FilterModal 回调
  const handleFilterChange = useCallback(
    (next: Partial<FilterState>) => {
      setSearchParams((sp) => {
        const merged: FilterState = { ...filter, ...next }
        // city 变更也要同步到 URL（search 和 filter 共享 city）
        const np = new URLSearchParams(sp)
        if ('city' in next) {
          // city 用 filter 的最新值
          const finalCity = merged.city
          if (finalCity) np.set('city', finalCity)
          else np.delete('city')
          // search 端的 city 也跟随
        }
        return applyFilterToURL(np, merged)
      })
    },
    [setSearchParams, filter]
  )

  function handleApplyFilter(next: FilterState) {
    setSearchParams((sp) => applyFilterToURL(sp, next))
    setFilterModalOpen(false)
  }

  function handleClearFilter() {
    const next: FilterState = { ...EMPTY_FILTER, city: filter.city }
    setSearchParams((sp) => applyFilterToURL(sp, next))
  }

  // modal 内 preview count（debounce）
  function handlePreviewChange(draft: FilterState) {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(async () => {
      const myId = ++previewReqIdRef.current
      try {
        const data = await listingsApi.list({
          page: 1,
          page_size: 1,
          min_guests:
            search.guests.adults + search.guests.children > 0
              ? search.guests.adults + search.guests.children
              : undefined,
          ...filterToApiParams(draft),
        })
        if (myId !== previewReqIdRef.current) return
        setPreviewCount(data.total)
      } catch {
        if (myId === previewReqIdRef.current) setPreviewCount(0)
      }
    }, PREVIEW_DEBOUNCE_MS)
  }

  /** 地图 marker 点击：滚动到对应卡片 + 2s 高亮 */
  const handleMarkerClick = useCallback((id: number) => {
    setHighlightedId(id)
    const el = cardRefs.current.get(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 2000)
  }, [])

  const hasMore = items.length < total
  const isInitialLoad = isLoading && items.length === 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部紧凑搜索条 */}
      <CompactTopbar
        visible={true}
        initial={search}
        recommended={cities}
        onSearch={handleSearch}
      />

      {/* 占位 */}
      <div className="h-16 md:h-[72px]" />

      {/* 筛选条 */}
      <FilterBar
        value={filter}
        cities={cities}
        onOpenModal={() => setFilterModalOpen(true)}
        onChange={handleFilterChange}
      />

      {/* 筛选 modal */}
      <FilterModal
        open={filterModalOpen}
        value={filter}
        options={filterOptions}
        previewCount={previewCount}
        onClose={() => setFilterModalOpen(false)}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        onPreviewChange={handlePreviewChange}
      />

      {/* Results: split-pane (list left, map right on md+) */}
      <main className="md:flex md:items-start">
        {/* Left: Listings */}
        <div className="flex-1 min-w-0 px-6 py-6">
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-xl font-semibold text-slate-900">
              {!error && !isInitialLoad && (
                <>{total > 0 ? `${filter.city ? filter.city + ' 的超过 ' : ''}${total} 个房源` : '暂无住宿'}</>
              )}
              {error && '加载失败'}
            </h1>
            {!isInitialLoad && !error && total > 0 && (
              <p className="text-sm text-slate-500">
                {search.guests.adults + search.guests.children > 0 &&
                  ` · ${search.guests.adults + search.guests.children} 位客人`}
                {(search.checkIn || search.checkOut) && ` · ${search.checkIn} → ${search.checkOut}`}
              </p>
            )}
          </div>

          {isInitialLoad && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isInitialLoad && error && (
            <ErrorState description={error} onRetry={() => fetchPage(1, false, filter)} />
          )}

          {!isInitialLoad && !error && items.length === 0 && (
            <EmptyState
              title="暂无住宿"
              description="试试调整筛选条件，或者换一个城市"
            />
          )}

          {!error && items.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {items.map((l) => (
                  <div
                    key={l.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(l.id, el)
                      else cardRefs.current.delete(l.id)
                    }}
                  >
                    <ListingCard listing={l} highlighted={highlightedId === l.id} />
                  </div>
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
        </div>

        {/* Right: Map (hidden on mobile, sticky on md+) */}
        <SearchMap
          listings={items}
          highlightedId={highlightedId}
          onMarkerClick={handleMarkerClick}
        />
      </main>
    </div>
  )
}
