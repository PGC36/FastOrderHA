import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MapPin,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react'
import { useState } from 'react'
import { usePollOrder } from '@/hooks/usePollOrder'
import { OrderTimeline } from '@/components/order/OrderTimeline'
import { OrderStatusBadge } from '@/components/order/OrderStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatShortId, formatRelativeTime, formatDateTime, formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/cn'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-muted hover:text-ink transition-colors"
      aria-label="Copiar al portapapeles"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function PollIndicator({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
      <motion.div
        className="h-1.5 w-1.5 rounded-full bg-primary"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      actualizando cada 2s
    </div>
  )
}

export function TrackOrderPage() {
  const { id } = useParams<{ id: string }>()
  const orderId = id ? parseInt(id, 10) : null

  const { data: order, isLoading, isError } = usePollOrder(orderId)

  const isTerminal =
    order?.status === 'COMPLETED' ||
    order?.status === 'CANCELLED' ||
    order?.status === 'FAILED'

  const isPolling = !!order && !isTerminal

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary-soft flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-primary" />
        </div>
        <p className="font-display font-bold text-xl text-ink">Pedido no encontrado</p>
        <p className="text-sm text-muted max-w-xs">
          No pudimos encontrar el pedido #{id}. Verificá el ID o revisá tu historial.
        </p>
        <Link
          to="/my-orders"
          className="text-sm text-primary font-medium hover:underline"
        >
          Ver mis pedidos
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back link */}
      <Link
        to="/my-orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis pedidos
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-extrabold text-2xl text-ink">
              Pedido{' '}
              <span className="font-mono text-primary">
                #{formatShortId(order.id)}
              </span>
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted mt-1">
            {formatDateTime(order.createdAt)} ·{' '}
            <span className="font-mono">{formatDuration(order.createdAt)}</span> transcurrido
          </p>
        </div>
        <PollIndicator active={isPolling} />
      </motion.div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="py-8 px-6">
            <OrderTimeline status={order.status} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {/* Order details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide">
              Detalles del pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="ID completo">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-ink break-all">{order.id}</span>
                <CopyButton text={String(order.id)} />
              </div>
            </DetailRow>

            <DetailRow label="Clave de idempotencia">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs text-ink truncate">
                  {order.idempotencyKey}
                </span>
                <CopyButton text={order.idempotencyKey} />
              </div>
            </DetailRow>

            <DetailRow label="Producto">
              <span className="text-sm text-ink font-mono">ID #{order.productId}</span>
            </DetailRow>

            <DetailRow label="Cantidad">
              <span className="text-sm text-ink">{order.quantity}</span>
            </DetailRow>

            <DetailRow label="Creado">
              <span className="text-xs text-muted font-mono">
                {formatRelativeTime(order.createdAt)}
              </span>
            </DetailRow>
          </CardContent>
        </Card>

        {/* Delivery details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide">
              Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Dirección">
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted flex-shrink-0 mt-0.5" />
                <span className="text-sm text-ink">{order.deliveryAddress}</span>
              </div>
            </DetailRow>

            <DetailRow label="Estado">
              <OrderStatusBadge status={order.status} />
            </DetailRow>

            {(order.deliveryRetryCount ?? 0) > 0 && (
              <div
                className={cn(
                  'flex items-start gap-2 p-2.5 rounded-lg',
                  'bg-warning/10 border border-warning/30',
                )}
                title="El sistema está reintentando automáticamente"
              >
                <RotateCcw className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-warning">
                    Reintentando entrega
                  </p>
                  <p className="text-[10px] text-warning/80 font-mono">
                    intento #{order.deliveryRetryCount} — el sistema se está recuperando
                  </p>
                </div>
              </div>
            )}

            <DetailRow label="Última actualización">
              <span className="text-xs text-muted font-mono">
                {formatRelativeTime(order.updatedAt)}
              </span>
            </DetailRow>
          </CardContent>
        </Card>
      </motion.div>

      {/* Completed celebration */}
      {order.status === 'COMPLETED' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 text-center space-y-2"
        >
          <p className="text-2xl">🎉</p>
          <p className="font-display font-bold text-lg text-green-700 dark:text-green-400">
            ¡Tu pedido fue entregado!
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">
            Gracias por usar FastOrder HA.
          </p>
          <Link to="/menu">
            <button className="mt-2 text-sm font-semibold text-green-700 dark:text-green-400 underline underline-offset-2">
              Hacer otro pedido
            </button>
          </Link>
        </motion.div>
      )}
    </div>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  )
}
