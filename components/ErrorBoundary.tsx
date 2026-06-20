'use client'

import { Component, type ReactNode } from 'react'
import { logError } from '@/lib/log-error'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  componentName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    logError(error.message, {
      source: 'react',
      component: this.props.componentName || 'ErrorBoundary',
      stack: error.stack,
      context: { componentStack: errorInfo.componentStack },
      level: 'error',
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center p-8 rounded-2xl bg-red-50 border border-red-200 max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">!</span>
            </div>
            <h3 className="text-lg font-bold text-red-800 mb-2">Erreur inattendue</h3>
            <p className="text-sm text-red-600 mb-4">Un problème est survenu dans cette section.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors text-sm"
            >
              Réessayer
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
