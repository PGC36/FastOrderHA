import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-ink/40 z-40 backdrop-blur-sm"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border shadow-warm-lg z-50 flex flex-col"
            role="dialog"
            aria-label="Carrito de compras"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-display font-bold text-lg text-ink">
                  Carrito
                </span>
                {itemCount() > 0 && (
                  <span className="text-xs font-mono font-semibold bg-primary text-white px-2 py-0.5 rounded-full">
                    {itemCount()}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={closeCart}
                aria-label="Cerrar carrito"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <AnimatePresence initial={false}>
                {items.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                  >
                    <ShoppingBag className="h-12 w-12 text-muted/40" aria-hidden="true" />
                    <p className="font-display font-bold text-ink">Tu carrito está vacío</p>
                    <p className="text-sm text-muted">Agregá productos desde el menú.</p>
                    <Button variant="outline" size="sm" onClick={closeCart}>
                      Ver menú
                    </Button>
                  </motion.div>
                ) : (
                  items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface-alt border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-ink leading-tight truncate">
                          {item.nombre}
                        </p>
                        <p className="text-xs font-mono text-muted mt-0.5">
                          {formatGTQ(item.precio)} c/u
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted hover:border-primary hover:text-primary transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Reducir ${item.nombre}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-semibold text-ink">
                          {item.quantity}
                        </span>
                        <button
                          className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted hover:border-primary hover:text-primary transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Aumentar ${item.nombre}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          className="h-6 w-6 rounded-md flex items-center justify-center text-muted hover:text-danger transition-colors ml-1"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Eliminar ${item.nombre}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Total</span>
                  <span className="font-mono font-bold text-xl text-ink">
                    {formatGTQ(total())}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleCheckout}
                >
                  Ir a checkout
                </Button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
