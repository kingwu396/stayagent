import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ListingSummary } from '@/types/listing'
import { listingsApi } from '@/api/listings'
import { formatPrice, formatRating } from '@/lib/utils'
import { PLACEHOLDER_IMAGE } from '@/lib/placeholder'

interface MoreListingsCarouselProps {
  city: string
  currentListingId: number
}

const FALLBACK_IMAGE = PLACEHOLDER_IMAGE
const CARD_WIDTH = 216 // 200px card + 16px gap

export function MoreListingsCarousel({ city, currentListingId }: MoreListingsCarouselProps) {
  const [items, setItems] = useState<ListingSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [scrollIdx, setScrollIdx] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    if (!city) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    listingsApi
      .list({ city, page_size: 20 })
      .then((res) => {
        if (cancelled) return
        const filtered = (res.items || []).filter((l) => l.id !== currentListingId).slice(0, 10)
        setItems(filtered)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [city, currentListingId])

  // 监听滚动以更新 currentIdx
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const idx = Math.max(1, Math.round(el.scrollLeft / CARD_WIDTH) + 1)
      setScrollIdx(idx)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [isLoading])

  if (!city) return null
  if (!isLoading && items.length === 0) return null

  function scrollBy(delta: number) {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const total = items.length
  const currentIdx = Math.min(scrollIdx, total)

  return (
    <section className="max-w-6xl mx-auto px-6 mt-12 border-t border-slate-200 pt-10 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-slate-900">更多周边房源</h2>
        {total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 tabular-nums">
              {currentIdx}/{total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-CARD_WIDTH)}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition"
                aria-label="上一个"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(CARD_WIDTH)}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-full bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition"
                aria-label="下一个"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[200px] snap-start space-y-2">
                <div className="skeleton-shimmer rounded-lg aspect-[4/3] bg-slate-200" />
                <div className="skeleton-shimmer rounded h-3 w-3/4 bg-slate-200" />
                <div className="skeleton-shimmer rounded h-3 w-1/2 bg-slate-200" />
              </div>
            ))
          : items.map((listing) => (
              <MiniListingCard key={listing.id} listing={listing} />
            ))}
      </div>
    </section>
  )
}

function MiniListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="flex-shrink-0 w-[200px] snap-start group block"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
        <img
          src={listing.primary_image || FALLBACK_IMAGE}
          alt={listing.title}
          loading="lazy"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = FALLBACK_IMAGE
          }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="pt-2">
        <h3 className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug">
          {listing.title}
        </h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-semibold text-slate-900">
            {formatPrice(listing.price_per_night)}
          </span>
          <span className="text-xs text-slate-500">CNY</span>
          {parseFloat(listing.rating) > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-slate-700 ml-auto">
              <Star className="w-3 h-3 fill-slate-900 text-slate-900" />
              {formatRating(listing.rating, listing.review_count)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
