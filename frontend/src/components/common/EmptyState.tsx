import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-20 px-6 text-center',
        className,
      )}
    >
      {icon && (
        <div className="h-16 w-16 rounded-2xl bg-surface-alt flex items-center justify-center text-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="font-display font-bold text-lg text-ink">{title}</p>
        {description && <p className="text-sm text-muted max-w-xs">{description}</p>}
      </div>
      {action && (
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
