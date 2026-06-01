import { apiClient } from './client'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

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
  const { data } = await apiClient.post<Order>('/api/orders', payload)
  return data
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
  const { data } = await apiClient.get<Order>(`/api/orders/${id}`)
  return data
}

export async function getOrders(): Promise<Order[]> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 400))
    return []
  }
  const { data } = await apiClient.get<Order[]>('/api/orders')
  return data
}

export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
): Promise<Order> {
  const { data } = await apiClient.patch<Order>(`/api/orders/${id}/status`, { status })
  return data
}
