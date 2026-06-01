import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/features/landing/LandingPage'
import { MenuPage } from '@/features/menu/MenuPage'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { TrackOrderPage } from '@/features/tracking/TrackOrderPage'
import { MyOrdersPage } from '@/features/tracking/MyOrdersPage'
import { KitchenDashboard } from '@/features/kitchen/KitchenDashboard'
import { DeliveryDashboard } from '@/features/delivery/DeliveryDashboard'
import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { ServicesHealthPage } from '@/features/admin/ServicesHealthPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'orders/:id', element: <TrackOrderPage /> },
      { path: 'my-orders', element: <MyOrdersPage /> },
      { path: 'kitchen', element: <KitchenDashboard /> },
      { path: 'delivery', element: <DeliveryDashboard /> },
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'admin/services', element: <ServicesHealthPage /> },
    ],
  },
])
