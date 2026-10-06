import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { HomeView } from '@/views/HomeView'
import { ListingDetailView } from '@/views/ListingDetailView'
import { WishlistView } from '@/views/WishlistView'
import { HostDashboardView } from '@/views/HostDashboardView'
import { TripsView } from '@/views/TripsView'
import { SearchView } from '@/views/SearchView'
import { LoginView } from '@/views/LoginView'
import { RegisterView } from '@/views/RegisterView'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PageTransition } from '@/components/PageTransition'

/** Block 13 (F5): 路由过渡外层, 用 pathname 作 pageKey 触发 fade */
function AnimatedLayout() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <PageTransition pageKey={location.pathname}>
        <Outlet />
      </PageTransition>
    </AnimatePresence>
  )
}

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
      {
        path: '/trips',
        element: (
          <ProtectedRoute>
            <TripsView />
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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
