import { motion } from 'framer-motion'
import {
  Clock,
  Package,
  ChefHat,
  CheckCircle2,
  Bike,
  Star,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import type { OrderStatus } from '@/api/orders'
import { cn } from '@/lib/cn'

interface Step {
  status: OrderStatus
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const STEPS: Step[] = [
  { status: 'PENDING', label: 'Pedido recibido', Icon: Clock },
  { status: 'INVENTORY_RESERVED', label: 'Inventario reservado', Icon: Package },
  { status: 'IN_KITCHEN', label: 'En cocina', Icon: ChefHat },
  { status: 'READY_FOR_DELIVERY', label: 'Listo para entrega', Icon: CheckCircle2 },
  { status: 'IN_TRANSIT', label: 'En camino', Icon: Bike },
  { status: 'COMPLETED', label: 'Entregado', Icon: Star },
]

const STATUS_ORDER: Partial<Record<OrderStatus, number>> = {
  PENDING: 0,
  INVENTORY_RESERVED: 1,
  IN_KITCHEN: 2,
  READY_FOR_DELIVERY: 3,
  IN_TRANSIT: 4,
  COMPLETED: 5,
}

interface OrderTimelineProps {
  status: OrderStatus
  className?: string
}

export function OrderTimeline({ status, className }: OrderTimelineProps) {
  const isTerminalBad = status === 'CANCELLED' || status === 'FAILED'
  const currentIndex = STATUS_ORDER[status] ?? -1

  if (isTerminalBad) {
    return (
      <div className={cn('flex flex-col items-center gap-3 py-6', className)}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="h-16 w-16 rounded-full bg-danger/10 border-2 border-danger flex items-center justify-center"
        >
          {status === 'CANCELLED' ? (
            <XCircle className="h-7 w-7 text-danger" />
          ) : (
            <AlertTriangle className="h-7 w-7 text-danger" />
          )}
        </motion.div>
        <div className="text-center">
          <p className="font-display font-bold text-lg text-danger">
            {status === 'CANCELLED' ? 'Pedido cancelado' : 'Entrega fallida'}
          </p>
          <p className="text-sm text-muted mt-1">
            {status === 'CANCELLED'
              ? 'No había inventario suficiente para procesar tu pedido.'
              : 'El sistema está reintentando la entrega automáticamente.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(className)}>
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-start">
        {STEPS.map((step, i) => {
          const isDone = currentIndex > i
          const isCurrent = currentIndex === i
          const { Icon } = step

          return (
            <div key={step.status} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 min-w-0">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className={cn(
                    'h-11 w-11 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    isDone
                      ? 'bg-primary border-primary text-white shadow-warm'
                      : isCurrent
                      ? 'border-primary text-primary bg-primary-soft'
                      : 'border-border text-muted bg-surface-alt',
                  )}
                >
                  {isCurrent ? (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </motion.div>

                <span
                  className={cn(
                    'text-[11px] font-medium text-center leading-tight max-w-[84px]',
                    isDone
                      ? 'text-primary'
                      : isCurrent
                      ? 'text-ink font-semibold'
                      : 'text-muted',
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="flex-1 mt-[21px] mx-1 h-0.5 bg-border overflow-hidden rounded-full">
                  <motion.div
                    className="h-full bg-primary origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 + 0.3 }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: vertical */}
      <div className="flex md:hidden flex-col gap-0">
        {STEPS.map((step, i) => {
          const isDone = currentIndex > i
          const isCurrent = currentIndex === i
          const { Icon } = step

          return (
            <div key={step.status} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    isDone
                      ? 'bg-primary border-primary text-white'
                      : isCurrent
                      ? 'border-primary text-primary bg-primary-soft'
                      : 'border-border text-muted bg-surface-alt',
                  )}
                >
                  {isCurrent ? (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.8 }}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </motion.div>

                {i < STEPS.length - 1 && (
                  <div className="w-0.5 h-8 bg-border overflow-hidden rounded-full">
                    <motion.div
                      className="w-full bg-primary origin-top"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: isDone ? 1 : 0 }}
                      transition={{ duration: 0.4, delay: i * 0.1 + 0.3 }}
                    />
                  </div>
                )}
              </div>

              <span
                className={cn(
                  'text-sm pt-1.5 pb-6',
                  isDone
                    ? 'text-primary font-medium'
                    : isCurrent
                    ? 'text-ink font-semibold'
                    : 'text-muted',
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
