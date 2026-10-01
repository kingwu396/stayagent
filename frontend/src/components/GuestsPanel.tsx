import { Minus, Plus } from 'lucide-react'

export interface GuestsValue {
  adults: number
  children: number
  infants: number
  pets: number
}

interface GuestsPanelProps {
  value: GuestsValue
  onChange: (v: GuestsValue) => void
}

interface GuestRow {
  key: keyof GuestsValue
  title: string
  subtitle: string
  min: number
  max: number
}

const ROWS: GuestRow[] = [
  { key: 'adults', title: '成人', subtitle: '13 岁或以上', min: 1, max: 16 },
  { key: 'children', title: '儿童', subtitle: '2 – 12 岁', min: 0, max: 16 },
  { key: 'infants', title: '婴儿', subtitle: '2 岁以下', min: 0, max: 5 },
  { key: 'pets', title: '宠物', subtitle: '需要携带服务类动物？', min: 0, max: 5 },
]

export function GuestsPanel({ value, onChange }: GuestsPanelProps) {
  function bump(key: keyof GuestsValue, delta: number) {
    const row = ROWS.find((r) => r.key === key)!
    const next = Math.max(row.min, Math.min(row.max, value[key] + delta))
    onChange({ ...value, [key]: next })
  }

  const total = value.adults + value.children

  return (
    <div className="p-6 w-full md:w-[420px]">
      <div className="divide-y divide-slate-200">
        {ROWS.map((row) => {
          const n = value[row.key]
          const atMin = n <= row.min
          const atMax = n >= row.max
          return (
            <div
              key={row.key}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">{row.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{row.subtitle}</div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <button
                  type="button"
                  onClick={() => bump(row.key, -1)}
                  disabled={atMin}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                    atMin
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'border-slate-300 text-slate-700 hover:border-slate-900'
                  }`}
                  aria-label={`减少${row.title}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-medium text-slate-900 tabular-nums">{n}</span>
                <button
                  type="button"
                  onClick={() => bump(row.key, 1)}
                  disabled={atMax}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                    atMax
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'border-slate-300 text-slate-700 hover:border-slate-900'
                  }`}
                  aria-label={`增加${row.title}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100">
        这间住所最多可接待 {total} 位客人（不含婴儿和宠物）
      </p>
    </div>
  )
}

/** 把 GuestsValue 转成简短显示文本（"3 位客人"） */
export function formatGuestsSummary(v: GuestsValue): string {
  const total = v.adults + v.children
  if (total === 0 && v.infants === 0 && v.pets === 0) return ''
  const parts: string[] = []
  if (total > 0) parts.push(`${total} 位客人`)
  if (v.infants > 0) parts.push(`${v.infants} 位婴儿`)
  if (v.pets > 0) parts.push(`${v.pets} 只宠物`)
  return parts.join('，')
}
