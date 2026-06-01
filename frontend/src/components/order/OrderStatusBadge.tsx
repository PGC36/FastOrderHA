import type { OrderStatus } from '@/api/orders'
import { cn } from '@/lib/cn'

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: 'Pendiente',
    className: 'bg-surface-alt text-muted border-border',
  },
  INVENTORY_RESERVED: {
    label: 'Inventario reservado',
    className: 'bg-accent/10 text-warning border-accent/30',
  },
  IN_KITCHEN: {
    label: 'En cocina',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  },
  READY_FOR_DELIVERY: {
    label: 'Listo para entrega',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  },
  IN_TRANSIT: {
    label: 'En camino',
    className: 'bg-primary-soft text-primary-deep border-primary/30',
  },
  COMPLETED: {
    label: 'Entregado',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-danger/10 text-danger border-danger/30',
  },
  FAILED: {
    label: 'Fallido',
    className: 'bg-danger/10 text-danger border-danger/30',
  },
}

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border',
        config.className,
        className,
      )}
    >
      {config.label.toUpperCase()}
    </span>
  )
}
