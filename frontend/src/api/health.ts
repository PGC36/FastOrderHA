import axios from 'axios'

export interface ServiceHealth {
  name: string
  port: number
  status: 'UP' | 'DOWN' | 'UNKNOWN'
  latencyMs?: number
}

const SERVICES = [
  { name: 'api-gateway', port: 8080 },
  { name: 'menu-service', port: 8081 },
  { name: 'order-service', port: 8082 },
  { name: 'inventory-service', port: 8083 },
  { name: 'kitchen-service', port: 8084 },
  { name: 'delivery-service', port: 8085 },
  { name: 'notification-service', port: 8086 },
]

export async function checkServiceHealth(
  name: string,
  port: number,
): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    await axios.get(`http://localhost:${port}/actuator/health`, { timeout: 3000 })
    return { name, port, status: 'UP', latencyMs: Date.now() - start }
  } catch {
    return { name, port, status: 'DOWN', latencyMs: Date.now() - start }
  }
}

export async function checkAllServices(): Promise<ServiceHealth[]> {
  return Promise.all(SERVICES.map((s) => checkServiceHealth(s.name, s.port)))
}
