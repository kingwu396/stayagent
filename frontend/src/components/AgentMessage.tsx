import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Sparkles } from 'lucide-react'
import type { AgentChatMessage } from '@/types/agent'
import { AgentToolStep } from './AgentToolStep'
import { AgentConfirmCard } from './AgentConfirmCard'

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
  // Block 17: 缓存 markdown 渲染结果, 避免每个 content_delta token 重新解析
  const renderedHtml = useMemo(
    () => renderMarkdown(message.content),
    [message.content]
  )

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          {/* Block 12: 附件元数据 chip (PDF text 走 attachment 通道, 不在这里显示) */}
          {message.attachment && (
            <div className="mb-1 flex items-center justify-end gap-1.5 text-xs text-slate-500">
              <span>📎 {message.attachment.filename}</span>
              <span className="text-slate-400">
                {message.attachment.page_count}p · {message.attachment.char_count}字
              </span>
            </div>
          )}
          <div className="px-4 py-2.5 bg-brand-500 text-white rounded-2xl rounded-br-md text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // assistant
  const isStreaming = message.status === 'streaming'
  const isFailed = message.status === 'failed'
  const isEmpty = !message.content && (!message.steps || message.steps.length === 0)

  // Block 17: 思考 / 调 tool 状态 pill (仅当还没 content 时显示)
  // - 还没有 content + 没有 step → "思考中"
  // - 有 step_started 但还没 step_completed → "调用 <name> 中"
  // - 有 step_completed 但 content 还没出现 → "正在生成回复"
  // 只要 content 已经有内容, 一律渲染 markdown (打字机流)
  const lastStep = message.steps && message.steps.length > 0
    ? message.steps[message.steps.length - 1]
    : null
  let statusText: string | null = null
  if (isStreaming && !message.content) {
    if (!lastStep) {
      statusText = '思考中'
    } else if (lastStep.tool_result == null && !lastStep.tool_error) {
      statusText = `调用 ${lastStep.tool_name} 中`
    } else {
      statusText = '正在生成回复'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex gap-2 items-start"
    >
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

        {/* Block 11.5: HITL 确认卡片 */}
        {message.pendingConfirmation && message.status === 'pending_confirmation' && (
          <AgentConfirmCard pending={message.pendingConfirmation} />
        )}

        {/* 最终内容 / 思考状态 pill */}
        {!isEmpty || statusText ? (
          <div className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl rounded-bl-md text-sm leading-relaxed">
            {statusText ? (
              <ThinkingPill text={statusText} />
            ) : (
              <div
                className="prose-chat"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}
          </div>
        ) : null}

        {/* 错误 */}
        {isFailed && message.error && (
          <div className="text-xs text-red-500 px-1">
            {message.error}
          </div>
        )}
      </div>
    </motion.div>
  )
}


/**
 * Block 17: 思考 / 调 tool 状态 pill (三个点的脉冲 + 当前状态文字)
 */
function ThinkingPill({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:0.2s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:0.4s]" />
      <span className="text-xs ml-1">{text}…</span>
    </div>
  )
}
