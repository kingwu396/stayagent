/** Block 11.5: HITL 确认卡片
 *
 * 在 assistant 消息下方渲染, 当 message.pendingConfirmation 存在时显示.
 * 列出房源 ID/标题、入住/退房、人数, 用户可点击"确认下单"或"取消".
 * 点击后调 useAgentStore.confirmRun, 等待响应后 store 会更新消息 (status / content).
 */
import React, { useState } from 'react'
import { Loader2, Calendar, Users, Home, CheckCircle2, X } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import type { PendingConfirmation } from '@/types/agent'

interface Props {
  pending: PendingConfirmation
}

function fmtDate(d: unknown): string {
  if (!d) return '?'
  if (typeof d === 'string') return d
  return String(d)
}

function getListingId(args: Record<string, unknown>): number | string {
  const v = args.listing_id
  return typeof v === 'number' ? v : (v ? String(v) : '?')
}

function getListingTitle(args: Record<string, unknown>): string {
  // tool_args 没有 title, 前端只能展示 ID (除非从最近的 compare/get_detail step 取)
  return `房源 #${getListingId(args)}`
}

export function AgentConfirmCard({ pending }: Props) {
  const confirmRun = useAgentStore((s) => s.confirmRun)
  const [confirming, setConfirming] = useState<null | boolean>(null)
  const loading = confirming !== null
  const { run_id, tool_args } = pending

  const handle = async (approved: boolean) => {
    if (loading) return
    setConfirming(approved)
    try {
      await confirmRun(run_id, approved)
    } finally {
      // 不重置: 卡片组件即将被父消息替换, 这里不需要清
    }
  }
  const title = getListingTitle(tool_args)
  const checkIn = fmtDate(tool_args.check_in)
  const checkOut = fmtDate(tool_args.check_out)
  const guests = typeof tool_args.guests === 'number' ? tool_args.guests : 1

  return (
    <div className="mt-1 rounded-xl border-2 border-amber-300 bg-amber-50/60 overflow-hidden">
      <div className="px-3 py-2 bg-amber-100/70 border-b border-amber-200 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
          <Calendar className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-amber-900 text-sm">待确认</div>
          <div className="text-xs text-amber-700">请检查房源/入住信息后确认下单</div>
        </div>
      </div>

      <div className="px-3 py-3 space-y-1.5 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <Home className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{checkIn} → {checkOut}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{guests} 位</span>
        </div>
      </div>

      <div className="px-3 pb-3 flex items-center gap-2">
        <button
          onClick={() => handle(true)}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition text-sm font-medium"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          确认下单
        </button>
        <button
          onClick={() => handle(false)}
          disabled={loading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition text-sm font-medium"
        >
          <X className="w-3.5 h-3.5" />
          取消
        </button>
      </div>
    </div>
  )
}
