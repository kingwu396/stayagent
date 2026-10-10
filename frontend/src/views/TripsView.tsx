import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Hotel, Calendar, Users } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { Skeleton } from '@/components/Skeleton'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { bookingsApi } from '@/api/bookings'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/ConfirmModal'
import type { Booking } from '@/types/booking'

function formatMoney(decimalStr: string): string {
  // 后端返 "106.50"，前端只 .00 → "106.50"
  return `¥${parseFloat(decimalStr).toFixed(2)}`
}

export function TripsView() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canceling, setCanceling] = useState<number | null>(null)
  // Block 23: 待确认取消的预订(替代原生 confirm)
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null)
  const toast = useToast()

  async function load(opts: { silent?: boolean } = {}) {
    // silent: 后台轮询不闪 skeleton, 只静默更新数据
    if (!opts.silent) setIsLoading(true)
    setError(null)
    try {
      const data = await bookingsApi.list()
      setBookings(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // 房东取消/支付过期都发生在服务端, 前端无推送 —
    // 页面可见时每 30s 静默轮询 + 切回标签页立即刷新, 保证订单状态及时更新
    const refresh = () => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }
    const t = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  async function onConfirmCancel() {
    if (!pendingCancel || canceling !== null) return
    const b = pendingCancel
    setCanceling(b.id)
    try {
      await bookingsApi.cancel(b.id)
      toast.info('预订已取消')
      setPendingCancel(null)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '取消失败')
    } finally {
      setCanceling(null)
    }
  }

  // Block 28: 已取消订单不在行程页展示, 收进专门的「已取消订单」页
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled')
  const cancelledCount = bookings.length - activeBookings.length

  const totalNights = activeBookings.reduce((sum, b) => sum + b.nights, 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Topbar */}
      <header className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-ink">StayAgent</span>
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        {/* Title */}
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-2 tracking-tight">
            你的行程
          </h1>
          <p className="text-sm text-stone-500">
            {!isLoading && activeBookings.length > 0
              ? `共 ${activeBookings.length} 段行程 · ${totalNights} 晚`
              : '还没有预订的行程'}
          </p>
          {/* Block 28: 已取消订单收进专门页面 */}
          {!isLoading && (
            <Link
              to="/trips/cancelled"
              className="inline-flex items-center gap-1 mt-3 text-sm text-stone-500 hover:text-ink underline-offset-4 hover:underline"
            >
              已取消的订单{cancelledCount > 0 ? ` (${cancelledCount})` : ''}
            </Link>
          )}
        </header>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-paper border border-slate-200 rounded-md p-6">
                <div className="flex gap-6">
                  <Skeleton className="h-16 w-32" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && <ErrorState description={error} onRetry={load} />}

        {/* Empty */}
        {!isLoading && !error && activeBookings.length === 0 && (
          <EmptyState
            title="还没有任何行程"
            description="从房源详情页预订后，你的行程会出现在这里。"
          />
        )}

        {/* Bookings list */}
        {!isLoading && !error && activeBookings.length > 0 && (
          <div className="space-y-4">
            {activeBookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                on取消={() => setPendingCancel(b)}
                canceling={canceling === b.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Block 23: 取消确认弹窗(替代原生 confirm) */}
      <ConfirmModal
        open={pendingCancel !== null}
        title="取消预订？"
        description={
          pendingCancel ? (
            <>
              确认取消「<span className="font-medium">{pendingCancel.listing.title}</span>
              」的预订？此操作不可撤销。
            </>
          ) : (
            ''
          )
        }
        confirmText="确认取消"
        loading={canceling !== null}
        onConfirm={onConfirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  )
}


interface BookingRowProps {
  booking: Booking
  on取消: () => void
  canceling: boolean
}

/** Block 30: 状态徽标 (彩色 pill, 与房东订单中心视觉统一) */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '待支付', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: '已确认', cls: 'bg-emerald-100 text-emerald-800' },
  completed: { label: '已完成', cls: 'bg-slate-200 text-slate-700' },
  cancelled: { label: '已取消', cls: 'bg-rose-100 text-rose-700' },
}

function fmtRangeDate(iso: string): { m: string; d: string } {
  const dt = new Date(iso)
  return {
    m: dt.toLocaleDateString('zh-CN', { month: 'short' }).replace('月', '月'),
    d: String(dt.getDate()).padStart(2, '0'),
  }
}

function BookingRow({ booking: b, on取消, canceling }: BookingRowProps) {
  const status = STATUS_META[b.status] ?? { label: b.status, cls: 'bg-slate-100 text-slate-600' }
  const inDate = fmtRangeDate(b.check_in)
  const outDate = fmtRangeDate(b.check_out)
  const cover =
    b.listing.primary_image ||
    `https://picsum.photos/seed/stayagent-${b.listing_id}/640/480`

  return (
    <article className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row">
        {/* 房源封面 (16:10, 点击直达详情) */}
        <Link
          to={`/listings/${b.listing_id}`}
          className="relative sm:w-56 h-44 sm:h-auto flex-shrink-0 overflow-hidden"
        >
          <img
            src={cover}
            alt={b.listing.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
          {/* 状态徽标浮层 */}
          <span
            className={`absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm ${status.cls}`}
          >
            {status.label}
          </span>
        </Link>

        {/* 信息区 */}
        <div className="flex-1 min-w-0 p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-ink line-clamp-1">
                {b.listing.title}
              </h3>
              <p className="text-sm text-stone-500 mt-0.5">
                {b.listing.city}, {b.listing.country}
                <span className="text-stone-300 mx-1.5">·</span>
                <span className="text-xs">订单 #{b.id}</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xl font-bold text-ink tabular-nums">
                {formatMoney(b.total)}
              </div>
              <div className="text-xs text-stone-400">合计</div>
            </div>
          </div>

          {/* 入住/退房 双格日期面板 */}
          <div className="grid grid-cols-2 max-w-xs mt-4 border border-slate-200 rounded-xl overflow-hidden divide-x divide-slate-200">
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">入住</div>
              <div className="text-sm font-semibold text-ink">
                {inDate.m} {inDate.d} 日
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">退房</div>
              <div className="text-sm font-semibold text-ink">
                {outDate.m} {outDate.d} 日
              </div>
            </div>
          </div>

          {/* meta + 操作 */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs text-stone-600">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {b.nights} 晚
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {b.guests} 位客人
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/listings/${b.listing_id}`}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-ink border border-slate-200 rounded-lg hover:border-slate-300 transition"
              >
                查看房源
              </Link>
              {b.status !== 'completed' && (
                <button
                  onClick={on取消}
                  disabled={canceling}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 border border-slate-200 rounded-lg transition disabled:opacity-50"
                >
                  {canceling ? '取消中…' : '取消预订'}
                </button>
              )}
            </div>
          </div>

          {/* 待支付: 高亮行动条 (15 分钟时限, 与支付页一致) */}
          {b.status === 'pending' && (
            <div className="flex items-center gap-3 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <span className="flex-1 text-xs text-amber-800">
                ⏳ 订单待支付, 超时将自动取消
              </span>
              <Link
                to={`/payment/${b.id}`}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex-shrink-0"
              >
                去支付
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
