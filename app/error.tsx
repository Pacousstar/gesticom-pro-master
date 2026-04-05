'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('GestiCom error boundary:', error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-orange-200 bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 text-orange-600">
          <AlertTriangle className="h-10 w-10 shrink-0" />
          <h1 className="text-xl font-bold text-gray-900">Une erreur est survenue</h1>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          L&apos;application a rencontré une petite difficulté technique. Ne vous inquiétez pas, vos données sont en sécurité. Vous pouvez réessayer l&apos;action ou retourner au tableau de bord.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="mt-2 rounded-lg bg-gray-100 p-3 text-xs text-gray-700 font-mono break-all">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Home className="h-4 w-4" />
            Tableau de bord
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Connexion
          </Link>
        </div>
      </div>
    </div>
  )
}
