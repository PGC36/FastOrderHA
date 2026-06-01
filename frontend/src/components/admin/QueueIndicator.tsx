import { cn } from '@/lib/cn'
import type { QueueStats } from '@/mocks/metrics'

interface QueueIndicatorProps {
  queue: QueueStats
}

function queueStatus(ready: number): 'ok' | 'warn' | 'hot' {
  if (ready === 0) return 'ok'
  if (ready < 50) return 'warn'
  return 'hot'
}

const STATUS_STYLES = {
  ok: {
    dot: 'bg-success',
    bar: 'bg-success',
    label: 'text-success',
    text: 'Procesando',
  },
  warn: {
    dot: 'bg-warning animate-pulse',
    bar: 'bg-warning',
    label: 'text-warning',
    text: 'Con mensajes',
  },
  hot: {
    dot: 'bg-danger animate-pulse',
    bar: 'bg-danger',
    label: 'text-danger',
    text: 'Saturada',
  },
}

export function QueueIndicator({ queue }: QueueIndicatorProps) {
  const st = queueStatus(queue.ready)
  const styles = STATUS_STYLES[st]
  const fillPct = queue.total === 0 ? 0 : Math.min(100, (queue.ready / Math.max(queue.total, 10)) * 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', styles.dot)} />
          <span className="text-xs font-mono text-ink truncate">{queue.name}</span>
        </div>
        <span className={cn('text-[10px] font-semibold flex-shrink-0', styles.label)}>
          {styles.text}
        </span>
      </div>

      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
          style={{ width: `${Math.max(fillPct, queue.unacked > 0 ? 8 : 0)}%` }}
        />
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-muted">
        <span>
          ready: <span className={queue.ready > 0 ? 'text-warning font-semibold' : 'text-success'}>{queue.ready}</span>
        </span>
        <span>
          unacked: <span className="text-ink">{queue.unacked}</span>
        </span>
        <span>
          total: <span className="text-ink">{queue.total}</span>
        </span>
      </div>
    </div>
  )
}
