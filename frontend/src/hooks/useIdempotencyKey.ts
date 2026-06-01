import { useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'

export function useIdempotencyKey(cartHash: string): {
  getKey: () => string
  clearKey: () => void
} {
  const storageKey = `fastorder:idempotency:${cartHash}`
  const keyRef = useRef<string | null>(null)

  const getKey = (): string => {
    if (keyRef.current) return keyRef.current

    const stored = sessionStorage.getItem(storageKey)
    if (stored) {
      keyRef.current = stored
      return stored
    }

    const fresh = uuidv4()
    keyRef.current = fresh
    sessionStorage.setItem(storageKey, fresh)
    return fresh
  }

  const clearKey = () => {
    keyRef.current = null
    sessionStorage.removeItem(storageKey)
  }

  return { getKey, clearKey }
}
