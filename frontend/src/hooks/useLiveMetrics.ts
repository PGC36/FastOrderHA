import { useState, useEffect, useCallback, useRef } from 'react'
import {
  generateHistory,
  generatePoint,
  mockQueues,
  mockCluster,
  mockServices,
  type TimePoint,
  type QueueStats,
  type ClusterNode,
  type ServiceStatus,
} from '@/mocks/metrics'

const WINDOW = 30

interface LiveMetrics {
  series: TimePoint[]
  queues: QueueStats[]
  cluster: ClusterNode[]
  services: ServiceStatus[]
  outboxPending: number
  isChaos: boolean
  runChaos: () => void
}

export function useLiveMetrics(): LiveMetrics {
  const [series, setSeries] = useState<TimePoint[]>(() => generateHistory(WINDOW))
  const [queues] = useState<QueueStats[]>(mockQueues)
  const [cluster] = useState<ClusterNode[]>(mockCluster)
  const [services] = useState<ServiceStatus[]>(mockServices)
  const [outboxPending, setOutboxPending] = useState(0)
  const [isChaos, setIsChaos] = useState(false)
  const chaosFactorRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      const point = generatePoint(chaosFactorRef.current)
      setSeries((prev) => [...prev.slice(-(WINDOW - 1)), point])

      setOutboxPending((prev) => {
        if (chaosFactorRef.current > 0) return Math.min(prev + Math.floor(Math.random() * 3), 12)
        return Math.max(0, prev - 1)
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const runChaos = useCallback(() => {
    chaosFactorRef.current = 1
    setIsChaos(true)
    setOutboxPending(8)

    setTimeout(() => {
      chaosFactorRef.current = 0
      setIsChaos(false)
      setOutboxPending(0)
    }, 8000)
  }, [])

  return { series, queues, cluster, services, outboxPending, isChaos, runChaos }
}
