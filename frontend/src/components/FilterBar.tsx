import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, MapPin, ChevronDown, X } from 'lucide-react'
import type { FilterState } from '@/types/listing'
import type { CityInfo } from '@/types/listing'
import { PROPERTY_TYPE_LABELS } from '@/lib/labels'
import { useToast } from '@/hooks/useToast'

interface FilterBarProps {
  value: FilterState
  cities: CityInfo[]
  onOpenModal: () => void
  onChange: (next: Partial<FilterState>) => void
}

interface QuickChip {
  key: string
  label: string
  apply?: (state: FilterState) => Partial<FilterState>
  /** true 表示此 chip 是"演示版"，点击只 toast */
  demo?: boolean
}

const QUICK_CHIPS: QuickChip[] = [
  {
    key: 'entire',
    label: '整套房屋',
    apply: () => ({ place_type: 'entire' }),
  },
  {
    key: 'washer',
    label: '洗衣机',
    apply: (s) => toggleAmenity(s, 'washer'),
  },
  {
    key: 'wifi',
    label: '无线网络',
    apply: (s) => toggleAmenity(s, 'wifi'),
  },
  {
    key: 'kitchen',
    label: '可以做饭',
    apply: (s) => toggleAmenity(s, 'kitchen'),
  },
  {
    key: 'ac',
    label: '空调',
    apply: (s) => toggleAmenity(s, 'air conditioning'),
  },
  {
    key: 'pool',
    label: '游泳池',
    apply: (s) => toggleAmenity(s, 'pool'),
  },
  {
    key: 'gym',
    label: '健身房',
    apply: (s) => toggleAmenity(s, 'gym'),
  },
  { key: 'self_checkin', label: '自助入住', demo: true },
  { key: 'chinese_host', label: '中文房东', demo: true },
]

/** 切换 amenity（在列表中的删，不在则加） */
function toggleAmenity(s: FilterState, amenity: string): Partial<FilterState> {
  const exists = s.amenities.includes(amenity)
  return {
    amenities: exists
      ? s.amenities.filter((a) => a !== amenity)
      : [...s.amenities, amenity],
  }
}

/** 判断 chip 是否 active（基于当前 FilterState） */
function isChipActive(chip: QuickChip, s: FilterState): boolean {
  if (chip.key === 'entire') return s.place_type === 'entire'
  if (chip.key === 'washer') return s.amenities.includes('washer')
  if (chip.key === 'wifi') return s.amenities.includes('wifi')
  if (chip.key === 'kitchen') return s.amenities.includes('kitchen')
  if (chip.key === 'ac') return s.amenities.includes('air conditioning')
  if (chip.key === 'pool') return s.amenities.includes('pool')
  if (chip.key === 'gym') return s.amenities.includes('gym')
  return false
}

export function FilterBar({ value, cities, onOpenModal, onChange }: FilterBarProps) {
  const toast = useToast()
  const [cityOpen, setCityOpen] = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭 dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!cityRef.current) return
      if (!cityRef.current.contains(e.target as Node)) setCityOpen(false)
    }
    if (cityOpen) {
      window.addEventListener('mousedown', onDown)
      return () => window.removeEventListener('mousedown', onDown)
    }
  }, [cityOpen])

  function onChipClick(chip: QuickChip) {
    if (chip.demo || !chip.apply) {
      toast.info('演示版暂不支持')
      return
    }
    const next = chip.apply(value)
    onChange(next)
  }

  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-[1760px] mx-auto px-4 md:px-6 py-3 flex items-center gap-2 md:gap-3 overflow-x-auto md:overflow-x-visible scrollbar-thin">
        {/* 筛选条件按钮 */}
        <button
          type="button"
          onClick={onOpenModal}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition font-medium text-slate-700 flex-shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>筛选条件</span>
        </button>

        {/* 位置区域 dropdown */}
        <div className="relative flex-shrink-0" ref={cityRef}>
          <button
            type="button"
            onClick={() => setCityOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50 transition font-medium ${
              value.city ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 text-slate-700'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>{value.city || '位置区域'}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {cityOpen && (
            <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto min-w-[260px]">
              <button
                type="button"
                onClick={() => {
                  onChange({ city: '' })
                  setCityOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700"
              >
                全部位置
              </button>
              {cities.map((c) => (
                <button
                  key={`${c.city}-${c.country}`}
                  type="button"
                  onClick={() => {
                    onChange({ city: c.city })
                    setCityOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-sm ${
                    value.city === c.city ? 'bg-slate-50 font-medium' : ''
                  }`}
                >
                  <span>
                    {c.city}
                    <span className="text-slate-400 ml-1">{c.country}</span>
                  </span>
                  <span className="text-xs text-slate-400">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 竖分隔 */}
        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

        {/* 已选房源类型 chips（从主页分类条跳转时可见，点 × 移除） */}
        <div className="contents md:flex md:flex-1 md:items-center md:gap-2 md:overflow-x-auto md:scrollbar-thin">
          {value.property_types.map((t) => (
            <button
              key={`pt-${t}`}
              type="button"
              onClick={() =>
                onChange({ property_types: value.property_types.filter((x) => x !== t) })
              }
              aria-label={`移除${PROPERTY_TYPE_LABELS[t] || t}筛选`}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border border-slate-900 bg-slate-900 text-white rounded-full text-sm transition hover:bg-slate-700"
            >
              {PROPERTY_TYPE_LABELS[t] || t}
              <X className="w-3.5 h-3.5" />
            </button>
          ))}
          {QUICK_CHIPS.map((chip) => {
            const active = isChipActive(chip, value)
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onChipClick(chip)}
                className={`flex-shrink-0 px-4 py-2 border rounded-full text-sm transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-slate-900'
                }`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
