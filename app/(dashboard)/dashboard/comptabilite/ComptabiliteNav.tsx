import Link from 'next/link'

export default function ComptabiliteNav() {
  return (
    <div className="flex flex-wrap gap-2 mb-6 no-print">
      <Link
        href="/dashboard/comptabilite"
        className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
      >
        Accueil
      </Link>
      <Link
        href="/dashboard/comptabilite/plan-comptes"
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Plan de Comptes
      </Link>
      <Link
        href="/dashboard/comptabilite/journaux"
        className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
      >
        Journaux
      </Link>
      <Link
        href="/dashboard/comptabilite/ecritures"
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Écritures
      </Link>
      <Link
        href="/dashboard/comptabilite/grand-livre"
        className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Grand Livre
      </Link>
      <Link
        href="/dashboard/comptabilite/balance"
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Balance
      </Link>
      <Link
        href="/dashboard/comptabilite/bilan"
        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 shadow-md"
      >
        Bilan
      </Link>
    </div>
  )
}
