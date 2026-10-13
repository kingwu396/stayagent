import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getRecentSearches, type RecentSearch } from '@/lib/recent'
import { cityImage, PLACEHOLDER_IMAGE } from '@/lib/placeholder'
import { formatDateRange, formatGuestsSummary, totalGuests } from '@/hooks/useCompactSearch'

/**
 * 「欢迎回来 / 继续搜索」：localStorage 有搜索记录才渲染（匿名/登录都可用）。
 * 卡片样式照 airbnb.cn：白卡圆角阴影 + 左侧城市图 + 粗标题 + 灰色日期人数 + → 箭头。
 */
export function WelcomeBack() {
  const searches = getRecentSearches().slice(0, 2)
  if (searches.length === 0) return null

  return (
    <section className="max-w-6xl mx-auto px-6">
      <h2 className="text-xl md:text-[22px] font-semibold text-slate-900 mb-4">欢迎回来</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {searches.map((s) => (
          <SearchCard key={s.city} search={s} />
        ))}
      </div>
    </section>
  )
}

function SearchCard({ search }: { search: RecentSearch }) {
  const params = new URLSearchParams()
  params.set('city', search.city)
  if (search.checkIn) params.set('check_in', search.checkIn)
  if (search.checkOut) params.set('check_out', search.checkOut)
  const g = totalGuests(search.guests)
  if (g > 0) params.set('min_guests', String(g))

  const dateText = formatDateRange(search.checkIn, search.checkOut)
  const guestText = formatGuestsSummary(search.guests)

  return (
    <Link
      to={`/search?${params.toString()}`}
      className="group flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-lg transition"
    >
      <img
        src={cityImage(search.city)}
        alt={search.city}
        loading="lazy"
        onError={(e) => {
          // 本地化只覆盖 seed 时的城市, 新城市/省份 (如 广东) 没有 cities/{name}.jpg 会 404 → 兜底占位图
          ;(e.target as HTMLImageElement).onerror = null
          ;(e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE
        }}
        className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover flex-shrink-0 bg-slate-100"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm md:text-base font-semibold text-slate-900 truncate">
          继续搜索{search.city}的房源
        </div>
        <div className="text-sm text-slate-500 truncate">
          {dateText}
          {guestText && ` · ${guestText}`}
        </div>
      </div>
      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition flex-shrink-0" />
    </Link>
  )
}
