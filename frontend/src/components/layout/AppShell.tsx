import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { ShoppingCart, Receipt, LayoutDashboard, Truck, Activity, UtensilsCrossed } from 'lucide-react'
import { Toaster } from 'sonner'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { CartDrawer } from '@/components/order/CartDrawer'
import { useCartStore } from '@/features/cart/useCartStore'
import { useRoleStore } from '@/store/useRoleStore'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  cliente: [
    { to: '/menu', label: 'Menú', icon: <UtensilsCrossed className="h-4 w-4" /> },
    { to: '/my-orders', label: 'Mis Pedidos', icon: <Receipt className="h-4 w-4" /> },
  ],
  cocina: [
    { to: '/kitchen', label: 'Cocina', icon: <LayoutDashboard className="h-4 w-4" /> },
  ],
  entrega: [
    { to: '/delivery', label: 'Entrega', icon: <Truck className="h-4 w-4" /> },
  ],
  admin: [
    { to: '/admin', label: 'Panel Admin', icon: <Activity className="h-4 w-4" /> },
    { to: '/admin/services', label: 'Servicios', icon: <LayoutDashboard className="h-4 w-4" /> },
  ],
}

function NavItem({ to, label, icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
          isActive
            ? 'bg-primary-soft text-primary-deep'
            : 'text-muted hover:text-ink hover:bg-surface-alt',
        )
      }
    >
      <span aria-hidden="true">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )
}

export function AppShell() {
  const { itemCount, openCart } = useCartStore()
  const { role } = useRoleStore()
  const navigate = useNavigate()
  const navItems = NAV_BY_ROLE[role] ?? []
  const count = itemCount()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-md"
            aria-label="Ir a inicio"
          >
            <Logo size="md" />
          </button>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1" aria-label="Navegación principal">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <RoleSwitcher />

            {role === 'cliente' && (
              <Button
                variant="primary"
                size="icon"
                onClick={openCart}
                aria-label={`Carrito — ${count} ${count === 1 ? 'producto' : 'productos'}`}
                className="relative"
              >
                <ShoppingCart className="h-4 w-4" />
                {count > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Cart drawer (only for cliente) */}
      {role === 'cliente' && <CartDrawer />}

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'font-sans text-sm',
            success: 'border-success/30',
            error: 'border-danger/30',
          },
        }}
      />
    </div>
  )
}
