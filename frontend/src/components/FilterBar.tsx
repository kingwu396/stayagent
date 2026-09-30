import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { FilterChip } from './FilterChip'
import { FilterModal, type FilterValues } from './FilterModal'
import type { CityInfo } from '@/types/listing'

interface FilterBarProps {
  values: FilterValues
  cities: CityInfo[]
  activeCount: number
  onApply: (v: FilterValues) => void
  onClear: () => void
}

export function FilterBar({ values, cities, activeCount, onApply, onClear }: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const [qInput, setQInput] = useState('')

  const chips: { label: string; onRemove: () => void }[] = []
  if (values.city) {
    chips.push({ label: values.city, onRemove: () => onApply({ ...values, city: '' }) })
  }
  values.property_type.forEach((t) => {
    chips.push({
      label: typeLabel(t),
      onRemove: () =>
        onApply({ ...values, property_type: values.property_type.filter((x) => x !== t) }),
    })
  })
  if (values.min_price || values.max_price) {
    const label = `¥${values.min_price || '0'} - ¥${values.max_price || '∞'}`
    chips.push({
      label,
      onRemove: () => onApply({ ...values, min_price: '', max_price: '' }),
    })
  }
  if (values.min_guests) {
    chips.push({
      label: `${values.min_guests}+ 人`,
      onRemove: () => onApply({ ...values, min_guests: '' }),
    })
  }

  function onSearch() {
    onApply({ ...values, q: qInput })
  }

  return (
    <>
      <section className="sticky top-[60px] z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 space-y-3">
          {/* Row 1: search input + filters button */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索房源标题..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch()
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-5 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition font-medium text-slate-700 relative"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>筛选</span>
              {activeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-brand-500 text-white text-xs font-semibold rounded-full">
                  {activeCount}
                </span>
              )}
            </button>
            <button
              onClick={onSearch}
              className="px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-medium transition"
            >
              搜索
            </button>
          </div>

          {/* Row 2: active filter chips + clear all */}
          {chips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {chips.map((chip, i) => (
                <FilterChip key={i} label={chip.label} onRemove={chip.onRemove} />
              ))}
              <button
                onClick={onClear}
                className="text-sm text-slate-500 hover:text-slate-900 underline ml-2"
              >
                清除全部
              </button>
            </div>
          )}
        </div>
      </section>

      <FilterModal
        open={open}
        initial={values}
        cities={cities}
        onClose={() => setOpen(false)}
        onApply={(v) => {
          onApply(v)
          setOpen(false)
        }}
      />
    </>
  )
}

function typeLabel(t: string): string {
  return { apartment: '公寓', house: '民居', villa: '别墅', hotel: '酒店', studio: '工作室' }[t] || t
}
