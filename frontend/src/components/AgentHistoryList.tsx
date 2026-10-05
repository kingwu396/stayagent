import { useEffect } from 'react'
import { Plus, MessageSquare } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'

function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return "刚刚"
  if (diffSec < 3600) return Math.floor(diffSec / 60) + " 分钟前"
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + " 小时前"
  if (diffSec < 86400 * 7) return Math.floor(diffSec / 86400) + " 天前"
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function AgentHistoryList() {
  const conversations = useAgentStore((s) => s.conversations)
  const isLoadingHistory = useAgentStore((s) => s.isLoadingHistory)
  const conversationId = useAgentStore((s) => s.conversationId)
  const loadHistory = useAgentStore((s) => s.loadHistory)
  const loadConversation = useAgentStore((s) => s.loadConversation)
  const startNewChat = useAgentStore((s) => s.startNewChat)

  useEffect(() => { loadHistory() }, [loadHistory])

  return (
    <div className='flex flex-col h-full'>
      <div className='px-3 pt-3 pb-2 border-b border-slate-200'>
        <button
          onClick={startNewChat}
          className='w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition'
        >
          <Plus className='w-4 h-4' />
          "新对话"
        </button>
      </div>

      <div className='flex-1 overflow-y-auto py-2'>
        {isLoadingHistory ? (
          <div className='space-y-1 px-2'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='px-3 py-2.5 space-y-1.5'>
                <div className='skeleton-shimmer h-3.5 rounded bg-slate-200 w-3/4' />
                <div className='skeleton-shimmer h-3 rounded bg-slate-200 w-1/2' />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className='px-4 py-8 text-center text-sm text-slate-400'>
            <MessageSquare className='w-8 h-8 mx-auto mb-2 opacity-40' />
            "还没有历史对话"
          </div>
        ) : (
          <ul className='space-y-0.5 px-2'>
            {conversations.map((c) => {
              const active = c.id === conversationId
              const label = c.title || ('对话 #' + c.id)
              return (
                <li key={c.id}>
                  <button
                    onClick={() => loadConversation(c.id)}
                    className={'w-full text-left px-3 py-2.5 rounded-lg transition ' + (active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100')}
                  >
                    <div className={'text-sm font-medium truncate ' + (active ? 'text-brand-700' : 'text-slate-800')}>
                      {label}
                    </div>
                    <div className='flex items-center gap-2 text-xs text-slate-400 mt-0.5'>
                      <span>{formatRelativeTime(c.updated_at)}</span>
                      {c.run_count > 0 && (
                        <>
                          <span>·</span>
                          <span>{c.run_count} "条"</span>
                        </>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}