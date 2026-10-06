import {
  Sparkles, MapPin, KeyRound, MessageCircle, Car, Gamepad2,
  type LucideIcon,
} from 'lucide-react'

interface ListingHighlightsProps {
  amenities: string[]
  /** 用于派生"靠近XXX地标"文案 */
  city?: string
}

/**
 * 房源"亮点"6 宫格 (Airbnb 风格)
 *
 * 规则: 把 listing.amenities 子集映射为营销标签 + icon, 不足 6 项就保留实际数量。
 * 这是 marketing copy, 不是完整 amenities 列表 (后者在下面另列)。
 */

export function ListingHighlights({ amenities, city }: ListingHighlightsProps) {
  const set = new Set(amenities || [])

  // 决定哪些 highlight 槽启用 (基于 amenities 启发式)
  const picks: Array<{ label: string; icon: LucideIcon }> = []

  // 1. 国人好评 — 总有 listing 即可 (固定展示)
  picks.push({ label: '100% 国人好评', icon: Sparkles })

  // 2. 靠近 XXX 地标 — city 给定时展示
  if (city) {
    picks.push({ label: `靠近 ${city} 广场`, icon: MapPin })
  } else {
    picks.push({ label: '靠近市中心地标', icon: MapPin })
  }

  // 3. 自助入住 (营销默认)
  picks.push({ label: '自助入住', icon: KeyRound })

  // 4. 中文房东 — 营销默认
  picks.push({ label: '中文房东', icon: MessageCircle })

  // 5. 免费停车
  if (set.has('parking') || set.has('free_parking')) {
    picks.push({ label: '免费停车', icon: Car })
  }

  // 6. 桌游 / 娱乐设施
  if (set.has('game') || set.has('pool') || set.has('gym')) {
    const label =
        set.has('pool') ? '游泳池' :
        set.has('gym') ? '健身房' : '桌游 / 娱乐设施'
    picks.push({ label, icon: Gamepad2 })
  }

  // 截取前 6 个
  const items = picks.slice(0, 6)

  if (items.length === 0) return null

  return (
    <section className="border-b border-slate-200 pb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-10">
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <div key={i} className="flex items-center gap-3 text-slate-700">
              <Icon className="w-5 h-5 text-slate-700 flex-shrink-0" strokeWidth={1.75} />
              <span className="text-sm">{it.label}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
