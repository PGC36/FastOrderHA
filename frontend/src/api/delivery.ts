import { apiClient } from './client'
import { initialDeliveries, type DeliveryItem, type DeliveryStatus } from '@/mocks/delivery'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

let _mockDeliveries: DeliveryItem[] = [...initialDeliveries]

export type { DeliveryItem, DeliveryStatus }

export async function getDeliveries(): Promise<DeliveryItem[]> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 150))
    return [..._mockDeliveries]
  }
  const { data } = await apiClient.get<DeliveryItem[]>('/api/delivery')
  return data
}

async function patchDelivery(
  id: number,
  action: string,
  body?: object,
): Promise<DeliveryItem> {
  if (USE_MOCKS) {
    const item = _mockDeliveries.find((d) => d.id === id)
    if (!item) throw new Error('Entrega no encontrada')
    Object.assign(item, { ...body, updatedAt: new Date().toISOString() })
    return { ...item }
  }
  const { data } = await apiClient.patch<DeliveryItem>(
    `/api/delivery/${id}/${action}`,
    body ?? {},
  )
  return data
}

function mockTransition(id: number, status: DeliveryStatus, extra?: Partial<DeliveryItem>) {
  const item = _mockDeliveries.find((d) => d.id === id)
  if (item) Object.assign(item, { status, updatedAt: new Date().toISOString(), ...extra })
  return item ? { ...item } : Promise.reject(new Error('Entrega no encontrada'))
}

export async function assignCourier(id: number, courierId: string): Promise<DeliveryItem> {
  if (USE_MOCKS) return mockTransition(id, 'ASSIGNED', { courierId }) as DeliveryItem
  return patchDelivery(id, 'assign', { courierId })
}

export async function markPickedUp(id: number): Promise<DeliveryItem> {
  if (USE_MOCKS) return mockTransition(id, 'PICKED_UP') as DeliveryItem
  return patchDelivery(id, 'pick-up')
}

export async function markInTransit(id: number): Promise<DeliveryItem> {
  if (USE_MOCKS) return mockTransition(id, 'IN_TRANSIT') as DeliveryItem
  return patchDelivery(id, 'in-transit')
}

export async function markDelivered(id: number): Promise<DeliveryItem> {
  if (USE_MOCKS) return mockTransition(id, 'DELIVERED') as DeliveryItem
  return patchDelivery(id, 'deliver')
}

export async function markFailed(id: number, failureReason: string): Promise<DeliveryItem> {
  if (USE_MOCKS) return mockTransition(id, 'FAILED', { failureReason }) as DeliveryItem
  return patchDelivery(id, 'fail', { failureReason })
}
