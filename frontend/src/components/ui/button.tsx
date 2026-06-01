import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-sans font-semibold text-sm',
    'rounded-lg border border-transparent',
    'transition-all duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-white border-primary',
          'hover:bg-primary-deep hover:border-primary-deep',
          'active:scale-[0.98]',
          'shadow-warm',
        ],
        secondary: [
          'bg-surface-alt text-ink border-border',
          'hover:bg-surface hover:border-primary/40',
          'active:scale-[0.98]',
        ],
        ghost: [
          'bg-transparent text-ink',
          'hover:bg-surface-alt',
          'active:scale-[0.98]',
        ],
        danger: [
          'bg-danger text-white border-danger',
          'hover:bg-[#991B1B] hover:border-[#991B1B]',
          'active:scale-[0.98]',
          'shadow-warm',
        ],
        outline: [
          'bg-transparent text-primary border-primary',
          'hover:bg-primary-soft',
          'active:scale-[0.98]',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon && <span aria-hidden="true">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'

export { buttonVariants }
