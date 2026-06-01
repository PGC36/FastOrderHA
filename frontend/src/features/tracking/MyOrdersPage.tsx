import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Receipt, Search, X } from 'lucide-react'
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { mockOrderHistory } from '@/mocks/orders'
import { formatShortId, formatDateTime, formatRelativeTime } from '@/lib/formatters'
import type { OrderStatus } from '@/api/orders'
import { cn } from '@/lib/cn'

const ALL = 'Todos'
const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: ALL, label: 'Todos' },
  { value: 'COMPLETED', label: 'Entregados' },
  { value: 'IN_TRANSIT', label: 'En camino' },
  { value: 'IN_KITCHEN', label: 'En cocina' },
  { value: 'CANCELLED', label: 'Cancelados' },
  { value: 'FAILED', label: 'Fallidos' },
]

export function MyOrdersPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [search, setSearch] = useState('')

  const filtered = mockOrderHistory.filter((o) => {
    const matchStatus = statusFilter === ALL || o.status === statusFilter
    const matchSearch =
      !search ||
      String(o.id).includes(search) ||
      o.deliveryAddress.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Mis Pedidos"
        description={`${mockOrderHistory.length} pedidos en total`}
      />

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por ID o dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-surface-alt text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-primary focus:outline-offset-0 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                statusFilter === value
                  ? 'bg-primary text-white border-primary shadow-warm'
                  : 'bg-surface-alt text-muted border-border hover:border-primary/40 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="Sin pedidos"
          description="No hay pedidos que coincidan con el filtro seleccionado."
          action={{ label: 'Ver todos', onClick: () => { setStatusFilter(ALL); setSearch('') } }}
        />
      ) : (
        <div className="space-y-2">
          {/* Header row (desktop) */}
          <div className="hidden sm:grid grid-cols-[100px_1fr_160px_120px_80px] gap-4 px-4 py-2 text-[10px] font-mono font-semibold text-muted uppercase tracking-wide">
            <span>ID</span>
            <span>Dirección</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span />
          </div>

          {filtered.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'rounded-xl border border-border bg-surface-alt',
                'grid grid-cols-1 sm:grid-cols-[100px_1fr_160px_120px_80px] gap-3 sm:gap-4',
                'px-4 py-4 items-center',
                'hover:shadow-warm transition-shadow',
              )}
            >
              <span className="font-mono text-xs font-bold text-primary">
                #{formatShortId(order.id)}
              </span>

              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{order.deliveryAddress}</p>
                <p className="text-[10px] font-mono text-muted sm:hidden mt-0.5">
                  {formatRelativeTime(order.createdAt)}
                </p>
              </div>

              <div className="hidden sm:block">
                <p className="text-xs text-muted font-mono">
                  {formatDateTime(order.createdAt)}
                </p>
                <p className="text-[10px] text-muted font-mono">
                  {formatRelativeTime(order.createdAt)}
                </p>
              </div>

              <div>
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>

              <div className="flex sm:justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="text-xs text-primary hover:bg-primary-soft"
                >
                  Ver →
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
