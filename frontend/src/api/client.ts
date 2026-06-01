import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number
}

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

const RETRYABLE_STATUS = new Set([503, 504])
const RETRY_DELAYS = [500, 1000, 2000]
const MAX_RETRIES = 3

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    const status = error.response?.status

    if (config && status && RETRYABLE_STATUS.has(status)) {
      config._retryCount = (config._retryCount ?? 0) + 1

      if (config._retryCount <= MAX_RETRIES) {
        const delay = RETRY_DELAYS[config._retryCount - 1]
        if (config._retryCount === 1) {
          toast.loading('Reintentando — tu pedido no se duplicará', {
            id: 'retry-toast',
          })
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
        return apiClient(config)
      }

      toast.dismiss('retry-toast')
      toast.error('Sistema no disponible. Intentá de nuevo en un momento.')
    }

    return Promise.reject(error)
  },
)
