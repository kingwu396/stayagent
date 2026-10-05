import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react'
import type { AgentStep } from '@/types/agent'

interface AgentToolStepProps {
  step: AgentStep
}

function formatArgs(args: AgentStep['tool_args']): string {
  if (!args) return ''
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args
    // 只显示关键字段 (头 3 个)
    const entries = Object.entries(obj).slice(0, 3)
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  } catch {
    return String(args)
  }
}

export function AgentToolStep({ step }: AgentToolStepProps) {
  const [expanded, setExpanded] = useState(false)
  const isError = !!step.tool_error
  const inProgress = !step.tool_error && !step.tool_result && step.duration_ms == null

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
