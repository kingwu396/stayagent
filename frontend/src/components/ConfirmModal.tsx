import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** true 时确认按钮转 loading 并禁用 */
  loading?: boolean
  /** 危险操作(红色确认按钮), 默认 true */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Block 23: 通用二次确认弹窗(替代原生 confirm)。
 * 统一带: 进出场动画 / Esc 关闭 / 背景滚动锁 / role=dialog。
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  loading = false,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Esc 关闭 + 背景滚动锁
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, loading, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={loading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              danger ? 'bg-rose-50' : 'bg-brand-50'
            }`}
          >
            <AlertTriangle className={`w-6 h-6 ${danger ? 'text-rose-500' : 'text-brand-500'}`} />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
          <div className="text-sm text-slate-600 leading-relaxed">{description}</div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300'
                : 'bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300'
            }`}
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
