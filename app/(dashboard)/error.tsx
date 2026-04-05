'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error boundary:', error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-orange-600">
          <AlertTriangle className="h-8 w-8 shrink-0" />
          <h2 className="text-lg font-semibold text-gray-900">Erreur</h2>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Cette section a rencontré un problème. Réessayez ou revenez au tableau de bord.
        </p>
        {error.message && (
          <p className="mt-2 rounded bg-gray-100 p-2 text-xs text-red-600 font-mono break-all border border-red-100">
            Détail technique : {error.message}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Home className="h-4 w-4" />
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  )
}
