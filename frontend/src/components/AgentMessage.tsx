import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Sparkles, LogIn, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AgentChatMessage } from '@/types/agent'
import { useAgentStore } from '@/stores/agent'
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
  const navigate = useNavigate()
  const closePanel = useAgentStore((s) => s.closePanel)
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

  // Block 29: 本条消息若成功创建过订单 (create_booking 的 tool_result), 提取 booking_id 供「去支付」
  const bookingId = useMemo(() => {
    if (message.status !== 'completed') return null
    for (const s of message.steps ?? []) {
      if (s.tool_name !== 'create_booking' || s.tool_result == null) continue
      const result = s.tool_result as { booking_id?: unknown }
      if (result.booking_id != null) return Number(result.booking_id)
    }
    return null
  }, [message.status, message.steps])
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

        {/* Block 29: 下单成功 → 「去支付」快捷入口
            (确认卡片确认后会被移除, 改在消息下方渲染; 历史消息同样生效, 已支付/已失效由支付页兜底) */}
        {message.status === 'completed' && bookingId && (
          <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-2xl px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0 text-sm text-slate-700">
              订单 <span className="font-medium">#{bookingId}</span> 已创建
              <span className="text-xs text-slate-400 ml-1">15 分钟内完成支付</span>
            </div>
            <button
              onClick={() => {
                closePanel()
                navigate(`/payment/${bookingId}`)
              }}
              className="flex-shrink-0 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition"
            >
              去支付
            </button>
          </div>
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
            {/* Block 22: 中断/超时 —— 明确告诉用户发生了什么, 不再凭空消失 */}
            {message.status === 'cancelled' && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                回复已中断
                {message.content && <span className="text-slate-300">· 以上为已生成部分</span>}
              </div>
            )}
            {message.status === 'timeout' && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                回复超时
              </div>
            )}
          </div>
        ) : null}

        {/* 错误(needLogin 时由引导卡片代替, 不再显示裸错误文案) */}
        {isFailed && message.error && !message.needLogin && (
          <div className="text-xs text-red-500 px-1">
            {message.error}
          </div>
        )}
        {/* Block 22: 未登录/登录过期 → 引导登录卡片(可点击跳转), 代替裸 401 */}
        {isFailed && message.needLogin && (
          <div className="mt-1 flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
              <LogIn className="w-[18px] h-[18px] text-brand-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900">
                {message.error?.includes('过期') ? '登录已过期' : '需要登录'}
              </div>
              <div className="text-xs text-slate-500">
                登录后 StayAgent 才能帮你搜房源、订房、管理心愿单
              </div>
            </div>
            <button
              onClick={() => {
                // Block 22: 先关面板再跳转 —— 若已在登录页打开面板,关面板本身就是可见反馈
                closePanel()
                navigate('/login')
              }}
              className="flex-shrink-0 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition"
            >
              去登录
            </button>
          </div>
        )}
        {/* cancelled 但没有任何内容(还没开始生成就断开): 单独一行提示 */}
        {message.status === 'cancelled' && isEmpty && (
          <div className="text-xs text-slate-400 px-1">
            回复已中断, 未生成内容
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
