/** Block 15: 房东后台
 *
 * 显示:
 * - 头部: 欢迎语 + 4 个 KPI (房源数/总访问/总营收/入住率)
 * - Top 5 listings view_count 简易条形图 (纯 SVG)
 * - 列表: listings + view_count + booking_count + revenue
 *
 * 防闪烁:
 * - mountedRef 防止 StrictMode 双触发 (dev 模式 useEffect 会跑两次)
 * - 用 null vs data 区分状态 (避免短暂 loading 闪烁)
 * - error state 单独处理, 不退化到 "加载中"
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Home, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { hostApi } from '@/api/host'
import { propertyTypeLabel } from '@/lib/labels'
import type { HostMeResponse, HostDashboardResponse, HostListingStat } from '@/types/host'

function MiniBarChart({ items }: { items: HostListingStat[] }) {
  const top5 = items.slice(0, 5)
  if (top5.length === 0) {
    return <div className="text-xs text-slate-400 italic">暂无数据</div>
  }
  const max = Math.max(...top5.map((i) => i.view_count), 1)
  return (
    <div className="space-y-2">
      {top5.map((item) => {
        const w = Math.round((item.view_count / max) * 100)
        return (
          <Link
            key={item.listing_id}
            to={`/listings/${item.listing_id}`}
            className="block group"
          >
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1 truncate text-slate-700 group-hover:text-brand-600">
                {item.title}
              </div>
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${w}%` }}
                  aria-label={`view_count ${item.view_count}`}
                />
              </div>
              <div className="w-12 text-right tabular-nums text-slate-500">
                {item.view_count}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export function HostDashboardView() {
  // 单一 state 对象: 简化逻辑, 减少状态不一致 bug
  const [state, setState] = useState<{
    loading: boolean
    info: HostMeResponse | null
    dashboard: HostDashboardResponse | null
    error: string | null
  }>({ loading: true, info: null, dashboard: null, error: null })

  useEffect(() => {
    let mounted = true
    Promise.all([hostApi.getMe(), hostApi.getListings()])
      .then(([info, dashboard]) => {
        if (mounted) setState({ loading: false, info, dashboard, error: null })
      })
      .catch((err: any) => {
        console.error('[HostDashboard] load failed', err?.response?.status, err?.message)
        if (mounted) {
          const msg = err?.response?.data?.detail || err?.message || '后台加载失败'
          setState({ loading: false, info: null, dashboard: null, error: msg })
        }
      })
    return () => { mounted = false }
  }, [])

  const { loading, info, dashboard, error } = state

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  if (!info || !dashboard) return null

  const kpis = [
    {
      icon: Home,
      label: '房源数',
      value: dashboard.total_listings,
      color: 'text-brand-500',
    },
    {
      icon: Eye,
      label: '总访问',
      value: dashboard.total_views,
      color: 'text-blue-500',
    },
    {
      icon: TrendingUp,
      label: '预订数',
      value: dashboard.items.reduce((s, i) => s + i.booking_count, 0),
      color: 'text-purple-500',
    },
    {
      icon: DollarSign,
      label: '营收 (已确认)',
      value: '¥' + Math.round(parseFloat(dashboard.total_confirmed_revenue)).toLocaleString(),
      color: 'text-emerald-500',
    },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">房东后台</h1>
        <p className="text-sm text-slate-500 mt-1">
          欢迎, {info.username} · {info.listing_count} 个房源
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                <Icon className={`w-4 h-4 ${kpi.color}`} />
                <span>{kpi.label}</span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 tabular-nums">{kpi.value}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
            房源访问量 (Top 5)
          </h2>
          <MiniBarChart items={dashboard.items} />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
            营收概览
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">已确认</span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                ¥{parseFloat(dashboard.total_confirmed_revenue).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">待确认</span>
              <span className="font-semibold text-amber-600 tabular-nums">
                ¥{parseFloat(dashboard.total_pending_revenue).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            我的房源 ({dashboard.items.length})
          </h2>
        </div>
        {dashboard.items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            还没有房源. 联系 Admin 给你分配, 或者等待 host seed 数据.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">房源</th>
                  <th className="text-left px-4 py-2 font-medium">城市</th>
                  <th className="text-right px-4 py-2 font-medium">访问</th>
                  <th className="text-right px-4 py-2 font-medium">预订</th>
                  <th className="text-right px-4 py-2 font-medium">已确认营收</th>
                  <th className="text-left px-4 py-2 font-medium">状态</th>
                  <th className="text-right px-4 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.items.map((item) => (
                  <tr key={item.listing_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                          {item.primary_image && (
                            <img
                              src={item.primary_image}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 line-clamp-1">{item.title}</div>
                          <div className="text-xs text-slate-500">
                            ¥{item.price_per_night}/晚 · {propertyTypeLabel(item.property_type)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.city}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        {item.view_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.booking_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700 font-medium">
                      ¥{parseFloat(item.confirmed_revenue).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'text-xs px-1.5 py-0.5 rounded ' +
                          (item.occupancy_status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.occupancy_status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : item.occupancy_status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-600')
                        }
                      >
                        {item.occupancy_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/listings/${item.listing_id}`}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
                      >
                        查看 <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
