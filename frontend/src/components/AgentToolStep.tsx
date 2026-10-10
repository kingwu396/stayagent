import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench, Clock } from 'lucide-react'
import type { AgentStep } from '@/types/agent'
import { AgentListingCard, type AgentListingItem } from './agent/AgentListingCard'
import { AgentTipsCard, type AgentTipItem } from './agent/AgentTipsCard'
import { AgentBookingCard, type AgentBookingItem } from './agent/AgentBookingCard'
import { AgentPlanCard, type AgentPlanItem } from './agent/AgentPlanCard'

interface AgentToolStepProps {
  step: AgentStep
}

/**
 * Block 17: 精简 tool_args 摘要, 避免超长字符串破坏 header 视觉.
 * 规则:
 *   - 截断 string 值到 MAX 字符, 末尾 ...
 *   - 跳过 > 200 字符的 key (典型是 plan_text / text 等大字段)
 *   - 最多展示 MAX_ENTRIES 个 key, 多余显示 (N params)
 */
const MAX_ARG_VALUE = 60
const MAX_ENTRIES = 3
const SKIP_KEYS = new Set(['plan_text', 'text'])

function formatValue(v: unknown): string {
  if (v == null) return String(v)
  if (typeof v === 'string') {
    if (v.length > MAX_ARG_VALUE) return `"${v.slice(0, MAX_ARG_VALUE)}…"`
    return JSON.stringify(v)
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, MAX_ARG_VALUE) + (JSON.stringify(v).length > MAX_ARG_VALUE ? '…' : '')
  return String(v)
}

function formatArgs(args: AgentStep['tool_args']): string {
  if (!args) return ''
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args
    if (!obj || typeof obj !== 'object') return String(obj).slice(0, MAX_ARG_VALUE)
    const allEntries = Object.entries(obj as Record<string, unknown>)
    const filtered = allEntries.filter(([k, v]) => {
      if (SKIP_KEYS.has(k)) return false
      if (typeof v === 'string' && v.length > 200) return false
      return true
    })
    const entries = filtered.slice(0, MAX_ENTRIES)
    const shown = entries.map(([k, v]) => `${k}: ${formatValue(v)}`).join(', ')
    const hidden = filtered.length - entries.length
    const skipped = allEntries.length - filtered.length
    const parts: string[] = []
    if (shown) parts.push(shown)
    if (hidden > 0) parts.push(`+${hidden} more`)
    if (skipped > 0) parts.push(`(${skipped} skipped)`)
    return parts.join('  ·  ')
  } catch {
    return String(args).slice(0, MAX_ARG_VALUE)
  }
}

/**
 * Block 13 (F8): 根据 tool_name + result shape 选择渲染器.
 * 已知 tool 走专属卡片; 未知 tool 走 JSON 兜底 (debug-friendly).
 */
