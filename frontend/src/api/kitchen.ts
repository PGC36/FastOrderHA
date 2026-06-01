import { apiClient } from './client'
import { initialKitchenOrders, type KitchenOrder, type KitchenStatus } from '@/mocks/kitchen'
import { USE_MOCKS } from '@/lib/env'
import { toUtcIso } from '@/lib/datetime'

let _mockOrders: KitchenOrder[] = [...initialKitchenOrders]

export type { KitchenOrder, KitchenStatus }

/**
 * Forma cruda de la orden de cocina del backend real. No incluye nombre,
 * cantidad ni precio del producto; solo tiempos del ciclo de preparacion.
 */
interface RawKitchenOrder {
  id: number
  orderId: number
  status?: string
  createdAt: string
  startedAt?: string | null
  readyAt?: string | null
  updatedAt?: string | null
}

/**
 * Deriva el estado del tablero a partir de los tiempos del ciclo, que es mas
 * robusto que confiar en el string `status` (que puede variar). Si ya hay
 * `readyAt` esta lista; si empezo, esta en preparacion; si no, pendiente.
 */
function deriveKitchenStatus(raw: RawKitchenOrder): KitchenStatus {
  if (raw.readyAt) return 'READY'
  if (raw.startedAt) return 'IN_PREPARATION'
  return 'PENDING'
}

function normalizeKitchenOrder(raw: RawKitchenOrder): KitchenOrder {
  return {
    id: raw.id,
    orderId: raw.orderId,
    status: deriveKitchenStatus(raw),
    createdAt: toUtcIso(raw.createdAt),
  }
}

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 150))
    return [..._mockOrders]
  }
  const { data } = await apiClient.get<RawKitchenOrder[]>('/api/kitchen/orders')
  return data.map(normalizeKitchenOrder)
}

export async function updateKitchenStatus(
  id: number,
  status: KitchenStatus,
): Promise<KitchenOrder> {
  if (USE_MOCKS) {
    const order = _mockOrders.find((o) => o.id === id)
    if (!order) throw new Error('Orden no encontrada')
    order.status = status
    return { ...order }
  }
  const { data } = await apiClient.patch<KitchenOrder>(
    `/api/kitchen/orders/${id}/status`,
    { status },
  )
  return data
}

export function injectMockOrder(order: KitchenOrder) {
  _mockOrders = [order, ..._mockOrders]
}

export function resetMockOrders() {
  _mockOrders = [...initialKitchenOrders]
}
