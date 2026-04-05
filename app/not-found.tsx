import Link from 'next/link'
import { FileQuestion, Home, ArrowRight } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg text-center">
        <div className="flex justify-center text-gray-400">
          <FileQuestion className="h-16 w-16" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Page introuvable</h1>
        <p className="mt-2 text-sm text-gray-600">
          L&apos;adresse demandée n&apos;existe pas ou a été déplacée.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <Home className="h-4 w-4" />
            Tableau de bord
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Connexion
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