function renderResult(toolName: string | null | undefined, result: unknown) {
  if (result == null) return null
  const r = result as any

  switch (toolName) {
    case 'search_listings': {
      const items = (r?.items ?? []) as AgentListingItem[]
      if (items.length === 0) {
        return <div className="text-xs text-slate-400 italic">未找到匹配的房源</div>
      }
      return (
        <div className="space-y-1.5">
          <div className="text-xs text-slate-500">找到 {items.length} 个房源</div>
          {items.slice(0, 5).map((it) => (
            <AgentListingCard key={it.id} item={it} />
          ))}
          {items.length > 5 && (
            <div className="text-xs text-slate-400 text-center">还有 {items.length - 5} 个...</div>
          )}
        </div>
      )
    }
    case 'search_travel_tips': {
      const tips = (r?.tips ?? []) as AgentTipItem[]
      if (tips.length === 0) {
        return <div className="text-xs text-slate-400 italic">知识库暂无内容</div>
      }
      return (
        <div className="space-y-1.5">
          {tips.map((t) => (
            <AgentTipsCard key={t.id} tip={t} />
          ))}
        </div>
      )
    }
    case 'create_booking': {
      if (r?.booking_id != null) {
        return <AgentBookingCard item={r as AgentBookingItem} />
      }
      break
    }
    case 'recommend_from_plan': {
      if (r?.plan_summary) {
        return <AgentPlanCard item={r as AgentPlanItem} />
      }
      break
    }
    case 'parse_travel_plan_pdf': {
      if (r?.parsed) {
        const p = r.parsed
        const cities: string[] = p.cities ?? []
        const dates: string[] = p.dates ?? []
        const days: number | undefined = p.duration_days
        const themes: string[] = p.themes ?? []
        const guests: number | undefined = p.guests_estimate
        const budget: string | number | undefined = p.budget_estimate
        return (
          <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2 text-sm">
            <div className="text-xs font-medium text-slate-500">解析结果</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {cities.length > 0 && (
                <Field label="城市" value={cities.join(' / ')} />
              )}
              {dates.length > 0 && (
                <Field label="日期" value={dates.join(' ~ ')} />
              )}
              {days != null && (
                <Field label="天数" value={`${days} 天`} />
              )}
              {guests != null && (
                <Field label="人数" value={`${guests} 人`} />
              )}
              {themes.length > 0 && (
                <Field label="主题" value={themes.join(' / ')} />
              )}
              {budget != null && (
                <Field label="预算" value={String(budget)} />
              )}
            </div>
            {r.raw_excerpt && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700 select-none">
                  查看原文摘要
                </summary>
                <pre className="mt-1 bg-slate-50 p-2 rounded text-[11px] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                  {r.raw_excerpt}
                </pre>
              </details>
            )}
          </div>
        )
      }
      break
    }
  }
  // 兜底: JSON dump
  return (
    <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-40">
      {JSON.stringify(result, null, 2)}
    </pre>
  )
}



function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value}</span>
    </div>
  )
}
export function AgentToolStep({ step }: AgentToolStepProps) {
  const [expanded, setExpanded] = useState(false)
  // Block 29 fix: tool_error='pending_confirmation' 是 HITL 等待用户确认的正常状态,
  // 不应渲染成红色错误 (此前显示"错误: pending_confirmation")
  const isPending = step.tool_error === 'pending_confirmation'
  const isError = !!step.tool_error && !isPending
  const inProgress = !step.tool_error && !step.tool_result && step.duration_ms == null
  const useCardRenderer = !isError && !isPending && step.tool_result != null

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition text-left"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        )}

        {inProgress ? (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
        ) : isPending ? (
          <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        ) : isError ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        )}

        <Wrench className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

        <code className="text-xs font-mono text-slate-700 flex-1 min-w-0 truncate">
          <span className="font-semibold">{step.tool_name}</span>
          {step.tool_args ? (
              <span className="text-slate-400 ml-1.5 font-normal">({formatArgs(step.tool_args)})</span>
          ) : null}
        </code>

        {step.duration_ms != null && (
          <span className="text-xs text-slate-400 flex-shrink-0">
            {step.duration_ms}ms
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100">
          {step.tool_args && (
            <div>
              <div className="text-xs text-slate-500 mb-1">参数</div>
              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
{JSON.stringify(step.tool_args, null, 2)}
              </pre>
            </div>
          )}
          {isPending ? (
            <div className="text-xs text-amber-600">
              ⏳ 等待用户确认下单 (在下方确认卡片操作)
            </div>
          ) : isError ? (
            <div>
              <div className="text-xs text-red-500 mb-1">错误</div>
              <pre className="text-xs bg-red-50 text-red-700 p-2 rounded overflow-x-auto">
{step.tool_error}
              </pre>
            </div>
          ) : useCardRenderer ? (
            <div>
              <div className="text-xs text-slate-500 mb-1">结果</div>
              {renderResult(step.tool_name, step.tool_result)}
            </div>
          ) : step.tool_result ? (
            <div>
              <div className="text-xs text-slate-500 mb-1">结果</div>
              <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto max-h-40">
{JSON.stringify(step.tool_result, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
