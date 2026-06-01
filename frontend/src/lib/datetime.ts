/**
 * El backend envia timestamps sin zona horaria (ej. "2026-06-01T20:39:00").
 * El navegador los interpretaria como hora local (UTC-6 en Guatemala),
 * desfasandolos 6 horas. Esta funcion fuerza UTC agregando "Z" si el string
 * no trae ya una zona horaria.
 */
export function toUtcIso(ts: string): string {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)) return ts
  return `${ts}Z`
}
