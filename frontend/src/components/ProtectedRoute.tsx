import { Navigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  if (!token) {
    // Block 23: 携带来源路径, 登录成功后回到原页
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}
