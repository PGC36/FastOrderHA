import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ExternalLink,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Box,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { toast } from 'sonner'
import { MetricCard } from '@/components/admin/MetricCard'
import { QueueIndicator } from '@/components/admin/QueueIndicator'
import { ClusterStatus } from '@/components/admin/ClusterStatus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/common/PageHeader'
import { useLiveMetrics } from '@/hooks/useLiveMetrics'
import { cn } from '@/lib/cn'

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3000'
const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL ?? 'http://localhost:9090'
const RABBITMQ_URL = import.meta.env.VITE_RABBITMQ_UI_URL ?? 'http://localhost:15672'

function ExternalToolLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
        'bg-surface-alt border-border text-muted',
        'hover:border-primary/40 hover:text-ink transition-colors',
      )}
    >
      {icon}
      {label}
      <ExternalLink className="h-3 w-3 opacity-50" />
    </a>
  )
}

export function AdminDashboard() {
  const { series, queues, cluster, services, outboxPending, isChaos, runChaos } =
    useLiveMetrics()
  const [chaosLoading, setChaosLoading] = useState(false)

  const latest = series[series.length - 1]
  const prev = series[series.length - 3]

  const throughputTrend = prev
    ? ((latest.throughput - prev.throughput) / prev.throughput) * 100
    : 0
  const latencyTrend = prev
    ? ((latest.latencyP95 - prev.latencyP95) / prev.latencyP95) * 100
    : 0
  const errorTrend = prev
    ? ((latest.errorRate - prev.errorRate) / Math.max(prev.errorRate, 0.01)) * 100
    : 0

  const errorStatus =
    latest.errorRate > 5 ? 'critical' : latest.errorRate > 1 ? 'warning' : 'normal'
  const latencyStatus =
    latest.latencyP95 > 200 ? 'critical' : latest.latencyP95 > 100 ? 'warning' : 'normal'

  const handleChaos = async () => {
    setChaosLoading(true)
    await new Promise((r) => setTimeout(r, 1200))
    runChaos()
    setChaosLoading(false)
    toast.warning('Prueba de caos iniciada — observá las métricas', {
      duration: 4000,
      description: 'El sistema se recuperará automáticamente en ~8s.',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Observabilidad"
        description="Métricas en tiempo real del sistema FastOrder HA."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExternalToolLink
              href={GRAFANA_URL}
              label="Grafana"
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <ExternalToolLink
              href={PROMETHEUS_URL}
              label="Prometheus"
              icon={<Box className="h-3.5 w-3.5" />}
            />
            <ExternalToolLink
              href={RABBITMQ_URL}
              label="RabbitMQ"
              icon={<Zap className="h-3.5 w-3.5" />}
            />
          </div>
        }
      />

      {/* Degraded mode banner */}
      <AnimatePresence>
        {isChaos && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30"
          >
            <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-danger">
                Prueba de caos activa — conexión inestable con el sistema
              </p>
              <p className="text-xs text-danger/70">
                Reintentando… el sistema se está degradando, no rompiendo.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outbox pending alert */}
      <AnimatePresence>
        {outboxPending > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30"
          >
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning">
                Outbox pendiente:{' '}
                <span className="font-mono">{outboxPending} eventos</span>
              </p>
              <p className="text-xs text-warning/70">
                El publisher outbox está procesando — se resolverá automáticamente.
              </p>
            </div>
            <span className="font-mono font-bold text-2xl text-warning">
              {outboxPending}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Throughput HTTP"
          value={String(latest?.throughput ?? '—')}
          unit="req/s"
          series={series.map((p) => ({ value: p.throughput }))}
          trend={throughputTrend}
          status="normal"
        />
        <MetricCard
          label="Latencia P95"
          value={String(latest?.latencyP95 ?? '—')}
          unit="ms"
          series={series.map((p) => ({ value: p.latencyP95 }))}
          trend={latencyTrend}
          status={latencyStatus}
        />
        <MetricCard
          label="Latencia P99"
          value={String(latest?.latencyP99 ?? '—')}
          unit="ms"
          series={series.map((p) => ({ value: p.latencyP99 }))}
          status={latencyStatus}
        />
        <MetricCard
          label="Tasa de error"
          value={String(latest?.errorRate ?? '—')}
          unit="%"
          series={series.map((p) => ({ value: p.errorRate }))}
          trend={errorTrend}
          status={errorStatus}
        />
      </div>

      {/* Main chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Throughput HTTP — últimos 60s
            </CardTitle>
            <span className="text-xs font-mono text-muted">actualizando cada 2s</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DC2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--color-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  interval={9}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: 'var(--color-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="throughput"
                  name="req/s"
                  stroke="#DC2626"
                  strokeWidth={2}
                  fill="url(#throughputGrad)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="latencyP95"
                  name="p95 ms"
                  stroke="#D97706"
                  strokeWidth={1.5}
                  fill="url(#latencyGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cluster + Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cluster PostgreSQL HA (Patroni)</CardTitle>
          </CardHeader>
          <CardContent>
            <ClusterStatus nodes={cluster} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colas RabbitMQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {queues.map((q) => (
              <QueueIndicator key={q.name} queue={q} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Services health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado de microservicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                  svc.status === 'UP'
                    ? 'bg-surface-alt border-border'
                    : 'bg-danger/5 border-danger/30',
                )}
              >
                {svc.status === 'UP' ? (
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-danger flex-shrink-0 animate-pulse" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-mono font-semibold text-ink truncate">
                    {svc.name}
                  </p>
                  <p className="text-[10px] font-mono text-muted">
                    :{svc.port} ·{' '}
                    <span className={svc.status === 'UP' ? 'text-success' : 'text-danger'}>
                      {svc.status}
                    </span>{' '}
                    · {svc.latencyMs}ms
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chaos button */}
      <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
        <div>
          <p className="text-sm font-semibold text-ink">Prueba de tolerancia a fallos</p>
          <p className="text-xs text-muted">
            Simula una falla de red y observa cómo el sistema se recupera automáticamente.
          </p>
        </div>
        <Button
          variant={isChaos ? 'secondary' : 'danger'}
          size="md"
          loading={chaosLoading}
          disabled={isChaos}
          onClick={handleChaos}
          leftIcon={<Zap className="h-4 w-4" />}
        >
          {isChaos ? 'Recuperando…' : 'Ejecutar prueba de caos'}
        </Button>
      </div>
    </div>
  )
}
