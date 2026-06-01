import { apiClient } from './client'
import { USE_MOCKS } from '@/lib/env'
import { toUtcIso } from '@/lib/datetime'
import { mockOrderHistory } from '@/mocks/orders'

export type OrderStatus =
  | 'PENDING'
  | 'INVENTORY_RESERVED'
  | 'IN_KITCHEN'
  | 'READY_FOR_DELIVERY'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'

export interface Order {
  id: number
  productId: number
  quantity: number
  deliveryAddress: string
  idempotencyKey: string
  status: OrderStatus
  deliveryRetryCount?: number
  createdAt: string
  updatedAt: string
}

export interface CreateOrderPayload {
  productId: number
  quantity: number
  deliveryAddress: string
  idempotencyKey: string
}

/**
 * Forma cruda de la orden tal como la devuelve el order-service. No incluye
 * `updatedAt`; en su lugar expone `deliveryLastRetryAt` y `message`.
 */
interface RawOrder {
  id: number
  productId: number
  quantity: number
  deliveryAddress: string
  idempotencyKey: string
  status: OrderStatus
  deliveryRetryCount?: number
  deliveryLastRetryAt?: string | null
  createdAt: string
  updatedAt?: string | null
}

function normalizeOrder(raw: RawOrder): Order {
  const createdAt = toUtcIso(raw.createdAt)
  const updatedAt = raw.updatedAt ?? raw.deliveryLastRetryAt ?? raw.createdAt
  return {
    id: raw.id,
    productId: raw.productId,
    quantity: raw.quantity,
    deliveryAddress: raw.deliveryAddress,
    idempotencyKey: raw.idempotencyKey,
    status: raw.status,
    deliveryRetryCount: raw.deliveryRetryCount ?? 0,
    createdAt,
    // El backend no envia updatedAt: usamos el ultimo reintento o la creacion.
    updatedAt: toUtcIso(updatedAt),
  }
}

let _mockOrderId = 1000

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 800))
    _mockOrderId++
    return {
      id: _mockOrderId,
      ...payload,
      status: 'PENDING',
      deliveryRetryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const { data } = await apiClient.post<RawOrder>('/api/orders', payload)
  return normalizeOrder(data)
}

export async function getOrderById(id: number): Promise<Order> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 300))
    const statuses: OrderStatus[] = ['PENDING', 'INVENTORY_RESERVED', 'IN_KITCHEN', 'READY_FOR_DELIVERY', 'IN_TRANSIT', 'COMPLETED']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    return {
      id,
      productId: 1,
      quantity: 2,
      deliveryAddress: 'Zona 10, Ciudad de Guatemala',
      idempotencyKey: `mock-${id}`,
      status,
      deliveryRetryCount: 0,
      createdAt: new Date(Date.now() - 600_000).toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const { data } = await apiClient.get<RawOrder>(`/api/orders/${id}`)
  return normalizeOrder(data)
}

export async function getOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 400))
    return mockOrderHistory
  }
  const { data } = await apiClient.get<RawOrder[]>('/api/orders')
  // El backend lista de mas reciente a mas antiguo; lo respetamos.
  return data.map(normalizeOrder)
}

export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
): Promise<Order> {
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/status`, { status })
  return data
}
