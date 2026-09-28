import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * 受保护路由：未登录跳转到 /login
 */
export function ProtectedRoute({ children }: Props) {
  const token = useAuthStore((s) => s.token)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
