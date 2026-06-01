export type KitchenStatus = 'PENDING' | 'IN_PREPARATION' | 'READY'

export interface KitchenOrder {
  id: number
  orderId: number
  productId?: number
  // El backend real de cocina no expone nombre ni cantidad del producto;
  // por eso son opcionales (presentes solo en modo demostracion).
  productName?: string
  quantity?: number
  status: KitchenStatus
  createdAt: string
}

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

export const initialKitchenOrders: KitchenOrder[] = [
  { id: 1, orderId: 1001, productId: 1, productName: 'Pepián de Res', quantity: 2, status: 'PENDING', createdAt: minsAgo(5) },
  { id: 2, orderId: 1002, productId: 2, productName: "Kak'ik de Chompipe", quantity: 1, status: 'PENDING', createdAt: minsAgo(3) },
  { id: 3, orderId: 1003, productId: 3, productName: 'Jocón de Pollo', quantity: 3, status: 'PENDING', createdAt: minsAgo(1) },
  { id: 4, orderId: 1004, productId: 4, productName: 'Tamales Colorados', quantity: 2, status: 'IN_PREPARATION', createdAt: minsAgo(12) },
  { id: 5, orderId: 1005, productId: 9, productName: 'Rellenitos de Plátano', quantity: 4, status: 'IN_PREPARATION', createdAt: minsAgo(14) },
  { id: 6, orderId: 1006, productId: 5, productName: 'Chuchitos con Salsa', quantity: 2, status: 'READY', createdAt: minsAgo(20) },
  { id: 7, orderId: 1007, productId: 10, productName: 'Caldo de Res', quantity: 1, status: 'READY', createdAt: minsAgo(18) },
]

const INCOMING_POOL: Omit<KitchenOrder, 'id' | 'orderId' | 'createdAt' | 'status'>[] = [
  { productId: 8, productName: 'Café de Huehuetenango', quantity: 2 },
  { productId: 12, productName: 'Borracho de Chocolate', quantity: 1 },
  { productId: 7, productName: 'Atol de Elote', quantity: 3 },
  { productId: 1, productName: 'Pepián de Res', quantity: 1 },
]

let _nextId = 20
let _nextOrderId = 1100
let _poolIndex = 0

export function generateIncomingOrder(): KitchenOrder {
  const base = INCOMING_POOL[_poolIndex % INCOMING_POOL.length]
  _poolIndex++
  return {
    ...base,
    id: ++_nextId,
    orderId: ++_nextOrderId,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  }
}
