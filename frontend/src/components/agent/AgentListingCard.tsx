/** Block 13 (F8): search_listings 结果的轻量卡片
 *
 * 与 ListingCard 的区别:
 * - 简化为 chat 场景用: 横向小卡 (cover + 信息), 不带收藏按钮 (chat 里不合适)
 * - 数据来自 search_listings tool (缺 primary_image / lat/lng 等)
 * - 点击跳 /listings/:id (用 useNavigate + div onClick, 不依赖 <Link>)
 */
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'

export interface AgentListingItem {
  id: number
  title: string
  city?: string
  country?: string
  property_type?: string
  price_per_night: number | string
  rating?: number | string
  review_count?: number
  primary_image?: string | null
}

const FALLBACK = 'https://picsum.photos/seed/placeholder/400/300'

export function AgentListingCard({ item }: { item: AgentListingItem }) {
  const price = typeof item.price_per_night === 'string'
    ? parseFloat(item.price_per_night)
    : item.price_per_night
  const rating = item.rating != null
    ? (typeof item.rating === 'string' ? parseFloat(item.rating) : item.rating)
    : 0
  // Block 17 fix: 关掉 AgentPanel 再导航, 避免 fixed inset-0 覆盖目标页面
  const closePanel = useAgentStore((s) => s.closePanel)
  const navigate = useNavigate()

  function handleClick(e?: React.MouseEvent | React.KeyboardEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    // 直接 navigate (react-router v6 的 useNavigate 是同步调度;
    // closePanel() 是异步 setState, 下次渲染 panel 卸载)
    navigate(`/listings/${item.id}`)
    closePanel()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      className="block rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow group"
    >
      <div className="flex gap-2.5 p-2">
        <div className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-slate-100">
          <img
            src={item.primary_image || FALLBACK}
            alt={item.title}
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = FALLBACK
            }}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 line-clamp-1">
            {item.property_type ? item.property_type.charAt(0).toUpperCase() + item.property_type.slice(1) : '房源'}
            {item.city && <> · <span>{item.city}</span></>}
          </div>
          <div className="text-sm font-medium text-slate-900 line-clamp-1 mt-0.5">
            {item.title}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-xs">
              <span className="font-semibold text-slate-900">¥{price}</span>
              <span className="text-slate-400"> /晚</span>
            </div>
            {rating > 0 && (
              <div className="flex items-center gap-0.5 text-xs text-slate-700">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-medium">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
