import { useState, useEffect } from 'react'
import {
  X,
  ChevronDown,
  Wifi,
  Snowflake,
  Tv,
  ParkingCircle,
  Wind,
  Dumbbell,
  Home as HomeIcon,
  Building2,
  Castle,
  Hotel,
  Zap,
  KeyRound,
  PawPrint,
  Sparkles,
  Bed as BedIcon,
  ChefHat,
  Bath,
} from 'lucide-react'
import type { FilterState, FilterOptions, PlaceType, AmenityCount } from '@/types/listing'
import { Histogram } from './Histogram'
import { CounterRow } from './CounterRow'
import { useToast } from '@/hooks/useToast'

interface FilterModalProps {
  open: boolean
  value: FilterState
  options: FilterOptions | null
  previewCount: number
  onClose: () => void
  onApply: (next: FilterState) => void
  onClear: () => void
  /** modal 内 filter 实时变化（用于 trigger preview count 重算） */
  onPreviewChange: (next: FilterState) => void
}

const PLACE_TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
  { value: 'any', label: '任何类型' },
  { value: 'room', label: '房间' },
  { value: 'entire', label: '整套房屋' },
]

const RECOMMENDED_PRESETS: {
  key: string
  label: string
  icon: React.ReactNode
  active: (s: FilterState) => boolean
  toggle: (s: FilterState) => FilterState
}[] = [
  {
    key: 'washer',
    label: '洗衣机',
    icon: <Sparkles className="w-7 h-7 text-slate-600" />,
    active: (s) => s.amenities.includes('washer'),
    toggle: (s) => toggleAmenity(s, 'washer'),
  },
  {
    key: 'bedrooms2',
    label: '至少 2 间卧室',
    icon: <BedIcon className="w-7 h-7 text-slate-600" />,
    active: (s) => s.min_bedrooms === 2,
    toggle: (s) => ({ ...s, min_bedrooms: s.min_bedrooms === 2 ? 0 : 2 }),
  },
  {
    key: 'kitchen',
    label: '厨房',
    icon: <ChefHat className="w-7 h-7 text-slate-600" />,
    active: (s) => s.amenities.includes('kitchen'),
    toggle: (s) => toggleAmenity(s, 'kitchen'),
  },
  {
    key: 'beds2',
    label: '至少 2 张床',
    icon: <BedIcon className="w-7 h-7 text-slate-600" />,
    active: (s) => s.min_beds === 2,
    toggle: (s) => ({ ...s, min_beds: s.min_beds === 2 ? 0 : 2 }),
  },
]

const BUILDING_TYPE_OPTIONS = [
  { key: 'house', label: '独栋/半独栋房屋', icon: <HomeIcon className="w-4 h-4" />, value: 'house' },
  { key: 'apartment', label: '公寓', icon: <Building2 className="w-4 h-4" />, value: 'apartment' },
  { key: 'studio', label: '客用小屋', icon: <Castle className="w-4 h-4" />, value: 'studio' },
  { key: 'hotel', label: '酒店', icon: <Hotel className="w-4 h-4" />, value: 'hotel' },
]

const AMENITY_ICON_MAP: Record<string, { icon: React.ReactNode; label: string }> = {
  wifi: { icon: <Wifi className="w-4 h-4" />, label: '无线网络' },
  'air conditioning': { icon: <Snowflake className="w-4 h-4" />, label: '空调' },
  tv: { icon: <Tv className="w-4 h-4" />, label: '电视机' },
  parking: { icon: <ParkingCircle className="w-4 h-4" />, label: '免费停车' },
  dryer: { icon: <Wind className="w-4 h-4" />, label: '烘干机' },
  gym: { icon: <Dumbbell className="w-4 h-4" />, label: '健身房' },
  kitchen: { icon: <ChefHat className="w-4 h-4" />, label: '厨房' },
  washer: { icon: <Sparkles className="w-4 h-4" />, label: '洗衣机' },
  pool: { icon: <Bath className="w-4 h-4" />, label: '游泳池' },
  workspace: { icon: <HomeIcon className="w-4 h-4" />, label: '工作区' },
  heating: { icon: <Wind className="w-4 h-4" />, label: '暖气' },
  'coffee maker': { icon: <Sparkles className="w-4 h-4" />, label: '咖啡机' },
  garden: { icon: <Sparkles className="w-4 h-4" />, label: '花园' },
  balcony: { icon: <Sparkles className="w-4 h-4" />, label: '阳台' },
  parking_free: { icon: <ParkingCircle className="w-4 h-4" />, label: '免费停车' },
}

