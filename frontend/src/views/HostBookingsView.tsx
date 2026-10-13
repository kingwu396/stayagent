/** Block 27: 房东订单中心
 *
 * 房东查看自己房源收到的所有订单, 按状态 tab + 房源筛选, 并做状态流转:
 * - 确认: pending → confirmed (线下收款, 支付单置 succeeded)
 * - 取消: pending/confirmed → cancelled (作废未支付支付单)
 * - 完成: confirmed (已退房) → completed
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Ban, CheckCheck } from 'lucide-react'
import { hostApi } from '@/api/host'
import { useToast } from '@/hooks/useToast'
import { ErrorState } from '@/components/ErrorState'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmModal } from '@/components/ConfirmModal'
import type { HostBookingItem, HostListingStat } from '@/types/host'
import { apiErrorText } from '@/lib/utils'

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待支付' },
  { key: 'confirmed', label: '已确认' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
] as const

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-100 text-rose-700',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待支付',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消',
}

/** Block 28: 取消原因徽标 (房东视角文案) */
const CANCEL_REASON_META: Record<string, { label: string; cls: string }> = {
  user: { label: '房客取消', cls: 'bg-slate-100 text-slate-600' },
  host: { label: '我取消的', cls: 'bg-orange-100 text-orange-700' },
  expired: { label: '超时未支付', cls: 'bg-rose-100 text-rose-700' },
}

function fmtDate(s: string) {
  // "2026-10-10" 或 ISO 全串都截前 10 位
  return s.slice(0, 10)
}

export function HostBookingsView() {
  const toast = useToast()
  const [state, setState] = useState<{
    loading: boolean
    error: string | null
    items: HostBookingItem[]
    total: number
  }>({ loading: true, error: null, items: [], total: 0 })
  const [listings, setListings] = useState<HostListingStat[]>([])
  const [statusTab, setStatusTab] = useState<string>('')
  const [listingFilter, setListingFilter] = useState<string>('')
  // 待二次确认的操作
  const [action, setAction] = useState<
    | { kind: 'confirm' | 'cancel' | 'complete'; booking: HostBookingItem }
    | null
  >(null)
  const [acting, setActing] = useState(false)

  function load() {
    setState((s) => ({ ...s, loading: true, error: null }))
    hostApi
      .getBookings({
        status: statusTab || undefined,
        listing_id: listingFilter ? Number(listingFilter) : undefined,
      })
      .then((res) => {
        setState({ loading: false, error: null, items: res.items, total: res.total })
      })
      .catch((err: any) => {
        const msg = apiErrorText(err, '订单加载失败')
        setState({ loading: false, error: msg, items: [], total: 0 })
      })
  }

  useEffect(() => {
    load()
  }, [statusTab, listingFilter])

  // 房源下拉选项 (只拉一次, 用于筛选)
  useEffect(() => {
    hostApi
      .getListings()
      .then((res) => setListings(res.items))
      .catch(() => {}) // 下拉加载失败不阻塞主列表
  }, [])

  async function doAction() {
    if (!action) return
    setActing(true)
    const { kind, booking } = action
    try {
      if (kind === 'confirm') await hostApi.confirmBooking(booking.id)
      else if (kind === 'cancel') await hostApi.cancelBooking(booking.id)
      else await hostApi.completeBooking(booking.id)
      toast.success(`订单 #${booking.id} 已${STATUS_ACTION_LABEL[kind]}`)
      setAction(null)
      load()
    } catch (err: any) {
      toast.error(apiErrorText(err, '操作失败'))
    } finally {
      setActing(false)
    }
  }

  const { loading, error, items } = state
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">房东订单</h1>
          <p className="text-sm text-slate-500 mt-1">管理房客对你房源的预订</p>
        </div>
        <Link to="/host" className="text-sm text-brand-600 hover:text-brand-700">
          ← 返回房东后台
        </Link>
      </div>

      {/* 状态 tab + 房源筛选 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 rounded-full p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={
                'px-3.5 py-1.5 rounded-full text-sm transition ' +
                (statusTab === tab.key
                  ? 'bg-white shadow text-slate-900 font-medium'
                  : 'text-slate-500 hover:text-slate-800')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={listingFilter}
          onChange={(e) => setListingFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-full text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-56"
        >
          <option value="">全部房源</option>
          {listings.map((l) => (
            <option key={l.listing_id} value={l.listing_id}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-28 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="暂无订单"
          description={statusTab ? '当前筛选条件下没有订单' : '房客预订后会出现在这里'}
        />
      ) : (
        <div className="space-y-3">
          {items.map((b) => (
            <div
              key={b.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
            >
              {/* 房源图 + 信息 */}
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                  {b.listing_image ? (
                    <img src={b.listing_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 line-clamp-1">{b.listing_title}</span>
                    <span className={'text-xs px-1.5 py-0.5 rounded flex-shrink-0 ' + STATUS_BADGE[b.status]}>
                      {STATUS_LABEL[b.status] || b.status}
                    </span>
                    {b.status === 'cancelled' && b.cancel_reason && (
                      <span
                        className={
                          'text-xs px-1.5 py-0.5 rounded flex-shrink-0 ' +
                          (CANCEL_REASON_META[b.cancel_reason]?.cls ?? 'bg-slate-100 text-slate-600')
                        }
                      >
                        {CANCEL_REASON_META[b.cancel_reason]?.label ?? '已取消'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    房客 {b.guest_username} · 订单 #{b.id}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {fmtDate(b.check_in)} ~ {fmtDate(b.check_out)} · {b.nights} 晚 · {b.guests} 人
                  </div>
                  <div className="text-base font-semibold text-slate-900 mt-1 tabular-nums">
                    ¥{Number(b.total).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 操作 */}
              <div className="flex sm:flex-col gap-2 justify-end flex-shrink-0">
                {b.status === 'pending' && (
                  <button
                    onClick={() => setAction({ kind: 'confirm', booking: b })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> 确认订单
                  </button>
                )}
                {b.status === 'confirmed' && b.check_out < today && (
                  <button
                    onClick={() => setAction({ kind: 'complete', booking: b })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> 完结
                  </button>
                )}
                {(b.status === 'pending' || b.status === 'confirmed') && (
                  <button
                    onClick={() => setAction({ kind: 'cancel', booking: b })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 hover:border-rose-400 hover:text-rose-600 text-slate-700 text-xs font-medium rounded-lg transition"
                  >
                    <Ban className="w-3.5 h-3.5" /> 取消
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={action !== null}
        title={
          action?.kind === 'confirm' ? '确认该订单?' : action?.kind === 'cancel' ? '取消该订单?' : '完结该订单?'
        }
        description={
          action
            ? action.kind === 'confirm'
              ? `确认订单 #${action.booking.id} 视为已线下收款, 状态变为已确认.`
              : action.kind === 'cancel'
                ? `取消后订单 #${action.booking.id} 不可恢复, 未支付的支付单将作废.`
                : `订单 #${action.booking.id} 已退房, 完结后状态变为已完成.`
            : ''
        }
        confirmText={action?.kind === 'cancel' ? '取消订单' : '确认'}
        danger={action?.kind === 'cancel'}
        loading={acting}
        onConfirm={doAction}
        onCancel={() => !acting && setAction(null)}
      />
    </div>
  )
}

const STATUS_ACTION_LABEL: Record<string, string> = {
  confirm: '确认',
  cancel: '取消',
  complete: '完结',
}
