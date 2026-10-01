import { useEffect, useRef } from 'react'
import { Search, MapPin, Mountain, Building2, Umbrella, Waves } from 'lucide-react'

export interface LocationSuggestion {
  city: string
  country: string
  region: string
  icon: 'mountain' | 'building' | 'umbrella' | 'waves' | 'temple' | 'generic'
  note?: string
  meta?: string
}

interface LocationSuggestionsProps {
  value: string
  onChange: (v: string) => void
  onPick: (city: string) => void
  recommended?: { city: string; country: string; count: number }[]
  focused: boolean
}

// 假数据：最近搜索（实际项目中可放 localStorage）
const RECENT_SEARCHES: LocationSuggestion[] = [
  { city: 'Bangkok', country: 'Thailand', region: 'Bangkok, 城市', icon: 'temple', meta: '10月11日至11月10日 · 1位客人' },
  { city: 'Chiang Mai', country: 'Thailand', region: 'Chiang Mai, 城市', icon: 'mountain', meta: '10月25日至26日' },
]

// 假数据：推荐目的地（兜底）
const FALLBACK_RECOMMENDED: LocationSuggestion[] = [
  { city: 'Pattaya', country: 'Thailand', region: 'Pattaya, 城市', icon: 'umbrella', note: '对曼谷感兴趣的旅行者也会看看这里' },
  { city: 'Kuala Lumpur', country: 'Malaysia', region: 'Kuala Lumpur, 城市', icon: 'building', note: '有双峰塔等景点' },
  { city: 'Kata Beach', country: 'Thailand', region: 'Kata Beach, 海滩', icon: 'waves', note: '魅力海滩' },
  { city: 'Tokyo', country: 'Japan', region: 'Tokyo, 城市', icon: 'building', note: '对曼谷感兴趣的旅行者也会看看这里' },
]

const ICON_MAP = {
  mountain: Mountain,
  building: Building2,
  umbrella: Umbrella,
  waves: Waves,
  temple: Building2,
  generic: MapPin,
}

export function LocationSuggestions({
  value,
  onChange,
  onPick,
  recommended,
  focused,
}: LocationSuggestionsProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动 focus
  useEffect(() => {
    if (focused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [focused])

  // 推荐数据
  const recommendedList: LocationSuggestion[] = recommended && recommended.length > 0
    ? recommended.slice(0, 6).map((c) => ({
        city: c.city,
        country: c.country,
        region: `${c.city}, ${c.country}`,
        icon: iconForCity(c.city),
      }))
    : FALLBACK_RECOMMENDED

  // 过滤推荐
  const filtered = value.trim()
    ? recommendedList.filter((r) => r.city.toLowerCase().includes(value.toLowerCase()))
    : recommendedList

  return (
    <div className="p-6 max-h-[480px] overflow-y-auto">
      {/* 搜索输入 */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索目的地"
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none shadow-sm"
        />
      </div>

      {/* 最近搜索 */}
      {value.trim() === '' && RECENT_SEARCHES.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">最近搜索</h3>
          <div className="space-y-1">
            {RECENT_SEARCHES.map((s) => (
              <SuggestionRow
                key={s.city}
                suggestion={s}
                onClick={() => onPick(s.city)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 推荐目的地 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          {value.trim() ? '搜索结果' : '推荐目的地'}
        </h3>
        {filtered.length === 0 ? (
          <button
            type="button"
            onClick={() => onPick(value.trim())}
            className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition text-left"
          >
            <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-brand-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900">使用 "{value.trim()}" 搜索</div>
              <div className="text-xs text-slate-500 mt-0.5">按当前输入搜索</div>
            </div>
          </button>
        ) : (
          <div className="space-y-1">
            {filtered.map((s) => (
              <SuggestionRow
                key={s.city}
                suggestion={s}
                onClick={() => onPick(s.city)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SuggestionRow({
  suggestion,
  onClick,
}: {
  suggestion: LocationSuggestion
  onClick: () => void
}) {
  const Icon = ICON_MAP[suggestion.icon] || MapPin
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition text-left"
    >
      <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Icon className="w-6 h-6 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900">{suggestion.city}</div>
        <div className="text-xs text-slate-500 mt-0.5">
          {suggestion.meta || suggestion.note || suggestion.region}
        </div>
      </div>
    </button>
  )
}

function iconForCity(city: string): LocationSuggestion['icon'] {
  const c = city.toLowerCase()
  if (c.includes('beach') || c.includes('bali')) return 'waves'
  if (c.includes('mountain') || c.includes('phuket')) return 'mountain'
  if (c.includes('paris') || c.includes('tokyo') || c.includes('shanghai')) return 'building'
  if (c.includes('bangkok')) return 'temple'
  return 'generic'
}
