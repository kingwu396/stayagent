import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CityInfo } from '@/types/listing'

export interface FilterValues {
  city: string
  property_type: string[]   // 多选
  min_price: string
  max_price: string
  min_guests: string
  check_in: string
  check_out: string
}

interface FilterModalProps {
  open: boolean
  initial: FilterValues
  cities: CityInfo[]
  onClose: () => void
  onApply: (values: FilterValues) => void
}

const PROPERTY_TYPES = [
  { value: 'apartment', label: '公寓' },
  { value: 'house', label: '民居' },
  { value: 'villa', label: '别墅' },
  { value: 'hotel', label: '酒店' },
  { value: 'studio', label: '工作室' },
]

export function FilterModal({ open, initial, cities, onClose, onApply }: FilterModalProps) {
  const [values, setValues] = useState<FilterValues>(initial)

  // 当 modal 重新打开时同步初始值
  useEffect(() => {
    if (open) setValues(initial)
  }, [open, initial])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function toggleType(type: string) {
    setValues((v) => ({
      ...v,
      property_type: v.property_type.includes(type)
        ? v.property_type.filter((t) => t !== type)
        : [...v.property_type, type],
    }))
  }

  function clearAll() {
    setValues({
      city: '',
      property_type: [],
      min_price: '',
      max_price: '',
      min_guests: '',
      check_in: '',
      check_out: '',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <button onClick={clearAll} className="text-sm text-slate-600 hover:text-slate-900 underline">
            清除全部
          </button>
          <h2 className="text-lg font-semibold text-slate-900">筛选</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 价格 */}
          <Section title="价格范围（每晚）">
            <div className="flex items-center gap-3">
              <NumberInput
                placeholder="最低"
                value={values.min_price}
                onChange={(v) => setValues((s) => ({ ...s, min_price: v }))}
              />
              <span className="text-slate-400">—</span>
              <NumberInput
                placeholder="最高"
                value={values.max_price}
                onChange={(v) => setValues((s) => ({ ...s, max_price: v }))}
              />
            </div>
          </Section>

          {/* 城市 */}
          <Section title="目的地">
            <select
              value={values.city}
              onChange={(e) => setValues((s) => ({ ...s, city: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">所有城市</option>
              {cities.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}, {c.country} ({c.count})
                </option>
              ))}
            </select>
          </Section>

          {/* 房源类型 */}
          <Section title="房源类型">
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => {
                const active = values.property_type.includes(t.value)
                return (
                  <button
                    key={t.value}
                    onClick={() => toggleType(t.value)}
                    className={`px-4 py-2 rounded-full border text-sm transition ${
                      active
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* 人数 */}
          <Section title="至少可容纳人数">
            <NumberInput
              placeholder="不限"
              value={values.min_guests}
              onChange={(v) => setValues((s) => ({ ...s, min_guests: v }))}
              min={1}
            />
          </Section>

          {/* 日期（placeholder，Block 5 不响应） */}
          <Section title="入住 / 退房日期">
            <div className="flex items-center gap-3">
              <DateInput
                value={values.check_in}
                onChange={(v) => setValues((s) => ({ ...s, check_in: v }))}
              />
              <span className="text-slate-400">—</span>
              <DateInput
                value={values.check_out}
                onChange={(v) => setValues((s) => ({ ...s, check_out: v }))}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              日期筛选将在后续 Block 接入
            </p>
          </Section>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition"
          >
            取消
          </button>
          <button
            onClick={() => onApply(values)}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition"
          >
            应用筛选
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  min?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
    />
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
    />
  )
}
