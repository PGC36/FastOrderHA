import { useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin, ShieldCheck, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { createOrder } from '@/api/orders'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/common/PageHeader'
import { useCartStore } from '@/features/cart/useCartStore'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { formatGTQ } from '@/lib/formatters'
import { cn } from '@/lib/cn'

const schema = z.object({
  deliveryAddress: z
    .string()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(200, 'Máximo 200 caracteres'),
})

type FormData = z.infer<typeof schema>

function cartHash(items: { id: number; quantity: number }[]): string {
  return items
    .map((i) => `${i.id}:${i.quantity}`)
    .sort()
    .join('|')
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const { items, total, clearCart, removeItem } = useCartStore()
  const hash = cartHash(items)
  const { getKey, clearKey } = useIdempotencyKey(hash)
  // Evita que el guardia de "carrito vacío" redirija al menú justo después de
  // confirmar el pedido (clearCart vacía el carrito antes de navegar al seguimiento).
  const submitted = useRef(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (items.length === 0 && !submitted.current) {
      navigate('/menu', { replace: true })
    }
  }, [items.length, navigate])

  const mutation = useMutation({
    mutationFn: async (address: string) => {
      const results: number[] = []
      for (const item of items) {
        const order = await createOrder({
          productId: item.id,
          quantity: item.quantity,
          deliveryAddress: address,
          idempotencyKey: `${getKey()}-${item.id}`,
        })
        results.push(order.id)
      }
      return results
    },
    onSuccess: (orderIds) => {
      submitted.current = true
      clearKey()
      clearCart()
      toast.success('¡Pedido confirmado!', { duration: 2000 })
      navigate(orderIds.length === 1 ? `/orders/${orderIds[0]}` : '/my-orders', {
        replace: true,
      })
    },
    onError: (err: unknown) => {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined

      if (status === 409) {
        toast.info('Pedido ya existente — recuperando seguimiento…')
        return
      }
      toast.error('No se pudo crear el pedido. Intentá de nuevo.')
    },
  })

  const onSubmit = ({ deliveryAddress }: FormData) => {
    mutation.mutate(deliveryAddress)
  }

  if (items.length === 0) return null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          to="/menu"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al menú
        </Link>
      </div>

      <PageHeader
        title="Checkout"
        description="Confirmá tu pedido y dirección de entrega."
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Dirección de entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="deliveryAddress"
                  className="text-sm font-medium text-ink"
                >
                  Dirección completa
                </label>
                <textarea
                  id="deliveryAddress"
                  rows={3}
                  placeholder="Ej: 4a Calle 12-15, Zona 10, Guatemala City"
                  className={cn(
                    'w-full rounded-lg border bg-surface-alt px-3 py-2.5',
                    'text-sm text-ink placeholder:text-muted resize-none',
                    'focus:outline-2 focus:outline-primary focus:outline-offset-0 focus:border-primary',
                    'transition-colors',
                    errors.deliveryAddress ? 'border-danger' : 'border-border',
                  )}
                  aria-describedby={errors.deliveryAddress ? 'address-error' : undefined}
                  {...register('deliveryAddress')}
                />
                {errors.deliveryAddress && (
                  <p
                    id="address-error"
                    className="flex items-center gap-1 text-xs text-danger"
                    role="alert"
                  >
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {errors.deliveryAddress.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Idempotency note */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary-soft border border-primary/20">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary-deep">
                Tu pedido no se va a duplicar
              </p>
              <p className="text-xs text-primary-deep/70 mt-0.5">
                Usamos una clave de idempotencia única por sesión. Si la conexión
                falla y reintentás, el sistema recupera el mismo pedido.
              </p>
              <p className="text-[10px] font-mono text-primary/60 mt-1.5 break-all">
                key: {getKey().slice(0, 18)}…
              </p>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={mutation.isPending}
          >
            {mutation.isPending
              ? `Procesando ${items.length > 1 ? `(${items.length} pedidos)` : ''}…`
              : `Confirmar pedido · ${formatGTQ(total())}`}
          </Button>
        </form>

        {/* Order summary — sticky on desktop */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink leading-tight">
                      {item.nombre}
                    </p>
                    <p className="text-xs text-muted font-mono">
                      {item.quantity} × {formatGTQ(item.precio)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono font-semibold text-ink">
                      {formatGTQ(item.precio * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-muted hover:text-danger transition-colors"
                      aria-label={`Eliminar ${item.nombre}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">Total</span>
                  <span className="font-mono font-bold text-xl text-ink">
                    {formatGTQ(total())}
                  </span>
                </div>
                {items.length > 1 && (
                  <p className="text-[10px] text-muted mt-1.5 font-mono">
                    Se crean {items.length} pedidos independientes
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted text-center px-2">
            Esta demo no procesa pagos. Al confirmar, el pedido se registra y
            comienza su seguimiento.
          </p>
        </div>
      </div>
    </div>
  )
}
