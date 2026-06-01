import { apiClient } from './client'
import { initialKitchenOrders, type KitchenOrder, type KitchenStatus } from '@/mocks/kitchen'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

let _mockOrders: KitchenOrder[] = [...initialKitchenOrders]

export type { KitchenOrder, KitchenStatus }

export async function getKitchenOrders(): Promise<KitchenOrder[]> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 150))
    return [..._mockOrders]
  }
  const { data } = await apiClient.get<KitchenOrder[]>('/api/kitchen/orders')
  return data
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
