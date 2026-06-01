import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { getProducts, type Product } from '@/api/menu'
import { ProductCard } from '@/components/order/ProductCard'
import { ProductCardSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/features/cart/useCartStore'
import { mockCategories } from '@/mocks/menu'
import { cn } from '@/lib/cn'

const ALL_CATEGORY = 'Todos'

export function MenuPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY)
  const { addItem, openCart, items } = useCartStore()

  const { data: products = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5,
  })

  const categories = [ALL_CATEGORY, ...mockCategories]

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        search.length === 0 ||
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(search.toLowerCase())
      const matchCategory =
        activeCategory === ALL_CATEGORY || p.categoria === activeCategory
      return matchSearch && matchCategory
    })
  }, [products, search, activeCategory])

  const handleAdd = (product: Product) => {
    addItem({ id: product.id, nombre: product.nombre, precio: product.precio })
    toast.success(`${product.nombre} agregado al carrito`, {
      action: { label: 'Ver carrito', onClick: openCart },
      duration: 3000,
    })
  }

  const cartProductIds = new Set(items.map((i) => i.id))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <PageHeader
        title="Menú"
        description="Seleccioná tus platos favoritos y confirmá tu pedido."
      />

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Buscar en el menú…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full h-10 pl-9 pr-9 rounded-lg border border-border bg-surface-alt',
              'text-sm text-ink placeholder:text-muted',
              'focus:outline-2 focus:outline-primary focus:outline-offset-0 focus:border-primary',
              'transition-colors',
            )}
            aria-label="Buscar producto"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar por categoría"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                activeCategory === cat
                  ? 'bg-primary text-white border-primary shadow-warm'
                  : 'bg-surface-alt text-muted border-border hover:border-primary/40 hover:text-ink',
              )}
              aria-pressed={activeCategory === cat}
            >
              {cat}
            </button>
          ))}
          {(search || activeCategory !== ALL_CATEGORY) && (
            <button
              onClick={() => { setSearch(''); setActiveCategory(ALL_CATEGORY) }}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-danger border border-danger/30 hover:bg-primary-soft transition-colors"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!isLoading && !isError && (
        <p className="text-xs font-mono text-muted">
          {filtered.length === 0
            ? 'Sin resultados'
            : `${filtered.length} ${filtered.length === 1 ? 'producto' : 'productos'}`}
        </p>
      )}

      {/* Grid */}
      {isError ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-8 w-8" />}
          title="Error al cargar el menú"
          description="No se pudo conectar con el servidor. Verificá que el backend esté corriendo."
          action={{ label: 'Reintentar', onClick: () => void refetch() }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))
            : filtered.length === 0
            ? (
                <div className="col-span-full">
                  <EmptyState
                    icon={<Search className="h-8 w-8" />}
                    title="Sin resultados"
                    description={`No hay platos que coincidan con "${search || activeCategory}".`}
                    action={{
                      label: 'Ver todos',
                      onClick: () => { setSearch(''); setActiveCategory(ALL_CATEGORY) },
                    }}
                  />
                </div>
              )
            : filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAdd}
                  added={cartProductIds.has(product.id)}
                />
              ))}
        </div>
      )}

      {/* Floating cart CTA (mobile) */}
      {items.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 sm:hidden">
          <Button
            variant="primary"
            size="lg"
            onClick={openCart}
            className="shadow-warm-lg px-6"
          >
            Ver carrito · {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </Button>
        </div>
      )}
    </div>
  )
}
