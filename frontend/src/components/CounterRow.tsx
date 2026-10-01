import { Minus, Plus } from 'lucide-react'

interface CounterRowProps {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}

/**
** 计数器行：左侧 label，右侧 - N +
** 0 = "任意" 不可再减
** max 边界 +按钮 disabled
*/
export function CounterRow({ label, value, onChange, min = 0, max = 10 }: CounterRowProps) {
  const atMin = value <= min
  const atMax = value >= max
  const display = value === 0 ? '任意' : String(value)
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-b-0">
      <span className="text-base font-medium text-slate-900">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={atMin}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
            atMin
              ? 'border-slate-200 text-slate-300 cursor-not-allowed'
              : 'border-slate-300 text-slate-700 hover:border-slate-900'
          }`}
          aria-label={`减少${label}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-10 text-center text-base text-slate-900 tabular-nums">
          {display}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={atMax}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
            atMax
              ? 'border-slate-200 text-slate-300 cursor-not-allowed'
              : 'border-slate-300 text-slate-700 hover:border-slate-900'
          }`}
          aria-label={`增加${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
