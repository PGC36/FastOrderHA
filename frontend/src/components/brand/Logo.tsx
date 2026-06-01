import { cn } from '@/lib/cn'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
}

const textSizes = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
}

export function Logo({ className, size = 'md', showTagline = false }: LogoProps) {
  return (
    <div className={cn('inline-flex flex-col gap-0.5', className)}>
      <div
        className="relative inline-flex items-baseline select-none leading-none"
        aria-label="FastOrder"
        role="img"
      >
        <span
          className={cn(
            'font-display font-extrabold tracking-tight text-primary-deep',
            textSizes[size],
          )}
        >
          Fast
        </span>

        {/* Speed-mark accent: diagonal slash between words */}
        <svg
          className="mx-[0.15em] shrink-0 self-center"
          style={{ height: '0.65em', width: '0.22em' }}
          viewBox="0 0 7 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 0.5L1 19.5"
            stroke="#DC2626"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <span
          className={cn(
            'font-display font-bold tracking-tight text-primary',
            textSizes[size],
          )}
        >
          Order
        </span>
      </div>

      {showTagline && (
        <p className="text-xs font-mono text-muted tracking-widest uppercase">
          Alta disponibilidad
        </p>
      )}
    </div>
  )
}
