import { ShoppingCart, CheckCircle2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatGTQ } from '@/lib/formatters'
import type { Product } from '@/api/menu'

const PLACEHOLDER_PALETTES = [
  { bg: '#991B1B', letter: '#FECACA' },
  { bg: '#B45309', letter: '#FDE68A' },
  { bg: '#78716C', letter: '#E7E5E4' },
  { bg: '#D97706', letter: '#FEF3C7' },
  { bg: '#15803D', letter: '#D1FAE5' },
  { bg: '#1A1410', letter: '#FBF8F3' },
]

function getPlaceholderPalette(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PLACEHOLDER_PALETTES[Math.abs(hash) % PLACEHOLDER_PALETTES.length]
}

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
  added?: boolean
}

export function ProductCard({ product, onAdd, added = false }: ProductCardProps) {
  const palette = getPlaceholderPalette(product.nombre)
  const initial = product.nombre.charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className={cn('overflow-hidden flex flex-col h-full hover:shadow-warm-md transition-shadow duration-200')}>
        {/* Placeholder image area */}
        <div
          className="h-36 flex items-center justify-center relative flex-shrink-0"
          style={{ backgroundColor: palette.bg }}
          aria-hidden="true"
        >
          <span
            className="font-display font-extrabold text-6xl select-none opacity-30"
            style={{ color: palette.letter }}
          >
            {initial}
          </span>
          {/* Availability overlay */}
          {!product.disponible && (
            <div className="absolute inset-0 bg-ink/50 flex items-center justify-center">
              <span className="text-xs font-mono font-semibold text-white bg-ink/70 px-3 py-1 rounded-full">
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 p-5 gap-3">
          {/* Category chip */}
          <span className="text-[11px] font-mono text-muted uppercase tracking-[0.12em]">
            {product.categoria}
          </span>

          {/* Name + description */}
          <div className="flex-1 space-y-1">
            <h3 className="font-display font-bold text-base leading-tight text-ink line-clamp-2">
              {product.nombre}
            </h3>
            <p className="text-sm text-muted leading-relaxed line-clamp-2">
              {product.descripcion}
            </p>
          </div>

          {/* Availability badge */}
          <div className="flex items-center gap-1.5">
            {product.disponible ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-success">Disponible</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-muted flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-muted">Agotado</span>
              </>
            )}
          </div>
        </div>

        <CardContent className="pt-0 px-5 pb-0">
          <div className="h-px bg-border" />
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 px-5 py-4">
          <span className="font-mono font-semibold text-lg text-ink">
            {formatGTQ(product.precio)}
          </span>

          <Button
            variant={added ? 'secondary' : 'primary'}
            size="sm"
            disabled={!product.disponible}
            onClick={() => onAdd(product)}
            leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
            aria-label={`Agregar ${product.nombre} al carrito`}
          >
            {added ? 'En carrito' : 'Agregar'}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
