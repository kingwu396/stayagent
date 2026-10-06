import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastContainer } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

/**
 * App 渲染:
 *   ErrorBoundary
 *     RouterProvider (路由上下文 + AnimatedLayout + AgentFab/AgentPanel 在 layout 内)
 *     ToastContainer (全局 toast, 不需要路由)
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastContainer />
    </ErrorBoundary>
  </React.StrictMode>,
)
