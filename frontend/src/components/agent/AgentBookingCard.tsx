/** Block 13 (F8): create_booking 确认结果卡片
 *
 * 显示: listing 标题 + 日期 + 人数 + 合计, 带「查看行程」按钮跳 /trips
 */
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Calendar, Users, ArrowRight } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'

export interface AgentBookingItem {
  booking_id: number | string
  listing_id?: number
  listing_title?: string
  check_in: string
  check_out: string
  guests: number
  nights: number
  total: number | string
}

export function AgentBookingCard({ item }: { item: AgentBookingItem }) {
  const total = typeof item.total === 'string' ? parseFloat(item.total) : item.total
  const closePanel = useAgentStore((s) => s.closePanel)
  const navigate = useNavigate()

  function handleClick() {
    closePanel()
    queueMicrotask(() => navigate('/trips'))
  }

  return (
    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100/60 border-b border-emerald-200">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-emerald-900">下单成功 #{item.booking_id}</span>
      </div>
      <div className="p-3 space-y-1.5 text-sm">
        <div className="font-medium text-slate-900 line-clamp-1">
          {item.listing_title || `房源 #${item.listing_id}`}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{item.check_in} → {item.check_out} ({item.nights} 晚)</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{item.guests} 位</span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-emerald-200/60 flex items-center justify-between">
          <span className="text-xs text-slate-600">合计</span>
          <span className="text-base font-bold text-emerald-700">¥{total}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-white text-emerald-700 hover:bg-emerald-50 transition text-xs font-medium border-t border-emerald-200"
      >
        查看行程
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
