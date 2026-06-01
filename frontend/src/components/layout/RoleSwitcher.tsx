import { ChevronDown, User, ChefHat, Bike, Settings } from 'lucide-react'
import { useRoleStore, type AppRole, ROLE_LABELS } from '@/store/useRoleStore'
import { cn } from '@/lib/cn'
import { useState, useRef, useEffect } from 'react'

const ROLE_ICONS: Record<AppRole, React.ReactNode> = {
  cliente: <User className="h-3.5 w-3.5" />,
  cocina: <ChefHat className="h-3.5 w-3.5" />,
  entrega: <Bike className="h-3.5 w-3.5" />,
  admin: <Settings className="h-3.5 w-3.5" />,
}

const ROLES: AppRole[] = ['cliente', 'cocina', 'entrega', 'admin']

export function RoleSwitcher() {
  const { role, setRole } = useRoleStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
          'bg-surface-alt border-border text-ink',
          'hover:border-primary/40 hover:bg-surface',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        )}
        aria-label="Cambiar rol"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-primary" aria-hidden="true">{ROLE_ICONS[role]}</span>
        <span className="hidden sm:inline">{ROLE_LABELS[role]}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-muted transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Seleccionar rol"
          className="absolute right-0 top-full mt-1.5 w-44 bg-surface border border-border rounded-xl shadow-warm-md overflow-hidden z-50"
        >
          {ROLES.map((r) => (
            <button
              key={r}
              role="option"
              aria-selected={r === role}
              onClick={() => { setRole(r); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors',
                r === role
                  ? 'bg-primary-soft text-primary-deep font-semibold'
                  : 'text-ink hover:bg-surface-alt',
              )}
            >
              <span className={cn(r === role ? 'text-primary' : 'text-muted')} aria-hidden="true">
                {ROLE_ICONS[r]}
              </span>
              {ROLE_LABELS[r]}
            </button>
          ))}
          <div className="px-3 py-2 border-t border-border">
            <p className="text-[10px] text-muted font-mono">No requiere autenticación</p>
          </div>
        </div>
      )}
    </div>
  )
}
