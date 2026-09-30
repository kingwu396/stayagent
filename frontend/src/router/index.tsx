import { createBrowserRouter, Navigate } from 'react-router-dom'
import { HomeView } from '@/views/HomeView'
import { ListingDetailView } from '@/views/ListingDetailView'
import { SearchView } from '@/views/SearchView'
import { LoginView } from '@/views/LoginView'
import { RegisterView } from '@/views/RegisterView'
import { PlaceholderView } from '@/views/PlaceholderView'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomeView />,
  },
  {
    path: '/search',
    element: <SearchView />,
  },
  {
    path: '/listings/:id',
    element: <ListingDetailView />,
  },
  {
    path: '/login',
    element: <LoginView />,
  },
  {
    path: '/register',
    element: <RegisterView />,
  },
  {
    path: '/wishlist',
    element: (
      <ProtectedRoute>
        <PlaceholderView title="我的心愿单" emoji="❤️" blockNumber="Block 7" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/trips',
    element: (
      <ProtectedRoute>
        <PlaceholderView title="我的行程" emoji="✈️" blockNumber="Block 7" />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
