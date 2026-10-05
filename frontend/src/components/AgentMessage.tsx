import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Sparkles } from 'lucide-react'
import type { AgentChatMessage } from '@/types/agent'
import { AgentToolStep } from './AgentToolStep'

interface AgentMessageProps {
  message: AgentChatMessage
}

// marked 配置: 最小化
marked.setOptions({
  gfm: true,
  breaks: true,
})

function renderMarkdown(text: string): string {
  const html = marked.parse(text || '', { async: false }) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
}

export function AgentMessage({ message }: AgentMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 bg-brand-500 text-white rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    )
  }

  // assistant
  const isStreaming = message.status === 'streaming'
  const isFailed = message.status === 'failed'
  const isEmpty = !message.content && (!message.steps || message.steps.length === 0)

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* 工具步骤 (折叠卡片列表) */}
        {message.steps && message.steps.length > 0 && (
          <div className="space-y-1.5">
            {message.steps.map((step) => (
              <AgentToolStep key={step.step_index} step={step} />
            ))}
          </div>
        )}

        {/* 最终内容 */}
        {!isEmpty && (
          <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl rounded-bl-md text-sm leading-relaxed">
            {isStreaming && !message.content ? (
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:0.4s]" />
                <span className="text-xs ml-1">思考中…</span>
              </div>
            ) : (
              <div
                className="prose-chat"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}
          </div>
        )}

        {/* 错误 */}
        {isFailed && message.error && (
          <div className="text-xs text-red-500 px-1">
            {message.error}
          </div>
        )}
      </div>
    </div>
  )
}
