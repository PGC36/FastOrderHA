import { apiClient } from './client'
import { mockProducts } from '@/mocks/menu'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

export interface Product {
  id: number
  nombre: string
  descripcion: string
  precio: number
  categoria: string
  disponible: boolean
}

/**
 * El backend no tiene campo `precio` (no existe microservicio de compras/pagos
 * en el alcance del proyecto). Por indicación del equipo, el frontend asigna un
 * precio imaginario. Se deriva del nombre del producto para que sea ESTABLE
 * entre recargas y consistente en el carrito (no aleatorio).
 */
function deriveImaginaryPrice(nombre: string): number {
  let hash = 0
  for (let i = 0; i < nombre.length; i++) {
    hash = nombre.charCodeAt(i) + ((hash << 5) - hash)
  }
  const base = 25 + (Math.abs(hash) % 120) // rango Q25 – Q144
  return base + 0.0
}

/** Forma cruda del producto tal como lo devuelve el menu-service. */
interface RawProduct {
  id: number
  nombre: string
  descripcion: string
  categoria: string
  disponible: boolean
  precio?: number | null
}

function normalizeProduct(raw: RawProduct): Product {
  return {
    id: raw.id,
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    categoria: raw.categoria,
    disponible: raw.disponible,
    precio:
      raw.precio != null && !Number.isNaN(raw.precio)
        ? raw.precio
        : deriveImaginaryPrice(raw.nombre),
  }
}

export async function getProducts(): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts
  const { data } = await apiClient.get<RawProduct[]>('/api/menu/productos')
  return data.map(normalizeProduct)
}

export async function getAvailableProducts(): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts.filter((p) => p.disponible)
  const { data } = await apiClient.get<RawProduct[]>('/api/menu/productos/disponibles')
  return data.map(normalizeProduct)
}

export async function getProductById(id: number): Promise<Product> {
  if (USE_MOCKS) {
    const product = mockProducts.find((p) => p.id === id)
    if (!product) throw new Error('Producto no encontrado')
    return product
  }
  const { data } = await apiClient.get<RawProduct>(`/api/menu/productos/${id}`)
  return normalizeProduct(data)
}

export async function getProductsByCategory(categoria: string): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts.filter((p) => p.categoria === categoria)
  const { data } = await apiClient.get<RawProduct[]>(
    `/api/menu/productos/categoria/${encodeURIComponent(categoria)}`,
  )
  return data.map(normalizeProduct)
}