const DEFAULT_AMENITY_ORDER = [
  'wifi', 'air conditioning', 'tv', 'parking', 'dryer', 'gym',
]

const BOOKING_OPTIONS = [
  { key: 'instant', label: '闪订', icon: <Zap className="w-4 h-4" /> },
  { key: 'self_checkin', label: '自助入住', icon: <KeyRound className="w-4 h-4" /> },
  { key: 'pets', label: '允许携带宠物', icon: <PawPrint className="w-4 h-4" /> },
]

const POPULAR_NEIGHBORHOODS = ['Bangkok', 'Kuala Lumpur', 'Tokyo']

function toggleAmenity(s: FilterState, amenity: string): FilterState {
  const exists = s.amenities.includes(amenity)
  return {
    ...s,
    amenities: exists
      ? s.amenities.filter((a) => a !== amenity)
      : [...s.amenities, amenity],
  }
}

function togglePropertyType(s: FilterState, propertyType: string): FilterState {
  const exists = s.property_types.includes(propertyType)
  return {
    ...s,
    property_types: exists
      ? s.property_types.filter((t) => t !== propertyType)
      : [...s.property_types, propertyType],
  }
}

export const EMPTY_FILTER: FilterState = {
  city: '',
  place_type: 'any',
  property_types: [],
  min_price: '',
  max_price: '',
  min_bedrooms: 0,
  min_beds: 0,
  min_bathrooms: 0,
  amenities: [],
}

