import { AlertCircle } from 'lucide-react'
import { EmptyState } from './EmptyState'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = '加载失败',
  description = '出错了，请稍后再试。',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="py-16">
      <EmptyState
        icon={<AlertCircle className="w-8 h-8 text-red-500" />}
        title={title}
        description={description}
        action={
          onRetry && (
            <button
              onClick={onRetry}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition"
            >
              重试
            </button>
          )
        }
      />
    </div>
  )
}
