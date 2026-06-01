import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'

interface MetricCardProps {
  label: string
  value: string
  unit?: string
  series: { value: number }[]
  trend?: number
  status?: 'normal' | 'warning' | 'critical'
  className?: string
}

const STATUS_COLOR: Record<string, string> = {
  normal: '#15803D',
  warning: '#D97706',
  critical: '#DC2626',
}

export function MetricCard({
  label,
  value,
  unit,
  series,
  trend,
  status = 'normal',
  className,
}: MetricCardProps) {
  const lineColor = STATUS_COLOR[status]

  const TrendIcon =
    trend === undefined || trend === 0
      ? Minus
      : trend > 0
      ? TrendingUp
      : TrendingDown

  const trendColor =
    trend === undefined || trend === 0
      ? 'text-muted'
      : status === 'critical' && trend > 0
      ? 'text-danger'
      : trend > 0
      ? 'text-warning'
      : 'text-success'

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        status === 'critical' && 'border-danger/40',
        status === 'warning' && 'border-warning/40',
        className,
      )}
    >
      {status === 'critical' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-danger animate-pulse" />
      )}

      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-mono text-muted uppercase tracking-wide leading-tight">
            {label}
          </p>
          {trend !== undefined && (
            <div className={cn('flex items-center gap-0.5 text-xs font-mono flex-shrink-0', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-end gap-1">
          <span className="font-display font-extrabold text-3xl leading-none text-ink">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-mono text-muted mb-0.5">{unit}</span>
          )}
        </div>

        <div className="h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <Tooltip
                contentStyle={{ display: 'none' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
