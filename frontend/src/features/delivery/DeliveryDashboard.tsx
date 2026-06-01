import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, User, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  getDeliveries,
  assignCourier,
  markPickedUp,
  markInTransit,
  markDelivered,
  markFailed,
  type DeliveryItem,
  type DeliveryStatus,
} from '@/api/delivery'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/common/PageHeader'
import { formatShortId, formatRelativeTime } from '@/lib/formatters'
import { cn } from '@/lib/cn'

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  READY_FOR_PICKUP: 'Listo para retirar',
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  FAILED: 'Fallido',
}

function FailModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-warm-lg p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0" />
          <h2 className="font-display font-bold text-lg text-ink">Marcar como fallida</h2>
        </div>
        <p className="text-sm text-muted">Indicá el motivo de la falla de entrega.</p>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Cliente no estaba en casa, dirección incorrecta…"
          className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-ink placeholder:text-muted resize-none focus:outline-2 focus:outline-primary"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button
            variant="danger"
            size="sm"
            disabled={reason.trim().length < 5}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirmar falla
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

function DeliveryCard({
  delivery,
  onAction,
}: {
  delivery: DeliveryItem
  onAction: (action: () => Promise<DeliveryItem>) => void
}) {
  const [showAssign, setShowAssign] = useState(false)
  const [courierId, setCourierId] = useState('')
  const [showFailModal, setShowFailModal] = useState(false)

  const statusColor: Record<DeliveryStatus, string> = {
    READY_FOR_PICKUP: 'text-muted bg-surface border-border',
    ASSIGNED: 'text-accent bg-accent/10 border-accent/30',
    PICKED_UP: 'text-primary bg-primary-soft border-primary/30',
    IN_TRANSIT: 'text-primary bg-primary-soft border-primary/30',
    DELIVERED: 'text-success bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    FAILED: 'text-danger bg-danger/10 border-danger/30',
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface-alt p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-muted">
            Pedido #{formatShortId(delivery.orderId)}
          </span>
          <span className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', statusColor[delivery.status])}>
            {STATUS_LABEL[delivery.status]}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-ink leading-relaxed">{delivery.deliveryAddress}</p>
          </div>
          {delivery.courierId && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted" />
              <p className="text-xs text-muted font-mono">Repartidor: {delivery.courierId}</p>
            </div>
          )}
          <p className="text-[10px] text-muted font-mono">{formatRelativeTime(delivery.updatedAt)}</p>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {delivery.status === 'READY_FOR_PICKUP' && !showAssign && (
            <Button variant="primary" size="sm" className="w-full" onClick={() => setShowAssign(true)}>
              Asignar repartidor
            </Button>
          )}

          {delivery.status === 'READY_FOR_PICKUP' && showAssign && (
            <div className="flex gap-2">
              <input
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                placeholder="ID repartidor (ej: R-042)"
                className="flex-1 h-8 rounded-lg border border-border bg-surface px-2.5 text-xs text-ink placeholder:text-muted focus:outline-2 focus:outline-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && courierId.trim()) {
                    onAction(() => assignCourier(delivery.id, courierId.trim()))
                    setShowAssign(false)
                    setCourierId('')
                  }
                }}
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!courierId.trim()}
                onClick={() => {
                  onAction(() => assignCourier(delivery.id, courierId.trim()))
                  setShowAssign(false)
                  setCourierId('')
                }}
              >
                OK
              </Button>
            </div>
          )}

          {delivery.status === 'ASSIGNED' && (
            <Button variant="primary" size="sm" className="w-full" onClick={() => onAction(() => markPickedUp(delivery.id))}>
              Marcar recogido
            </Button>
          )}

          {delivery.status === 'PICKED_UP' && (
            <Button variant="primary" size="sm" className="w-full" onClick={() => onAction(() => markInTransit(delivery.id))}>
              Marcar en tránsito
            </Button>
          )}

          {delivery.status === 'IN_TRANSIT' && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" size="sm" onClick={() => onAction(() => markDelivered(delivery.id))}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Entregado
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowFailModal(true)}>
                <XCircle className="h-3.5 w-3.5 text-danger" /> Falló
              </Button>
            </div>
          )}

          {delivery.status === 'FAILED' && delivery.failureReason && (
            <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">
              {delivery.failureReason}
            </p>
          )}
        </div>
      </div>

      {showFailModal && (
        <FailModal
          onConfirm={(reason) => {
            onAction(() => markFailed(delivery.id, reason))
            setShowFailModal(false)
          }}
          onCancel={() => setShowFailModal(false)}
        />
      )}
    </>
  )
}

function Section({
  title,
  icon,
  items,
  onAction,
  emptyText,
}: {
  title: string
  icon: React.ReactNode
  items: DeliveryItem[]
  onAction: (action: () => Promise<DeliveryItem>) => void
  emptyText: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <span className="font-mono text-xs font-normal text-muted ml-auto">
            {items.length} {items.length === 1 ? 'entrega' : 'entregas'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence>
          {items.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">{emptyText}</p>
          ) : (
            items.map((d) => (
              <motion.div
                key={d.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DeliveryCard delivery={d} onAction={onAction} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

const PENDING_STATUSES: DeliveryStatus[] = ['READY_FOR_PICKUP', 'ASSIGNED']
const TRANSIT_STATUSES: DeliveryStatus[] = ['PICKED_UP', 'IN_TRANSIT']
const DONE_STATUSES: DeliveryStatus[] = ['DELIVERED', 'FAILED']

export function DeliveryDashboard() {
  const qc = useQueryClient()
  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries'],
    queryFn: getDeliveries,
    refetchInterval: 5000,
  })

  const mutation = useMutation({
    mutationFn: (action: () => Promise<DeliveryItem>) => action(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Estado actualizado')
    },
    onError: () => toast.error('No se pudo actualizar el estado'),
  })

  const handleAction = (action: () => Promise<DeliveryItem>) => mutation.mutate(action)

  const pending = deliveries.filter((d) => PENDING_STATUSES.includes(d.status))
  const inTransit = deliveries.filter((d) => TRANSIT_STATUSES.includes(d.status))
  const done = deliveries.filter((d) => DONE_STATUSES.includes(d.status))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Entrega"
        description="Gestión de entregas en curso."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section
          title="Listos para asignar"
          icon={<Truck className="h-4 w-4 text-primary" />}
          items={pending}
          onAction={handleAction}
          emptyText="Sin entregas pendientes"
        />
        <Section
          title="En tránsito"
          icon={<Truck className="h-4 w-4 text-accent" />}
          items={inTransit}
          onAction={handleAction}
          emptyText="Sin entregas en curso"
        />
        <Section
          title="Completados hoy"
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          items={done}
          onAction={handleAction}
          emptyText="Sin entregas completadas"
        />
      </div>
    </div>
  )
}
