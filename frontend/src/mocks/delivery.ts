export type DeliveryStatus =
  | 'READY_FOR_PICKUP'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'FAILED'

export interface DeliveryItem {
  id: number
  orderId: number
  deliveryAddress: string
  status: DeliveryStatus
  courierId: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

export const initialDeliveries: DeliveryItem[] = [
  {
    id: 1, orderId: 1006,
    deliveryAddress: '4a Calle 12-15, Zona 10, Ciudad de Guatemala',
    status: 'READY_FOR_PICKUP', courierId: null, failureReason: null,
    createdAt: minsAgo(22), updatedAt: minsAgo(22),
  },
  {
    id: 2, orderId: 1007,
    deliveryAddress: '6a Avenida 3-40, Zona 1, Centro Histórico',
    status: 'READY_FOR_PICKUP', courierId: null, failureReason: null,
    createdAt: minsAgo(20), updatedAt: minsAgo(20),
  },
  {
    id: 3, orderId: 1004,
    deliveryAddress: '16 Calle 2-05, Zona 14, Vista Hermosa',
    status: 'IN_TRANSIT', courierId: 'R-042', failureReason: null,
    createdAt: minsAgo(28), updatedAt: minsAgo(10),
  },
  {
    id: 4, orderId: 1002,
    deliveryAddress: '7a Avenida 6-48, Zona 9, Plaza Mayor',
    status: 'DELIVERED', courierId: 'R-011', failureReason: null,
    createdAt: minsAgo(60), updatedAt: minsAgo(35),
  },
  {
    id: 5, orderId: 1001,
    deliveryAddress: '3a Calle 5-20, Zona 7, Kaminal Juyu',
    status: 'DELIVERED', courierId: 'R-033', failureReason: null,
    createdAt: minsAgo(90), updatedAt: minsAgo(55),
  },
]
