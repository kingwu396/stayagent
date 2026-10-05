import { useEffect, useRef, useState } from 'react'
import { Send, Square, Sparkles } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/auth'

export function AgentInput() {
  const [text, setText] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useAgentStore((s) => s.sendMessage)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const cancelStream = useAgentStore((s) => s.cancelStream)
  const token = useAuthStore((s) => s.token)
  const toast = useToast()

  // 自动 grow textarea (1 → 6 行)
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const maxHeight = lineHeight * 6
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [text])

  function handleSend() {
    if (!text.trim()) return
    if (!token) {
      toast.warning('请先登录后再使用 StayAgent')
      window.location.href = '/login'
      return
    }
    sendMessage(text)
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-slate-200 p-3 bg-white">
      <div className="flex items-end gap-2 bg-slate-50 rounded-2xl px-3 py-2 border border-slate-200 focus-within:border-brand-300 transition">
        <Sparkles className="w-4 h-4 text-brand-500 flex-shrink-0 mb-1.5" />
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问点什么, 比如东京便宜公寓..."
          className="flex-1 resize-none bg-transparent outline-none text-sm leading-6 placeholder:text-slate-400 max-h-32"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            onClick={cancelStream}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center transition"
            aria-label="停止"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white flex items-center justify-center transition disabled:cursor-not-allowed"
            aria-label="发送"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="text-[10px] text-slate-400 text-center mt-2">
        Enter 发送 · Shift+Enter 换行
      </div>
    </div>
  )
}
