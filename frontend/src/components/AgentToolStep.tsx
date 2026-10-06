import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react'
import type { AgentStep } from '@/types/agent'
import { AgentListingCard, type AgentListingItem } from './agent/AgentListingCard'
import { AgentTipsCard, type AgentTipItem } from './agent/AgentTipsCard'
import { AgentBookingCard, type AgentBookingItem } from './agent/AgentBookingCard'
import { AgentPlanCard, type AgentPlanItem } from './agent/AgentPlanCard'

interface AgentToolStepProps {
  step: AgentStep
}

function formatArgs(args: AgentStep['tool_args']): string {
  if (!args) return ''
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args
    const entries = Object.entries(obj).slice(0, 3)
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  } catch {
    return String(args)
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
        return (
          <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5 text-sm">
            <div className="text-xs font-medium text-slate-500">解析结果</div>
            <pre className="text-xs bg-slate-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(r.parsed, null, 2)}
            </pre>
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

export function AgentToolStep({ step }: AgentToolStepProps) {
  const [expanded, setExpanded] = useState(false)
  const isError = !!step.tool_error
  const isPending = step.tool_error === 'pending_confirmation'
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
        ) : isError ? (
          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
        )}

        <Wrench className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />

        <code className="text-xs font-mono text-slate-700 flex-1">
          {step.tool_name}
          {step.tool_args ? (
              <span className="text-slate-400 ml-1.5">({formatArgs(step.tool_args)})</span>
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
          {isError ? (
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
