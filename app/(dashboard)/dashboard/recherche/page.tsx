'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Users,
  Truck,
  ShoppingCart,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'

type Resultats = {
  produits: Array<{ id: number; code: string; designation: string; categorie: string; prixVente: number | null }>
  clients: Array<{ id: number; nom: string; telephone: string | null; type: string }>
  fournisseurs: Array<{ id: number; nom: string; telephone: string | null; email: string | null }>
  ventes: Array<{
    id: number
    numero: string
    date: string
    montantTotal: number
    statut: string
    magasin: { code: string }
  }>
}

export default function RecherchePage() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  const [res, setRes] = useState<Resultats | null>(null)
  const [loading, setLoading] = useState(!!q)
  const [filters, setFilters] = useState({
    type: 'all', // all, produits, clients, fournisseurs, ventes
  })

  useEffect(() => {
    if (!q) {
      setRes(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams({ q })
    if (filters.type !== 'all') {
      params.set('type', filters.type)
    }
    fetch(`/api/recherche?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { produits: [], clients: [], fournisseurs: [], ventes: [] }))
      .then((data) => {
        // S'assurer que tous les champs sont des tableaux
        setRes({
          produits: Array.isArray(data.produits) ? data.produits : [],
          clients: Array.isArray(data.clients) ? data.clients : [],
          fournisseurs: Array.isArray(data.fournisseurs) ? data.fournisseurs : [],
          ventes: Array.isArray(data.ventes) ? data.ventes : [],
        })
      })
      .catch(() => setRes({ produits: [], clients: [], fournisseurs: [], ventes: [] }))
      .finally(() => setLoading(false))
  }, [q, filters])

  const total =
    (res?.produits?.length ?? 0) +
    (res?.clients?.length ?? 0) +
    (res?.fournisseurs?.length ?? 0) +
    (res?.ventes?.length ?? 0)

  if (!q) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Recherche</h1>
          <p className="mt-1 text-gray-600">
            Saisir un terme dans la barre de recherche du bandeau (en haut) puis valider avec Entrée.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">Recherche dans les produits, clients, fournisseurs et numéros de vente.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-orange-600 hover:text-orange-700"
          >
            Retour au tableau de bord
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Recherche</h1>
        <p className="mt-1 text-white/90">
          Résultats pour &quot;<span className="font-medium text-white">{q}</span>&quot;
        </p>
      </div>

      {/* Filtres de type */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <span className="text-sm font-medium text-gray-700">Filtrer par type :</span>
        <button
          onClick={() => setFilters({ type: 'all' })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filters.type === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilters({ type: 'produits' })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filters.type === 'produits'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Produits
        </button>
        <button
          onClick={() => setFilters({ type: 'clients' })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filters.type === 'clients'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Clients
        </button>
        <button
          onClick={() => setFilters({ type: 'fournisseurs' })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filters.type === 'fournisseurs'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Fournisseurs
        </button>
        <button
          onClick={() => setFilters({ type: 'ventes' })}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${filters.type === 'ventes'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Ventes
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">Aucun résultat.</p>
          <Link
            href="/dashboard/recherche"
            className="mt-4 inline-flex items-center gap-2 text-orange-600 hover:text-orange-700"
          >
            Nouvelle recherche
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {res && res.produits.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Package className="h-5 w-5 text-orange-500" />
                  Produits
                </h2>
                <Link href={`/dashboard/produits?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                  Voir tout
                </Link>
              </div>
              <ul className="space-y-2">
                {res.produits.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/produits?q=${encodeURIComponent(q)}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50"
                    >
                      <span className="font-mono text-sm text-gray-600">{p.code}</span>
                      <span className="flex-1 truncate px-2 text-left text-gray-900">{p.designation}</span>
                      <span className="text-sm text-gray-500">
                        {p.prixVente != null ? `${Number(p.prixVente).toLocaleString('fr-FR')} F` : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res && res.clients.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Users className="h-5 w-5 text-orange-500" />
                  Clients
                </h2>
                <Link
                  href={`/dashboard/clients?q=${encodeURIComponent(q)}`}
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Voir tout
                </Link>
              </div>
              <ul className="space-y-2">
                {res.clients.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/dashboard/clients?q=${encodeURIComponent(q)}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50"
                    >
                      <span className="font-medium text-gray-900">{c.nom}</span>
                      <span className="text-sm text-gray-500">{c.telephone || '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res && res.fournisseurs.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <Truck className="h-5 w-5 text-orange-500" />
                  Fournisseurs
                </h2>
                <Link href={`/dashboard/fournisseurs?q=${encodeURIComponent(q)}`} className="text-sm font-medium text-orange-600 hover:text-orange-700">
                  Voir tout
                </Link>
              </div>
              <ul className="space-y-2">
                {res.fournisseurs.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/dashboard/fournisseurs?q=${encodeURIComponent(q)}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50"
                    >
                      <span className="font-medium text-gray-900">{f.nom}</span>
                      <span className="text-sm text-gray-500">{f.telephone || f.email || '—'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res && res.ventes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  Ventes
                </h2>
                <Link
                  href="/dashboard/ventes"
                  className="text-sm font-medium text-orange-600 hover:text-orange-700"
                >
                  Voir les ventes
                </Link>
              </div>
              <ul className="space-y-2">
                {res.ventes.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/dashboard/ventes?open=${v.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-orange-50"
                    >
                      <span className="font-mono text-gray-900">{v.numero}</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(v.date)} · {v.magasin.code}
                      </span>
                      <span className="font-medium text-gray-900">
                        {Number(v.montantTotal).toLocaleString('fr-FR')} F
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
