import { format } from 'date-fns'

export interface TimePoint {
  time: string
  throughput: number
  latencyP95: number
  latencyP99: number
  errorRate: number
}

export interface QueueStats {
  name: string
  ready: number
  unacked: number
  total: number
}

export interface ClusterNode {
  id: string
  role: 'primary' | 'replica'
  status: 'UP' | 'DOWN'
  lagMs: number
}

export interface ServiceStatus {
  name: string
  port: number
  status: 'UP' | 'DOWN'
  latencyMs: number
}

function noise(base: number, variance: number): number {
  return Math.max(0, base + (Math.random() - 0.5) * 2 * variance)
}

export function generatePoint(chaosFactor = 0): TimePoint {
  return {
    time: format(new Date(), 'HH:mm:ss'),
    throughput: Math.round(noise(280, 60) + chaosFactor * 120),
    latencyP95: Math.round(noise(52, 12) + chaosFactor * 40),
    latencyP99: Math.round(noise(95, 20) + chaosFactor * 80),
    errorRate: parseFloat((noise(0.3, 0.15) + chaosFactor * 8).toFixed(2)),
  }
}

export function generateHistory(count = 30): TimePoint[] {
  const points: TimePoint[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 2000)
    points.push({
      time: format(t, 'HH:mm:ss'),
      throughput: Math.round(noise(280, 60)),
      latencyP95: Math.round(noise(52, 12)),
      latencyP99: Math.round(noise(95, 20)),
      errorRate: parseFloat(noise(0.3, 0.15).toFixed(2)),
    })
  }
  return points
}

export const mockQueues: QueueStats[] = [
  { name: 'order.created', ready: 0, unacked: 3, total: 3 },
  { name: 'inventory.reserved', ready: 0, unacked: 2, total: 2 },
  { name: 'kitchen.order.ready', ready: 0, unacked: 0, total: 0 },
  { name: 'delivery.completed', ready: 0, unacked: 1, total: 1 },
]

export const mockCluster: ClusterNode[] = [
  { id: 'patroni-1', role: 'primary', status: 'UP', lagMs: 0 },
  { id: 'patroni-2', role: 'replica', status: 'UP', lagMs: 2 },
  { id: 'patroni-3', role: 'replica', status: 'UP', lagMs: 4 },
]

export const mockServices: ServiceStatus[] = [
  { name: 'api-gateway', port: 8080, status: 'UP', latencyMs: 8 },
  { name: 'menu-service', port: 8081, status: 'UP', latencyMs: 12 },
  { name: 'order-service', port: 8082, status: 'UP', latencyMs: 15 },
  { name: 'inventory-service', port: 8083, status: 'UP', latencyMs: 9 },
  { name: 'kitchen-service', port: 8084, status: 'UP', latencyMs: 11 },
  { name: 'delivery-service', port: 8085, status: 'UP', latencyMs: 14 },
  { name: 'notification-service', port: 8086, status: 'UP', latencyMs: 10 },
]