export function FilterModal({
  open,
  value,
  options,
  previewCount,
  onClose,
  onApply,
  onClear,
  onPreviewChange,
}: FilterModalProps) {
  const toast = useToast()
  const [draft, setDraft] = useState<FilterState>(value)
  const [showMoreAmenities, setShowMoreAmenities] = useState(false)

  // modal 打开时同步 value → draft
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // draft 变化 → 触发 preview 重算
  useEffect(() => {
    if (!open) return
    onPreviewChange(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, open])

  if (!open) return null

  function clearAll() {
    setDraft({ ...EMPTY_FILTER, city: value.city })
    onClear()
  }

  function applyAndClose() {
    onApply(draft)
    onClose()
  }

  // 后端 amenities_counts（按 count 降序）
  const allAmenityEntries: AmenityCount[] = options?.amenities_counts || []

  // 排序：先 DEFAULT_AMENITY_ORDER（带 icon 的），再剩下的按 count 降序
  const orderedAmenities: { name: string; count: number; icon?: React.ReactNode; label?: string }[] = []
  const seen = new Set<string>()
  for (const key of DEFAULT_AMENITY_ORDER) {
    const entry = allAmenityEntries.find((a) => a.name === key)
    if (entry) {
      const meta = AMENITY_ICON_MAP[key]
      orderedAmenities.push({
        name: entry.name,
        count: entry.count,
        icon: meta?.icon,
        label: meta?.label || entry.name,
      })
      seen.add(key)
    }
  }
  for (const a of allAmenityEntries) {
    if (seen.has(a.name)) continue
    const meta = AMENITY_ICON_MAP[a.name]
    orderedAmenities.push({
      name: a.name,
      count: a.count,
      icon: meta?.icon,
      label: meta?.label || a.name,
    })
  }

  const visibleAmenities = showMoreAmenities
    ? orderedAmenities
    : orderedAmenities.slice(0, 6)

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 px-4 pb-12">
      {/* 背景 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-center px-6 py-4 border-b border-slate-200 relative">
          <h2 className="text-lg font-semibold text-slate-900">筛选条件</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {/* 为你推荐 */}
          <Section title="为你推荐">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {RECOMMENDED_PRESETS.map((p) => {
                const active = p.active(draft)
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setDraft((d) => p.toggle(d))}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-2xl transition ${
                      active
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                      {p.icon}
                    </div>
                    <span className="text-sm font-medium text-slate-900">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* 房源类型 */}
          <Section title="房源类型">
            <div className="grid grid-cols-3 border border-slate-200 rounded-full overflow-hidden bg-white">
              {PLACE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, place_type: opt.value }))}
                  className={`py-2.5 text-sm font-medium transition ${
                    draft.place_type === opt.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {/* 价格范围 */}
          <Section title="价格范围" subtitle="月租价格（包含所有费用）">
            {options && options.price_buckets.length > 0 ? (
              <Histogram
                buckets={options.price_buckets}
                highlightMin={draft.min_price || null}
                highlightMax={draft.max_price || null}
              />
            ) : (
              <div className="h-12 flex items-center justify-center text-xs text-slate-400">暂无数据</div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <PriceInput
                label="最低"
                value={draft.min_price}
                min={options?.min_price || '0'}
                onChange={(v) => setDraft((d) => ({ ...d, min_price: v }))}
              />
              <PriceInput
                label="最高"
                value={draft.max_price}
                min={options?.min_price || '0'}
                isMax
                onChange={(v) => setDraft((d) => ({ ...d, max_price: v }))}
              />
            </div>
          </Section>

          {/* 卧室/床位 */}
          <Section title="卧室/床位">
            <CounterRow
              label="卧室"
              value={draft.min_bedrooms}
              onChange={(v) => setDraft((d) => ({ ...d, min_bedrooms: v }))}
              max={10}
            />
            <CounterRow
              label="床位"
              value={draft.min_beds}
              onChange={(v) => setDraft((d) => ({ ...d, min_beds: v }))}
              max={10}
            />
            <CounterRow
              label="卫生间"
              value={draft.min_bathrooms}
              onChange={(v) => setDraft((d) => ({ ...d, min_bathrooms: v }))}
              max={6}
            />
          </Section>

          {/* 建筑类型 */}
          <Section title="建筑类型">
            <div className="flex flex-wrap gap-2">
              {BUILDING_TYPE_OPTIONS.map((opt) => {
                const active = draft.property_types.includes(opt.value)
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDraft((d) => togglePropertyType(d, opt.value))}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm transition ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-900 bg-white'
                    }`}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* 便利设施 */}
          <Section title="便利设施">
            <div className="flex flex-wrap gap-2">
              {visibleAmenities.map((a) => {
                const active = draft.amenities.includes(a.name)
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => setDraft((d) => toggleAmenity(d, a.name))}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-full text-sm transition ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-900 bg-white'
                    }`}
                  >
                    {a.icon}
                    <span>{a.label}</span>
                  </button>
                )
              })}
            </div>
            {orderedAmenities.length > 6 && (
              <button
                type="button"
                onClick={() => setShowMoreAmenities((s) => !s)}
                className="mt-3 text-sm font-medium text-slate-900 underline flex items-center gap-1"
              >
                <span>{showMoreAmenities ? '收起' : '显示更多'}</span>
                <ChevronDown
                  className={`w-4 h-4 transition ${showMoreAmenities ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </Section>

          {/* 热门街区（演示版） */}
          <Section title="热门街区" rightSlot={<DemoBadge />}>
            <div className="flex flex-wrap gap-2">
              {POPULAR_NEIGHBORHOODS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toast.info('演示版暂不支持')}
                  className="px-4 py-2 border border-slate-300 rounded-full text-sm text-slate-700 hover:border-slate-900 bg-white transition"
                >
                  {n}
                </button>
              ))}
            </div>
          </Section>

          {/* 预订选项（演示版） */}
          <Section title="预订选项" rightSlot={<DemoBadge />}>
            <div className="flex flex-wrap gap-2">
              {BOOKING_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toast.info('演示版暂不支持')}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-full text-sm text-slate-700 hover:border-slate-900 bg-white transition"
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <div className="h-4" />
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-white">
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-slate-500 hover:text-slate-900 underline font-medium"
          >
            清除全部
          </button>
          <button
            type="button"
            onClick={applyAndClose}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            显示超过 {previewCount} 个房源
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  subtitle,
  rightSlot,
  children,
}: {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="py-5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {rightSlot}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mb-3">{subtitle}</p>}
      {children}
    </div>
  )
}

function DemoBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-semibold">
      演示版
    </span>
  )
}

function PriceInput({
  label,
  value,
  min,
  isMax,
  onChange,
}: {
  label: string
  value: string
  min: string
  isMax?: boolean
  onChange: (v: string) => void
}) {
  const handle = (raw: string) => {
    const num = Number(raw)
    if (raw === '' || raw === '-') {
      onChange('')
      return
    }
    if (isNaN(num) || num < 0) {
      onChange('')
      return
    }
    onChange(String(num))
  }
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          placeholder={isMax ? `¥ ${min}+` : `¥ ${min}`}
          value={value}
          onChange={(e) => handle(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">¥</span>
      </div>
    </div>
  )
}
