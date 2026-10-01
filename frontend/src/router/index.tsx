import { createBrowserRouter, Navigate } from 'react-router-dom'
import { HomeView } from '@/views/HomeView'
import { ListingDetailView } from '@/views/ListingDetailView'
import { WishlistView } from '@/views/WishlistView'
import { TripsView } from '@/views/TripsView'
import { SearchView } from '@/views/SearchView'
import { LoginView } from '@/views/LoginView'
import { RegisterView } from '@/views/RegisterView'
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
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
