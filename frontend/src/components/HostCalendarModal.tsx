/** Block 27: 房态日历模态
 *
 * 房源表格「日历」入口打开: 月历网格展示 pending/confirmed 订单的占位日期.
 * - confirmed: 红色 (已确定占用)
 * - pending: 黄色 (待支付, 暂占位)
 * 占位语义: [check_in, check_out) 的夜晚, 退房日当天不占.
 * 纯展示, 不支持改价/锁房 (演示项目, 后续 Block 可扩展).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { hostApi } from '@/api/host'
import type { HostCalendarBooking } from '@/types/host'

interface HostCalendarModalProps {
  open: boolean
  listingId: number
  listingTitle: string
  onClose: () => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function HostCalendarModal({ open, listingId, listingTitle, onClose }: HostCalendarModalProps) {
  const [cursor, setCursor] = useState(() => new Date()) // 当前展示的月份
  const [items, setItems] = useState<HostCalendarBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 打开时重置到当前月
  useEffect(() => {
    if (open) {
      setCursor(new Date())
      setError(null)
    }
  }, [open])

  // 拉当月占位 (cursor 变化时)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    hostApi
      .getListingCalendar(listingId, monthKey(cursor))
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.detail || '日历加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, listingId, cursor])

  // 展开成 { dateStr: status } 映射 (退房日不占)
  const occupied = useMemo(() => {
    const map = new Map<string, 'pending' | 'confirmed'>()
    for (const b of items) {
      const start = new Date(b.check_in + 'T00:00:00')
      const end = new Date(b.check_out + 'T00:00:00') // exclusive
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        // confirmed 优先级高于 pending
        if (map.get(key) !== 'confirmed') map.set(key, b.status)
      }
    }
    return map
  }, [items])

  // 当月日历格子 (周一起始, 前置留白)
  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // getDay: 0=周日; 周一起始偏移 = (day+6)%7
    const lead = (firstDay.getDay() + 6) % 7
    const arr: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    return arr
  }, [cursor])

  if (!open) return null

  const todayStr = new Date().toISOString().slice(0, 10)

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="房态日历"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">房态日历</h3>
            <p className="text-xs text-slate-500 truncate">{listingTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 月份切换 */}
        <div className="flex items-center justify-between px-5 py-3">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
            aria-label="上个月"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-900 tabular-nums">
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </span>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
            aria-label="下个月"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 日历网格 */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-xs text-slate-400 py-1">
                {w}
              </div>
            ))}
          </div>
          {loading ? (
            <div className="py-12 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-rose-500">{error}</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`blank-${i}`} />
                const occ = occupied.get(dateStr)
                const isToday = dateStr === todayStr
                return (
                  <div
                    key={dateStr}
                    title={
                      occ
                        ? occ === 'confirmed'
                          ? `已确认 (订单占位)`
                          : '待支付 (暂占位)'
                        : undefined
                    }
                    className={
                      'aspect-square rounded-lg flex items-center justify-center text-sm relative ' +
                      (occ === 'confirmed'
                        ? 'bg-rose-500 text-white'
                        : occ === 'pending'
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-50 text-slate-700') +
                      (isToday && !occ ? ' ring-2 ring-brand-400' : '')
                    }
                  >
                    {Number(dateStr.slice(8))}
                    {isToday && occ && (
                      <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 图例 */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500" /> 已确认
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-400" /> 待支付
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> 空闲
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
