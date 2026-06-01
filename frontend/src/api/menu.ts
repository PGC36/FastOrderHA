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

export async function getProducts(): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts
  const { data } = await apiClient.get<Product[]>('/api/menu/productos')
  return data
}

export async function getAvailableProducts(): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts.filter((p) => p.disponible)
  const { data } = await apiClient.get<Product[]>('/api/menu/productos/disponibles')
  return data
}

export async function getProductById(id: number): Promise<Product> {
  if (USE_MOCKS) {
    const product = mockProducts.find((p) => p.id === id)
    if (!product) throw new Error('Producto no encontrado')
    return product
  }
  const { data } = await apiClient.get<Product>(`/api/menu/productos/${id}`)
  return data
}

export async function getProductsByCategory(categoria: string): Promise<Product[]> {
  if (USE_MOCKS) return mockProducts.filter((p) => p.categoria === categoria)
  const { data } = await apiClient.get<Product[]>(
    `/api/menu/productos/categoria/${encodeURIComponent(categoria)}`,
  )
  return data
}
