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

function formatDate(iso: string): { day: string; month: string; year: string } {
  const d = new Date(iso)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    year: String(d.getFullYear()),
  }
}

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

  async function load() {
    setIsLoading(true)
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

  const totalNights = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.nights, 0)

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
            {!isLoading && total > 0
              ? `共 ${total} 段行程 · ${totalNights} 晚`
              : '还没有预订的行程'}
          </p>
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
        {!isLoading && !error && bookings.length === 0 && (
          <EmptyState
            title="还没有任何行程"
            description="从房源详情页预订后，你的行程会出现在这里。"
          />
        )}

        {/* Bookings list */}
        {!isLoading && !error && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((b) => (
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

function BookingRow({ booking: b, on取消, canceling }: BookingRowProps) {
  const is取消led = b.status === 'cancelled'
  const checkIn = formatDate(b.check_in)
  const checkOut = formatDate(b.check_out)

  return (
    <article
      className={`bg-paper border border-slate-200 rounded-md p-6 transition ${
        is取消led ? 'opacity-50' : 'hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        {/* Date block (主视觉) */}
        <div className="flex md:flex-col items-baseline md:items-start gap-3 md:gap-1 md:min-w-[140px]">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ink leading-none">
              {checkIn.day}
            </span>
            <span className="text-xs text-stone-500 uppercase tracking-wider">
              {checkIn.month}
            </span>
          </div>
          <div className="text-xs text-stone-400">→</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-ink leading-none">
              {checkOut.day}
            </span>
            <span className="text-xs text-stone-500 uppercase tracking-wider">
              {checkOut.month}
            </span>
          </div>
          <span className="text-xs text-stone-500 mt-1">{checkIn.year}</span>
        </div>

        {/* 分隔线 */}
        <div className="hidden md:block w-px h-24 bg-slate-200" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-xl font-bold text-ink mb-1 ${is取消led ? 'line-through' : ''}`}>
            {b.listing.title}
          </h3>
          <p className="text-sm text-stone-500 mb-3">
            {b.listing.city}, {b.listing.country}
          </p>

          {/* Meta line */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 mb-3">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {b.nights} 晚
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {b.guests} 位客人
            </span>
          </div>

          {/* Price + status */}
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-stone-600">
              {formatMoney(b.total)} <span className="text-xs text-stone-400">合计</span>
            </span>
            <span className="text-xs text-stone-500">
              {statusText(b)}
            </span>
          </div>

          {/* Actions */}
          {!is取消led && (
            <div className="flex items-center justify-end gap-2 mt-3">
              <Link
                to={`/listings/${b.listing_id}`}
                className="text-xs text-stone-500 hover:text-ink underline-offset-4 hover:underline"
              >
                查看房源
              </Link>
              <button
                onClick={on取消}
                disabled={canceling}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded transition disabled:opacity-50"
              >
                {canceling ? '取消中…' : '取消'}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function statusText(b: Booking): string {
  const d = new Date(b.created_at).toLocaleDateString('zh-CN')
  const map: Record<string, string> = {
    confirmed: `已确认 · ${d} 预订`,
    cancelled: `已取消 · ${d} 预订`,
    completed: `已完成 · ${d} 入住`,
    pending: `待确认 · ${d} 预订`,
  }
  return map[b.status] || b.status
}
