import { useEffect, useRef } from 'react'
import { getRecentSearches } from '@/lib/recent'
import { formatDateRange, formatGuestsSummary } from '@/hooks/useCompactSearch'
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

  // Block 25: 最近搜索 = 真实 localStorage 记录(非写死假数据);
  // 汉化后旧英文记录与当前城市列表对不上, 自动过滤隐藏
  const cityKnown = (city: string) =>
    !recommended?.length || recommended.some((c) => c.city === city)
  const recentList: LocationSuggestion[] =
    value.trim() === ''
      ? getRecentSearches()
          .filter((s) => cityKnown(s.city))
          .slice(0, 3)
          .map((s) => {
            const dates = formatDateRange(s.checkIn, s.checkOut)
            const guests = formatGuestsSummary(s.guests)
            const meta = [dates !== '任何日期' ? dates : '', guests].filter(Boolean).join(' · ')
            return {
              city: s.city,
              country: recommended?.find((c) => c.city === s.city)?.country || '',
              region: s.city,
              icon: iconForCity(s.city),
              tone: toneForCity(s.city),
              meta: meta || undefined,
            }
          })
      : []

  // 推荐数据(来自 cities API, 中文)
  const recommendedList: LocationSuggestion[] =
    recommended && recommended.length > 0
      ? recommended.slice(0, 6).map((c) => ({
          city: c.city,
          country: c.country,
          region: `${c.city}, ${c.country}`,
          icon: iconForCity(c.city),
          tone: toneForCity(c.city),
        }))
      : []

  // 过滤推荐
  const filtered = value.trim()
    ? recommendedList.filter((r) => r.city.toLowerCase().includes(value.toLowerCase()))
    : recommendedList

  return (
    <div className="p-5 w-[360px] max-w-full">
      {/* 搜索输入 */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索目的地"
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-full text-base focus:border-slate-400 focus:outline-none transition shadow-sm"
        />
      </div>

      {/* 最近搜索(Block 25: 真实记录, 旧英文城市自动过滤) */}
      {value.trim() === '' && recentList.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">最近搜索</h3>
          <div className="space-y-1">
            {recentList.map((s) => (
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
  if (/巴厘岛|普吉|苏梅|海滩|海岛/.test(city)) return 'sky'
  if (/曼谷|清迈|京都/.test(city)) return 'emerald'
  if (/东京|巴黎|上海|纽约|伦敦|香港/.test(city)) return 'amber'
  return 'slate'
}

function iconForCity(city: string): LocationSuggestion['icon'] {
  if (/巴厘岛|普吉|海滩/.test(city)) return 'waves'
  if (/曼谷|清迈|京都/.test(city)) return 'temple'
  if (/北京|西安|京都/.test(city)) return 'castle'
  if (/东京|巴黎|上海|纽约|伦敦|香港|新加坡/.test(city)) return 'building'
  return 'generic'
}
