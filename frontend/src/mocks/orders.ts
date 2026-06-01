import type { Order } from '@/api/orders'

function minsAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

export const mockOrderHistory: Order[] = [
  {
    id: 1007, productId: 10, quantity: 1,
    deliveryAddress: '6a Avenida 3-40, Zona 1',
    idempotencyKey: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    status: 'IN_TRANSIT', deliveryRetryCount: 0,
    createdAt: minsAgo(20), updatedAt: minsAgo(10),
  },
  {
    id: 1006, productId: 5, quantity: 2,
    deliveryAddress: '4a Calle 12-15, Zona 10',
    idempotencyKey: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    status: 'READY_FOR_DELIVERY', deliveryRetryCount: 0,
    createdAt: minsAgo(25), updatedAt: minsAgo(22),
  },
  {
    id: 1004, productId: 4, quantity: 2,
    deliveryAddress: '16 Calle 2-05, Zona 14',
    idempotencyKey: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    status: 'IN_KITCHEN', deliveryRetryCount: 0,
    createdAt: minsAgo(35), updatedAt: minsAgo(30),
  },
  {
    id: 1002, productId: 2, quantity: 1,
    deliveryAddress: '7a Avenida 6-48, Zona 9',
    idempotencyKey: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    status: 'COMPLETED', deliveryRetryCount: 0,
    createdAt: minsAgo(65), updatedAt: minsAgo(35),
  },
  {
    id: 1001, productId: 1, quantity: 2,
    deliveryAddress: '3a Calle 5-20, Zona 7',
    idempotencyKey: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    status: 'COMPLETED', deliveryRetryCount: 1,
    createdAt: minsAgo(95), updatedAt: minsAgo(55),
  },
  {
    id: 1000, productId: 6, quantity: 3,
    deliveryAddress: '9a Calle 1-30, Zona 4',
    idempotencyKey: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    status: 'CANCELLED', deliveryRetryCount: 0,
    createdAt: minsAgo(120), updatedAt: minsAgo(119),
  },
]
