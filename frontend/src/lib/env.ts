/**
 * Interruptor global de datos de muestra vs backend real.
 *
 * - `true`  → modo demostracion: todo usa datos mock (no requiere backend).
 * - `false` → modo real: el frontend consume el API Gateway.
 *
 * Se controla con `VITE_USE_MOCKS` en el `.env`.
 */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
