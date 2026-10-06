/** Block 17: 全局 ErrorBoundary — 防止单个组件 throw 把整个 root 卸载成白屏 */
import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
          <h1 className="text-xl font-bold text-slate-900 mb-2">页面出错了</h1>
          <p className="text-sm text-slate-600 mb-4 max-w-md text-center">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.href = '/'
            }}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
