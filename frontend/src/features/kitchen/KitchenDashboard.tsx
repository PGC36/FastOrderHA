import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChefHat, Volume2, VolumeX, Clock, Flame } from 'lucide-react'
import { toast } from 'sonner'
import {
  getKitchenOrders,
  updateKitchenStatus,
  injectMockOrder,
  type KitchenOrder,
  type KitchenStatus,
} from '@/api/kitchen'
import { generateIncomingOrder } from '@/mocks/kitchen'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/PageHeader'
import { formatDuration, formatShortId } from '@/lib/formatters'
import { cn } from '@/lib/cn'

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12)
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    /* AudioContext not available */
  }
}

function LiveTimer({ from }: { from: string }) {
  const [dur, setDur] = useState(() => formatDuration(from))
  useEffect(() => {
    const id = setInterval(() => setDur(formatDuration(from)), 1000)
    return () => clearInterval(id)
  }, [from])
  return <span className="font-mono text-xs tabular-nums">{dur}</span>
}

const COLUMN_CONFIG: Record<
  KitchenStatus,
  { label: string; color: string; headerBg: string; count: (n: number) => string }
> = {
  PENDING: {
    label: 'Pendientes',
    color: 'text-muted',
    headerBg: 'bg-surface-alt border-border',
    count: (n) => `${n} en espera`,
  },
  IN_PREPARATION: {
    label: 'En preparación',
    color: 'text-warning',
    headerBg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
    count: (n) => `${n} cocinando`,
  },
  READY: {
    label: 'Listos',
    color: 'text-success',
    headerBg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    count: (n) => `${n} para retirar`,
  },
}

function KitchenCard({
  order,
  onAction,
  isPending,
}: {
  order: KitchenOrder
  onAction: (id: number, next: KitchenStatus) => void
  isPending: boolean
}) {
  const nextStatus: Record<KitchenStatus, KitchenStatus | null> = {
    PENDING: 'IN_PREPARATION',
    IN_PREPARATION: 'READY',
    READY: null,
  }
  const actionLabel: Record<KitchenStatus, string> = {
    PENDING: 'Iniciar preparación',
    IN_PREPARATION: 'Marcar como listo',
    READY: 'Entregado',
  }
  const next = nextStatus[order.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        order.status === 'IN_PREPARATION'
          ? 'bg-amber-50/60 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'
          : order.status === 'READY'
          ? 'bg-green-50/60 border-green-200 dark:bg-green-900/10 dark:border-green-800'
          : 'bg-surface-alt border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-muted">
          #{formatShortId(order.orderId)}
        </span>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono',
            order.status === 'IN_PREPARATION'
              ? 'bg-warning/15 text-warning'
              : order.status === 'READY'
              ? 'bg-success/15 text-success'
              : 'bg-surface text-muted',
          )}
        >
          <Clock className="h-3 w-3" />
          <LiveTimer from={order.createdAt} />
        </div>
      </div>

      <div>
        <p className="font-display font-bold text-sm text-ink leading-tight">
          {order.productName}
        </p>
        <p className="text-xs text-muted mt-0.5">
          Cantidad:{' '}
          <span className="font-mono font-semibold text-ink">{order.quantity}</span>
        </p>
      </div>

      {next && (
        <Button
          variant={order.status === 'PENDING' ? 'primary' : 'secondary'}
          size="sm"
          className="w-full"
          loading={isPending}
          onClick={() => onAction(order.id, next)}
        >
          {order.status === 'IN_PREPARATION' && (
            <Flame className="h-3.5 w-3.5 text-success" />
          )}
          {actionLabel[order.status]}
        </Button>
      )}

      {order.status === 'READY' && (
        <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-success">
          <Flame className="h-3.5 w-3.5" />
          Esperando al repartidor
        </div>
      )}
    </motion.div>
  )
}

const STATUSES: KitchenStatus[] = ['PENDING', 'IN_PREPARATION', 'READY']

export function KitchenDashboard() {
  const [muted, setMuted] = useState(false)
  const [activeTab, setActiveTab] = useState<KitchenStatus>('PENDING')
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const knownIds = useRef<Set<number>>(new Set())
  const qc = useQueryClient()

  const { data: orders = [] } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: getKitchenOrders,
    refetchInterval: 3000,
  })

  useEffect(() => {
    const newOnes = orders.filter((o) => !knownIds.current.has(o.id))
    if (newOnes.length > 0 && knownIds.current.size > 0) {
      if (!muted) playBeep()
      toast.info(`${newOnes.length} pedido${newOnes.length > 1 ? 's' : ''} nuevo${newOnes.length > 1 ? 's' : ''}`, {
        description: newOnes.map((o) => o.productName).join(', '),
        duration: 4000,
      })
    }
    orders.forEach((o) => knownIds.current.add(o.id))
  }, [orders, muted])

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: KitchenStatus }) =>
      updateKitchenStatus(id, status),
    onMutate: ({ id }) => setPendingIds((s) => new Set([...s, id])),
    onSettled: (_, __, { id }) => {
      setPendingIds((s) => { const n = new Set(s); n.delete(id); return n })
      void qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
    },
  })

  const handleAction = useCallback(
    (id: number, next: KitchenStatus) => mutation.mutate({ id, status: next }),
    [mutation],
  )

  const byStatus = (s: KitchenStatus) => orders.filter((o) => o.status === s)

  const simulateNewOrder = () => {
    const order = generateIncomingOrder()
    injectMockOrder(order)
    void qc.invalidateQueries({ queryKey: ['kitchen-orders'] })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Cocina"
        description="Gestión de pedidos en tiempo real."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={simulateNewOrder}
              className="text-xs text-muted"
            >
              + Simular pedido
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              title={muted ? 'Activar sonido' : 'Silenciar notificaciones'}
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-muted" />
              ) : (
                <Volume2 className="h-4 w-4 text-primary" />
              )}
            </Button>
          </div>
        }
      />

      {/* Mobile: tabs */}
      <div className="flex sm:hidden border-b border-border">
        {STATUSES.map((s) => {
          const cfg = COLUMN_CONFIG[s]
          const count = byStatus(s).length
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={cn(
                'flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2',
                activeTab === s
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {cfg.label}
              {count > 0 && (
                <span className="ml-1 font-mono">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Desktop: 3 columns / Mobile: single tab content */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {STATUSES.map((status) => {
          const cfg = COLUMN_CONFIG[status]
          const items = byStatus(status)
          const isVisible = activeTab === status

          return (
            <div
              key={status}
              className={cn('space-y-3', !isVisible && 'hidden sm:block')}
            >
              {/* Column header */}
              <div className={cn('rounded-xl border px-4 py-3 flex items-center justify-between', cfg.headerBg)}>
                <div className="flex items-center gap-2">
                  <ChefHat className={cn('h-4 w-4', cfg.color)} />
                  <span className={cn('font-display font-bold text-sm', cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
                <span className={cn('font-mono text-xs', cfg.color)}>
                  {cfg.count(items.length)}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[120px]">
                <AnimatePresence mode="popLayout">
                  {items.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center gap-2 py-10 text-center rounded-xl border border-dashed border-border"
                    >
                      <ChefHat className="h-8 w-8 text-muted/30" />
                      <p className="text-xs text-muted">Sin pedidos</p>
                    </motion.div>
                  ) : (
                    items.map((order) => (
                      <KitchenCard
                        key={order.id}
                        order={order}
                        onAction={handleAction}
                        isPending={pendingIds.has(order.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
