import { formatDistanceToNow, format } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatGTQ(amount: number): string {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatShortId(id: string | number): string {
  return String(id).slice(0, 8).toUpperCase()
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "d MMM yyyy, HH:mm", { locale: es })
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm:ss')
}

export function formatDuration(startDate: string | Date): string {
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffSecs = Math.floor((diffMs % 60000) / 1000)

  if (diffMins < 1) return `${diffSecs}s`
  if (diffMins < 60) return `${diffMins}m ${diffSecs}s`

  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return `${hours}h ${mins}m`
}
