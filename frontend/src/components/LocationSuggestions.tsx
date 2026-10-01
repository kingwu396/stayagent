import { useEffect, useRef } from 'react'
import { Search, MapPin, Mountain, Building2, Umbrella, Waves, Palmtree, Castle } from 'lucide-react'

export interface LocationSuggestion {
  city: string
  country: string
  region: string
  icon: 'mountain' | 'building' | 'umbrella' | 'waves' | 'temple' | 'palmtree' | 'castle' | 'generic'
  /** 背景色调：rose / amber / emerald / sky / violet / slate */
  tone?: 'rose' | 'amber' | 'emerald' | 'sky' | 'violet' | 'slate'
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
  { city: 'Kuala Lumpur City Centre', country: 'Malaysia', region: 'Kuala Lumpur, 城市', icon: 'building', tone: 'emerald', meta: '10月3日至11月18日 · 3位客人' },
  { city: 'Bangkok', country: 'Thailand', region: 'Bangkok, 城市', icon: 'temple', tone: 'emerald', meta: '10月11日至11月10日 · 1位客人' },
  { city: 'Kuala Lumpur', country: 'Malaysia', region: 'Kuala Lumpur, 城市', icon: 'umbrella', tone: 'amber', meta: '10月3日至11月18日 · 3位客人' },
]

// 假数据：推荐目的地（兜底）
const FALLBACK_RECOMMENDED: LocationSuggestion[] = [
  { city: 'George Town', country: 'Malaysia', region: 'George Town, 城市', icon: 'castle', tone: 'rose', note: '精美建筑' },
  { city: 'Chiang Mai', country: 'Thailand', region: 'Chiang Mai, 城市', icon: 'temple', tone: 'slate', note: 'Because you searched for Chiang Mai' },
  { city: 'Kota Kinabalu', country: 'Malaysia', region: 'Kota Kinabalu, 海滩', icon: 'palmtree', tone: 'rose', note: '适合家庭' },
]

interface IconMeta {
  Icon: React.ComponentType<{ className?: string }>
  bg: string
}

const ICON_MAP: Record<LocationSuggestion['icon'], IconMeta> = {
  mountain: { Icon: Mountain, bg: 'bg-amber-100 text-amber-700' },
  building: { Icon: Building2, bg: 'bg-emerald-100 text-emerald-700' },
  umbrella: { Icon: Umbrella, bg: 'bg-amber-100 text-amber-700' },
  waves: { Icon: Waves, bg: 'bg-sky-100 text-sky-700' },
  temple: { Icon: Castle, bg: 'bg-emerald-100 text-emerald-700' },
  palmtree: { Icon: Palmtree, bg: 'bg-rose-100 text-rose-700' },
  castle: { Icon: Castle, bg: 'bg-rose-100 text-rose-700' },
  generic: { Icon: MapPin, bg: 'bg-slate-100 text-slate-700' },
}

const TONE_OVERRIDES: Record<NonNullable<LocationSuggestion['tone']>, string> = {
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  slate: 'bg-slate-100 text-slate-700',
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
        tone: toneForCity(c.city),
      }))
    : FALLBACK_RECOMMENDED

  // 过滤推荐
  const filtered = value.trim()
    ? recommendedList.filter((r) => r.city.toLowerCase().includes(value.toLowerCase()))
    : recommendedList

  return (
    <div className="p-6 w-[420px] max-w-full">
      {/* 搜索输入 */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索目的地"
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-full text-base focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
        />
      </div>

      {/* 最近搜索 */}
      {value.trim() === '' && RECENT_SEARCHES.length > 0 && (
        <div className="mb-5">
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
  const toneClass = suggestion.tone ? TONE_OVERRIDES[suggestion.tone] : null
  const meta = ICON_MAP[suggestion.icon] || ICON_MAP.generic
  const bgClass = toneClass || meta.bg
  const Icon = meta.Icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition text-left"
    >
      <div className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center ${bgClass}`}>
        <Icon className="w-6 h-6" />
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

function toneForCity(city: string): LocationSuggestion['tone'] {
  const c = city.toLowerCase()
  if (c.includes('penang') || c.includes('george')) return 'rose'
  if (c.includes('bangkok') || c.includes('kuala')) return 'emerald'
  if (c.includes('tokyo') || c.includes('shanghai') || c.includes('paris')) return 'amber'
  if (c.includes('bali') || c.includes('beach')) return 'sky'
  return 'slate'
}

function iconForCity(city: string): LocationSuggestion['icon'] {
  const c = city.toLowerCase()
  if (c.includes('beach') || c.includes('bali')) return 'waves'
  if (c.includes('penang') || c.includes('george')) return 'castle'
  if (c.includes('mountain')) return 'mountain'
  if (c.includes('paris') || c.includes('tokyo') || c.includes('shanghai')) return 'building'
  if (c.includes('bangkok')) return 'temple'
  if (c.includes('kuala')) return 'building'
  return 'generic'
}
