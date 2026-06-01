import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-6">
          <div className="h-16 w-16 rounded-2xl bg-primary-soft flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="space-y-1">
            <p className="font-display font-bold text-lg text-ink">
              Algo salió mal
            </p>
            <p className="text-sm text-muted max-w-xs">
              {this.state.error?.message ?? 'Error inesperado en la aplicación.'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
