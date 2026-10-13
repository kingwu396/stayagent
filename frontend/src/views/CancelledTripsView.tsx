/** Block 28: 已取消订单专页
 *
 * 行程页不再展示 cancelled 订单, 收到这里; 每单标明取消原因:
 * - user    → 你主动取消 (灰)
 * - host    → 房东取消 (橙)
 * - expired → 超时未支付, 自动取消 (红)
 * - null    → 已取消 (老数据兜底, Block 28 之前的取消没有原因字段)
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Ban, Calendar, Clock, Hotel, UserX, Users } from 'lucide-react'
import { UserMenu } from '@/components/UserMenu'
import { Skeleton } from '@/components/Skeleton'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { bookingsApi } from '@/api/bookings'
import type { Booking, BookingCancelReason } from '@/types/booking'
import { apiErrorText } from '@/lib/utils'

/** 取消原因 → 徽标样式 + 文案 */
const REASON_META: Record<BookingCancelReason | 'unknown', { label: string; cls: string }> = {
  user: { label: '你主动取消', cls: 'bg-slate-100 text-slate-600' },
  host: { label: '房东取消', cls: 'bg-orange-100 text-orange-700' },
  expired: { label: '超时未支付 · 自动取消', cls: 'bg-rose-100 text-rose-700' },
  unknown: { label: '已取消', cls: 'bg-slate-100 text-slate-600' },
}

function reasonMeta(b: Booking) {
  return REASON_META[b.cancel_reason ?? 'unknown']
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtMoney(v: string): string {
  return `¥${parseFloat(v).toFixed(2)}`
}

export function CancelledTripsView() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await bookingsApi.list()
      setBookings(data.items.filter((b) => b.status === 'cancelled'))
    } catch (err: any) {
      setError(apiErrorText(err, '加载失败'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Topbar (与行程页一致) */}
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
        <header className="mb-12">
          <Link
            to="/trips"
            className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-ink mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> 返回行程
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-2 tracking-tight">
            已取消的订单
          </h1>
          <p className="text-sm text-stone-500">
            {!isLoading && bookings.length > 0
              ? `共 ${bookings.length} 笔已取消订单`
              : '这里只显示已取消的订单'}
          </p>
        </header>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-paper border border-slate-200 rounded-md p-6 flex gap-6">
                <Skeleton className="h-16 w-32" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && <ErrorState description={error} onRetry={load} />}

        {!isLoading && !error && bookings.length === 0 && (
          <EmptyState
            icon={<Ban className="w-8 h-8" />}
            title="没有已取消的订单"
            description="主动取消、房东取消或超时未支付的订单会出现在这里。"
          />
        )}

        {!isLoading && !error && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((b) => {
              const reason = reasonMeta(b)
              return (
                <article
                  key={b.id}
                  className="bg-paper border border-slate-200 rounded-md p-6 opacity-75"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* 房源图 */}
                    <div className="w-full md:w-32 h-24 md:h-20 rounded overflow-hidden bg-slate-100 flex-shrink-0">
                      {b.listing.primary_image ? (
                        <img
                          src={b.listing.primary_image}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Hotel className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-ink line-clamp-1">
                          {b.listing.title}
                        </h3>
                        {/* 取消原因徽标 */}
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${reason.cls}`}
                        >
                          {b.cancel_reason === 'expired' ? (
                            <Clock className="w-3 h-3" />
                          ) : b.cancel_reason === 'host' ? (
                            <UserX className="w-3 h-3" />
                          ) : (
                            <Ban className="w-3 h-3" />
                          )}
                          {reason.label}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500 mb-2">
                        {b.listing.city}, {b.listing.country} · 订单 #{b.id}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmtDate(b.check_in)} ~ {fmtDate(b.check_out)} · {b.nights} 晚
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {b.guests} 位客人
                        </span>
                        <span className="text-stone-500">
                          {fmtMoney(b.total)} 合计
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end flex-shrink-0">
                      <Link
                        to={`/listings/${b.listing_id}`}
                        className="text-xs text-stone-500 hover:text-ink underline-offset-4 hover:underline"
                      >
                        查看房源
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
