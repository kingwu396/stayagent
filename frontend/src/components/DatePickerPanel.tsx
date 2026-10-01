import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'

interface DatePickerPanelProps {
  checkIn: string // YYYY-MM-DD
  checkOut: string
  onChange: (inDate: string, outDate: string) => void
}

type Mode = 'specific' | 'flexible'

function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parse(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function startOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay() // 0=Sun
}

const MONTH_NAMES_ZH = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]
const WEEKDAY_NAMES_ZH = ['日', '一', '二', '三', '四', '五', '六']

export function DatePickerPanel({ checkIn, checkOut, onChange }: DatePickerPanelProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // 默认显示：当前月 + 下一月
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [mode, setMode] = useState<Mode>('specific')

  const inDate = parse(checkIn)
  const outDate = parse(checkOut)

  // 月份翻页
  function shift(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    while (m < 0) { m += 12; y -= 1 }
    while (m > 11) { m -= 12; y += 1 }
    setViewMonth(m)
    setViewYear(y)
  }

  // 点击日期 → 设置 checkIn / checkOut
  function onPick(d: Date) {
    d.setHours(0, 0, 0, 0)
    if (d < today) return // 过去日期不可选
    if (!inDate || (inDate && outDate)) {
      onChange(fmt(d), '')
    } else {
      if (d <= inDate) {
        onChange(fmt(d), '')
      } else {
        onChange(fmt(inDate), fmt(d))
      }
    }
  }

  // 灵活日期：选择天数 + 起点月份 → 自动算范围
  function onFlexibleDays(days: number) {
    const start = new Date(today)
    start.setDate(start.getDate() + 7) // 默认从今天 +7 开始
    const end = new Date(start)
    end.setDate(end.getDate() + days)
    onChange(fmt(start), fmt(end))
  }

  function inRange(d: Date): boolean {
    if (!inDate || !outDate) return false
    return d > inDate && d < outDate
  }
  function isStart(d: Date): boolean {
    return !!inDate && d.getTime() === inDate.getTime()
  }
  function isEnd(d: Date): boolean {
    return !!outDate && d.getTime() === outDate.getTime()
  }
  function isPast(d: Date): boolean {
    return d < today
  }

  return (
    <div className="p-6 max-h-[520px] overflow-y-auto">
      {/* 模式切换 */}
      <div className="flex items-center justify-center mb-5">
        <div className="inline-flex bg-slate-100 rounded-full p-1 relative">
          <button
            type="button"
            onClick={() => setMode('specific')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              mode === 'specific'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            指定日期
          </button>
          <button
            type="button"
            onClick={() => setMode('flexible')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              mode === 'flexible'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            日期灵活
          </button>
        </div>
        <button type="button" className="ml-3 text-slate-400 hover:text-slate-600">
          <Info className="w-4 h-4" />
        </button>
      </div>

      {mode === 'specific' ? (
        <>
          {/* 双月日历 */}
          <div className="flex gap-6">
            <MonthGrid
              year={viewYear}
              month={viewMonth}
              inRange={inRange}
              isStart={isStart}
              isEnd={isEnd}
              isPast={isPast}
              onPick={onPick}
              onPrev={() => shift(-1)}
            />
            <MonthGrid
              year={viewYear}
              month={viewMonth + 1 > 11 ? 0 : viewMonth + 1}
              viewYear={viewYear + (viewMonth + 1 > 11 ? 1 : 0)}
              inRange={inRange}
              isStart={isStart}
              isEnd={isEnd}
              isPast={isPast}
              onPick={onPick}
              onNext={() => shift(1)}
            />
          </div>
        </>
      ) : (
        <div className="space-y-5">
          <p className="text-center text-sm text-slate-600">
            选择停留时长
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { label: '确切日期', days: 0 },
              { label: '± 1 天', days: 1 },
              { label: '± 2 天', days: 2 },
              { label: '± 3 天', days: 3 },
              { label: '± 7 天', days: 7 },
              { label: '± 14 天', days: 14 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => opt.days > 0 && onFlexibleDays(opt.days)}
                className={`px-4 py-2 border rounded-full text-sm transition ${
                  opt.days === 0
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-slate-300 text-slate-700 hover:border-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 text-center pt-2">
            灵活日期将匹配相近的住宿
          </p>
        </div>
      )}

      {/* 已选显示 */}
      {(checkIn || checkOut) && (
        <div className="mt-5 pt-5 border-t border-slate-200 text-sm text-slate-600 text-center">
          {checkIn && <span>入住: <span className="font-medium text-slate-900">{checkIn}</span></span>}
          {checkIn && checkOut && <span className="mx-2">·</span>}
          {checkOut && <span>退房: <span className="font-medium text-slate-900">{checkOut}</span></span>}
        </div>
      )}
    </div>
  )
}

function MonthGrid({
  year,
  month,
  viewYear,
  inRange,
  isStart,
  isEnd,
  isPast,
  onPick,
  onPrev,
  onNext,
}: {
  year: number
  month: number
  viewYear?: number
  inRange: (d: Date) => boolean
  isStart: (d: Date) => boolean
  isEnd: (d: Date) => boolean
  isPast: (d: Date) => boolean
  onPick: (d: Date) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const days = daysInMonth(year, month)
  const firstWeekday = startOfMonth(year, month)
  const titleYear = viewYear ?? year

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        {onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-8" />
        )}
        <h4 className="text-sm font-semibold text-slate-900">
          {titleYear} 年 {MONTH_NAMES_ZH[month]}
        </h4>
        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-slate-400 mb-1">
        {WEEKDAY_NAMES_ZH.map((w) => (
          <div key={w} className="text-center py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <div key={`e-${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const d = new Date(year, month, day)
          d.setHours(0, 0, 0, 0)
          const past = isPast(d)
          const start = isStart(d)
          const end = isEnd(d)
          const mid = inRange(d)
          const today = d.getTime() === new Date().setHours(0, 0, 0, 0)

          return (
            <button
              key={day}
              type="button"
              disabled={past}
              onClick={() => onPick(d)}
              className={[
                'aspect-square flex items-center justify-center text-sm rounded-full transition relative',
                past ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100',
                mid ? 'bg-brand-50 text-brand-700 rounded-none' : '',
                start || end ? 'bg-brand-500 text-white font-semibold hover:bg-brand-500' : '',
                today && !start && !end ? 'ring-1 ring-rose-200 text-rose-600' : '',
              ].filter(Boolean).join(' ')}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
