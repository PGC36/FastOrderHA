import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/features/cart/useCartStore'
import { formatGTQ } from '@/lib/formatters'

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, total, itemCount } =
    useCartStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeCart()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, closeCart])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleCheckout = () => {
    closeCart()
    navigate('/checkout')
  }

  const handleViewMenu = () => {
    closeCart()
    navigate('/menu')
  }

  const count = itemCount()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Oscurecimiento en degradado: mas oscuro del lado del carrito y
              mas claro a la izquierda. Da profundidad sin el costo de GPU del
              desenfoque (backdrop-filter), por eso se mantiene fluido. */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-40 bg-gradient-to-l from-ink/55 via-ink/40 to-ink/20"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%', scale: 0.96 }}
            animate={{ x: 0, scale: 1 }}
            exit={{ x: '100%', scale: 0.96 }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            style={{ willChange: 'transform', transformOrigin: 'right center' }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border shadow-warm-lg z-50 flex flex-col"
            role="dialog"
            aria-label="Carrito de compras"
            aria-modal="true"
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary-soft flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="leading-tight">
                  <span className="font-display font-bold text-lg text-ink block">
                    Tu carrito
                  </span>
                  <span className="text-xs text-muted">
                    {count === 0
                      ? 'Vacío'
                      : `${count} ${count === 1 ? 'producto' : 'productos'}`}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closeCart}
                aria-label="Cerrar carrito"
              >
                <X className="h-4 w-4" />
              </Button>
              {/* Accent line */}
              <span className="absolute bottom-0 left-5 h-0.5 w-12 bg-primary rounded-full" />
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                  >
                    <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center">
                      <ShoppingBag className="h-7 w-7 text-muted/50" aria-hidden="true" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-display font-bold text-ink">Tu carrito está vacío</p>
                      <p className="text-sm text-muted">Agregá productos desde el menú.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleViewMenu}>
                      Ver menú
                    </Button>
                  </motion.div>
                ) : (
                  items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{
                        duration: 0.28,
                        ease: [0.32, 0.72, 0, 1],
                        delay: i * 0.05,
                      }}
                      className="flex flex-col gap-2.5 p-3 rounded-xl bg-surface-alt border border-border hover:border-primary/30 hover:shadow-warm transition-all duration-200"
                    >
                      {/* Top: name + line total */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-ink leading-tight truncate">
                            {item.nombre}
                          </p>
                          <p className="text-xs font-mono text-muted mt-0.5">
                            {formatGTQ(item.precio)} c/u
                          </p>
                        </div>
                        <span className="font-mono font-bold text-sm text-ink flex-shrink-0">
                          {formatGTQ(item.precio * item.quantity)}
                        </span>
                      </div>

                      {/* Bottom: stepper + delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 bg-surface rounded-lg border border-border p-0.5">
                          <button
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted hover:bg-primary-soft hover:text-primary transition-colors"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label={`Reducir ${item.nombre}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-sm font-semibold text-ink">
                            {item.quantity}
                          </span>
                          <button
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted hover:bg-primary-soft hover:text-primary transition-colors"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label={`Aumentar ${item.nombre}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Eliminar ${item.nombre}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Quitar
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <AnimatePresence>
              {items.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-border px-5 py-4 space-y-3 bg-gradient-to-t from-primary-soft/40 to-transparent"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">
                      Subtotal · {count} {count === 1 ? 'producto' : 'productos'}
                    </span>
                    <span className="font-mono text-ink">{formatGTQ(total())}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-sm font-medium text-ink">Total</span>
                    <span className="font-mono font-extrabold text-2xl text-primary leading-none">
                      {formatGTQ(total())}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleCheckout}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Ir a checkout
                  </Button>
                  <p className="text-[10px] text-muted text-center">
                    El seguimiento del pedido inicia al confirmar.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
