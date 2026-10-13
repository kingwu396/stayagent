import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/stores/auth'
import { useWishlistPicker } from '@/components/WishlistPickerModal'
import { takePendingFavorite } from '@/lib/pendingFavorite'
import { HomeView } from '@/views/HomeView'
import { NotFoundView } from '@/views/NotFoundView'
import { ListingDetailView } from '@/views/ListingDetailView'
import { WishlistView } from '@/views/WishlistView'
import { HostDashboardView } from '@/views/HostDashboardView'
import { HostListingFormView } from '@/views/HostListingFormView'
import { HostBookingsView } from '@/views/HostBookingsView'
import { PaymentView } from '@/views/PaymentView'
import { TripsView } from '@/views/TripsView'
import { CancelledTripsView } from '@/views/CancelledTripsView'
import { SearchView } from '@/views/SearchView'
import { LoginView } from '@/views/LoginView'
import { RegisterView } from '@/views/RegisterView'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PageTransition } from '@/components/PageTransition'
import { AgentFab } from '@/components/AgentFab'
import { AgentPanel } from '@/components/AgentPanel'
import { WishlistPickerModal } from '@/components/WishlistPickerModal'

/** Block 13 (F5): 路由过渡外层, 用 pathname 作 pageKey 触发 fade */
function AnimatedLayout() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)

  // Block 32: 未登录点收藏 → 暂存并跳登录; 登录成功后这里自动弹出心愿单选择框,
  // 让用户选择加到哪个清单 (picker 打开时会自己 fetchAll 拉清单)
  useEffect(() => {
    if (!token) return
    const pending = takePendingFavorite()
    if (pending) {
      useWishlistPicker.getState().open(pending)
    }
  }, [token])

  return (
    <>
      {/* Block 23: 路由前进回顶 / 后退恢复原滚动位置 */}
      <ScrollRestoration />
      <AnimatePresence mode="wait">
        <PageTransition pageKey={location.pathname}>
          <Outlet />
        </PageTransition>
      </AnimatePresence>
      {/* Block 17: AgentFab + AgentPanel 放在 layout 树里,
          这样它们是 Route children 的兄弟, 能共享 Router context.
          AgentPanel 是 fixed inset-0 不影响路由匹配. */}
      <AgentFab />
      <AgentPanel />
      {/* 心愿单选择弹窗：ListingCard 红心触发，全局挂一次 */}
      <WishlistPickerModal />
    </>
  )
}

import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    element: <AnimatedLayout />,
    children: [
      { path: '/', element: <HomeView /> },
      { path: '/search', element: <SearchView /> },
      { path: '/listings/:id', element: <ListingDetailView /> },
      { path: '/login', element: <LoginView /> },
      { path: '/register', element: <RegisterView /> },
      {
        path: '/wishlist',
        element: (
          <ProtectedRoute>
            <WishlistView />
          </ProtectedRoute>
        ),
      },
      { path: '/payment/:id', element: <ProtectedRoute><PaymentView /></ProtectedRoute> },
      {
        path: '/trips',
        element: (
          <ProtectedRoute>
            <TripsView />
          </ProtectedRoute>
        ),
      },
      {
        path: '/trips/cancelled',
        element: (
          <ProtectedRoute>
            <CancelledTripsView />
          </ProtectedRoute>
        ),
      },
      {
        path: '/host',
        element: (
          <ProtectedRoute>
            <HostDashboardView />
          </ProtectedRoute>
        ),
      },
      { path: '/host/listings/new', element: <ProtectedRoute><HostListingFormView /></ProtectedRoute> },
      { path: '/host/listings/:id/edit', element: <ProtectedRoute><HostListingFormView /></ProtectedRoute> },
      { path: '/host/bookings', element: <ProtectedRoute><HostBookingsView /></ProtectedRoute> },
      { path: '*', element: <NotFoundView /> },
    ],
  },
])
