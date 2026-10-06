import { useEffect, useState } from 'react'
import { Plus, MessageSquare, Trash2, AlertTriangle } from 'lucide-react'
import { useAgentStore } from '@/stores/agent'
import { useToast } from '@/hooks/useToast'

function formatRelativeTime(iso: string) {
  const date = new Date(iso)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return "刚刚"
  if (diffSec < 3600) return Math.floor(diffSec / 60) + " 分钟前"
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + " 小时前"
  if (diffSec < 86400 * 7) return Math.floor(diffSec / 86400) + " 天前"
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/** 删除二次确认弹窗 (Block 17)
 *
 * 复用 Block 11 AgentConfirmCard 的视觉风格 (品牌色 + 圆形 icon)
 * 用 backdrop blur + 卡片居中, 与 Fullscreen 视觉一致.
 */
function DeleteConfirmModal({
  conversationTitle,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  conversationTitle: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            删除对话？
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            将永久删除对话
            <br />
            <span className="font-medium text-slate-900 line-clamp-1">
              "{conversationTitle}"
            </span>
            <br />
            及其下所有消息和工具调用记录。此操作不可撤销。
          </p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium rounded-xl transition disabled:cursor-not-allowed"
          >
            {isDeleting ? '删除中…' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AgentHistoryList() {
  const conversations = useAgentStore((s) => s.conversations)
  const isLoadingHistory = useAgentStore((s) => s.isLoadingHistory)
  const conversationId = useAgentStore((s) => s.conversationId)
  const loadHistory = useAgentStore((s) => s.loadHistory)
  const loadConversation = useAgentStore((s) => s.loadConversation)
  const startNewChat = useAgentStore((s) => s.startNewChat)
  const deleteConversation = useAgentStore((s) => s.deleteConversation)
  const toast = useToast()

  // 待删除的对话 (二次确认)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; title: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => { loadHistory() }, [loadHistory])

  function onConfirmDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    deleteConversation(pendingDelete.id)
      .then(() => {
        toast.success('对话已删除')
        setPendingDelete(null)
      })
      .catch((err: any) => {
        toast.error(err?.message || '删除失败')
      })
      .finally(() => {
        setIsDeleting(false)
      })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 border-b border-slate-200">
        <button
          onClick={startNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          "新对话"
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {isLoadingHistory ? (
          <div className="space-y-1 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-3 py-2.5 space-y-1.5">
                <div className="skeleton-shimmer h-3.5 rounded bg-slate-200 w-3/4" />
                <div className="skeleton-shimmer h-3 rounded bg-slate-200 w-1/2" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
            "还没有历史对话"
          </div>
        ) : (
          <ul className="space-y-0.5 px-2">
            {conversations.map((c) => {
              const active = c.id === conversationId
              const label = c.title || ('对话 #' + c.id)
              return (
                <li key={c.id} className="group relative">
                  <button
                    onClick={() => loadConversation(c.id)}
                    className={
                      'w-full text-left px-3 py-2.5 rounded-lg transition pr-9 ' +
                      (active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-700 hover:bg-slate-100')
                    }
                  >
                    <div
                      className={
                        'text-sm font-medium truncate ' +
                        (active ? 'text-brand-700' : 'text-slate-800')
                      }
                    >
                      {label}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{formatRelativeTime(c.updated_at)}</span>
                      {c.run_count > 0 && (
                        <>
                          <span>·</span>
                          <span>{c.run_count} "条"</span>
                        </>
                      )}
                    </div>
                  </button>
                  {/* 删除按钮: hover 时出现 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDelete({ id: c.id, title: label })
                    }}
                    className={
                      'absolute top-1/2 right-1.5 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md transition ' +
                      'opacity-0 group-hover:opacity-100 ' +
                      (active
                        ? 'hover:bg-brand-100 text-brand-600'
                        : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500')
                    }
                    aria-label={`删除 ${label}`}
                    title="删除对话"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* 删除二次确认 */}
      {pendingDelete && (
        <DeleteConfirmModal
          conversationTitle={pendingDelete.title}
          onConfirm={onConfirmDelete}
          onCancel={() => setPendingDelete(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
