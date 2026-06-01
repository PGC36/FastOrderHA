import { useQuery } from '@tanstack/react-query'
import { getOrderById } from '@/api/orders'
import type { OrderStatus } from '@/api/orders'

const TERMINAL_STATUSES = new Set<OrderStatus>(['COMPLETED', 'CANCELLED', 'FAILED'])

export function usePollOrder(id: number | null) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrderById(id!),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return 2000
      return TERMINAL_STATUSES.has(status) ? false : 2000
    },
    staleTime: 0,
  })
}
