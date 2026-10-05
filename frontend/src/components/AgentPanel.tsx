import { useEffect, useRef } from 'react'
import { X, Trash2, Sparkles } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import { AgentMessage } from './AgentMessage'
import { AgentInput } from './AgentInput'

const SUGGESTIONS = [
  '东京有便宜公寓吗?',
  '帮我找 2 个巴黎的别墅对比',
  '查看我的心愿单',
]

export function AgentPanel() {
  const isOpen = useAgentStore((s) => s.isOpen)
  const closePanel = useAgentStore((s) => s.closePanel)
  const messages = useAgentStore((s) => s.messages)
  const clearHistory = useAgentStore((s) => s.clearHistory)
  const sendMessage = useAgentStore((s) => s.sendMessage)

  const scrollRef = useRef<HTMLDivElement>(null)

  // 新消息自动滚到底
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  return (
    <>
      {/* 背景遮罩 (移动端可见, 桌面端透明) */}
      {isOpen && (
        <div
          onClick={closePanel}
          className="fixed inset-0 z-30 bg-black/30 sm:bg-transparent"
          aria-hidden="true"
        />
      )}

      {/* 抽屉面板 */}
      <div
        className={[
          'fixed top-0 right-0 z-40 h-full bg-white shadow-2xl',
          'w-full sm:w-[480px]',
          'flex flex-col',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="dialog"
        aria-modal="false"
        aria-label="StayAgent 对话面板"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">StayAgent</div>
              <div className="text-xs text-slate-500">你的 AI 旅行助理</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                aria-label="清空对话"
                title="清空对话"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={closePanel}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/50"
        >
          {messages.length === 0 ? (
            <EmptyState onSuggestion={sendMessage} />
          ) : (
            messages.map((m) => <AgentMessage key={m.id} message={m} />)
          )}
        </div>

        {/* Input */}
        <AgentInput />
      </div>
    </>
  )
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-brand-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Hi, 我是 StayAgent
      </h3>
      <p className="text-sm text-slate-500 max-w-xs mb-6">
        能帮你搜房源、订房、加心愿单。试试下面的建议:
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-left text-slate-700 text-sm hover:border-brand-300 hover:bg-brand-50 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
