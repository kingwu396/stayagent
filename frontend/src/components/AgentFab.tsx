import { Sparkles } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'

/** 右下角浮动按钮, 点开 AgentPanel */
export function AgentFab() {
  const isOpen = useAgentStore((s) => s.isOpen)
  const togglePanel = useAgentStore((s) => s.togglePanel)
  const isStreaming = useAgentStore((s) => s.isStreaming)

  return (
    <button
      onClick={togglePanel}
      className={[
        'fixed bottom-6 right-6 z-40',
        'w-14 h-14 rounded-full shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-200 hover:scale-105 active:scale-95',
        isOpen
          ? 'bg-slate-700 hover:bg-slate-800'
          : 'bg-brand-500 hover:bg-brand-600',
      ].join(' ')}
      aria-label={isOpen ? '关闭 StayAgent' : '打开 StayAgent'}
    >
      <Sparkles
        className={`w-6 h-6 text-white ${isStreaming ? 'animate-pulse' : ''}`}
      />
      {isStreaming && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 ring-2 ring-white rounded-full" />
      )}
    </button>
  )
}
