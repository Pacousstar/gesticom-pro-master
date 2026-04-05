'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  ClipboardList,
  Loader2,
  RefreshCw,
  TrendingUp,
  Banknote,
  FileText,
} from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RecentActivity from '@/components/dashboard/RecentActivity'
import SuggestionsAchat from '@/components/dashboard/SuggestionsAchat'



type DashboardData = {
  transactionsJour: number
  transactionsHier: number
  produitsEnStock: number
  totalProduitsCatalogue: number
  mouvementsJour: number
  clientsActifs: number
  caJour: number
  caMois: number
  panierMoyen: number
  valeurStockTotal: number
  valeurStockVente: number
  tauxRupture: number
  topProduits: Array<{ name: string; ca: number; qte: number }>
  repartition: Array<{ name: string; percent: number }>
  lowStock: Array<{ name: string; stock: number; min: number; category: string }>
  recentSales: Array<{ id: string; client: string; montant: number; time: string }>
  _timeout?: boolean
}

function calcTrend(current: number, previous: number): { trend: 'up' | 'down' | 'neutral'; value: number } {
  if (previous === 0) return { trend: 'neutral', value: 0 }
  const pct = Math.round(((current - previous) / previous) * 100)
  return { trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', value: Math.abs(pct) }
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetcher personnalisé pour gérer le timeout et les erreurs spécifiques
  const fetcher = async (url: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        if (d._timeout) {
          throw new Error('Réponse partielle (timeout). Fermez le portable puis rechargez.')
        }
        return d as DashboardData
      } else {
        throw new Error(d?.error || 'Erreur serveur')
      }
    } catch (e: any) {
      clearTimeout(timeout)
      if (e?.name !== 'AbortError') {
        throw new Error('Erreur de connexion: ' + (e.message || 'Erreur serveur'))
      }
      throw e
    }
  }

  const { data, error, isLoading: loading, mutate, isValidating: refreshing } = useSWR<DashboardData>('/api/dashboard', fetcher, {
    revalidateOnFocus: true,     // Recharge quand l'onglet redevient actif
    revalidateIfStale: true,     // Recharge s'il y a plus récent
    keepPreviousData: true,      // Affiche les anciennes données pendant le chargement au lieu d'un spinner
    errorRetryCount: 2,
  })

  // Permet de mettre le message d'erreur SWR dans un format exploitable
  const err = error ? error.message : null





  const txJour = data?.transactionsJour ?? 0
  const txHier = data?.transactionsHier ?? 0
  const txTrend = calcTrend(txJour, txHier)

  const lowStock = data?.lowStock ?? []
  const recentSales = data?.recentSales ?? []
  const activityItems = recentSales.map((s) => ({
    id: s.id,
    type: 'vente' as const,
    label: s.client,
    montant: s.montant,
    time: s.time,
  }))

  if (!mounted || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white/20" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {err && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex flex-col gap-1">
          <p className="font-bold flex items-center gap-2 underline"><AlertTriangle className="h-4 w-4" /> Problème de chargement</p>
          <p className="text-sm">{err}</p>
          <p className="text-[10px] mt-1 opacity-70 italic">Conseil : Si vous voyez ce message en mode développement, c'est souvent dû à la compilation lente. Patientez ou actualisez.</p>
        </div>
      )}


      {/* En-tête avec bouton actualiser */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard ERP</h1>
          <p className="mt-1 text-white/80 text-sm font-medium">
            Vue décisionnelle — Performances, stocks et activité en temps réel
          </p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-all disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* KPIs Opérationnels & Financiers */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Chiffre d'Affaire (Jour)",
            value: data?.caJour ?? 0,
            icon: ArrowUp,
            isFcfa: true,
            color: 'from-orange-500 to-orange-600',
          },
          {
            title: "Chiffre d'Affaire (Mois)",
            value: data?.caMois ?? 0,
            icon: TrendingUp,
            isFcfa: true,
            color: 'from-emerald-500 to-teal-600',
          },
          {
            title: 'Panier Moyen',
            value: data?.panierMoyen ?? 0,
            icon: ShoppingCart,
            isFcfa: true,
            color: 'from-blue-500 to-blue-600',
          },
          {
            title: 'Valeur Stock (Achat PAMP)',
            value: data?.valeurStockTotal ?? 0,
            subValue: `CA Est: ${(data?.valeurStockVente ?? 0).toLocaleString('fr-FR')} F`,
            icon: Banknote,
            isFcfa: true,
            color: 'from-emerald-600 to-teal-700',
          },
          {
            title: 'Taux de Rupture',
            value: data?.tauxRupture ?? 0,
            icon: AlertTriangle,
            isPercent: true,
            color: 'from-red-500 to-rose-600',
          },
        ].map((s, i) => (
          <KpiCard
            key={i}
            title={s.title}
            value={s.isFcfa ? `${s.value.toLocaleString('fr-FR')} F` : s.isPercent ? `${s.value}%` : s.value}
            // @ts-ignore
            subValue={s.subValue}
            icon={s.icon}
            color={s.color as any}
            loading={refreshing}
          />
        ))}
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            title: 'Transactions Jour',
            value: txJour,
            icon: ClipboardList,
            color: 'from-yellow-400 to-yellow-500',
            trend: txTrend.trend,
            trendValue: txTrend.value,
          },
          {
            title: 'Produits (Catalogue)',
            value: data?.totalProduitsCatalogue ?? 0,
            icon: Package,
            color: 'from-indigo-500 to-purple-600',
          },
          {
            title: 'Produits en Stock',
            value: data?.produitsEnStock ?? 0,
            icon: ShoppingBag,
            color: 'from-emerald-500 to-teal-600',
          },
          {
            title: 'Mouvements Jour',
            value: data?.mouvementsJour ?? 0,
            icon: RefreshCw,
            color: 'from-pink-500 to-rose-600',
          },
          {
            title: 'Clients Actifs',
            value: data?.clientsActifs ?? 0,
            icon: Users,
            color: 'from-cyan-500 to-emerald-600',
          },
        ].map((s, i) => (
          <KpiCard
            key={i}
            title={s.title}
            value={s.value}
            icon={s.icon}
            color={s.color as any}
            trend={s.trend as any}
            trendValue={s.trendValue}
            loading={refreshing}
          />
        ))}
      </div>

      {/* Actions Rapides */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/achats"
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 transition-all hover:scale-105"
        >
          <ShoppingBag className="h-4 w-4" />
          Réception Rapide
        </Link>
        <Link
          href="/dashboard/commandes-fournisseurs"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
        >
          <FileText className="h-4 w-4" />
          Bon de Commande
        </Link>
        <Link
          href="/dashboard/ventes"
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-700 transition-all hover:scale-105"
        >
          <ShoppingCart className="h-4 w-4" />
          Nouvelle Vente
        </Link>
        <Link
          href="/dashboard/produits"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-700 border border-orange-100 shadow-sm hover:shadow-md transition-all hover:scale-105"
        >
          <Package className="h-4 w-4 text-orange-500" />
          Ajouter Produit
        </Link>
      </div>

      {/* Widgets ERP de Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top 5 Produits (Performance) */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-orange-50 h-full">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Top 5 Ventes</h2>
            </div>
          </div>
          <div className="flex-1 space-y-5">
            {(data?.topProduits || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10 italic">Aucune donnée de vente disponible.</p>
            ) : (
              (data?.topProduits || []).map((p, i) => {
                const maxCa = (data?.topProduits || [])[0]?.ca || 1
                const pct = Math.round((p.ca / maxCa) * 100)
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-sm items-center">
                      <span className="font-bold text-gray-800 truncate flex-1 pr-3">{p.name}</span>
                      <span className="font-black text-emerald-600 tabular-nums">{p.ca.toLocaleString('fr-FR')} F</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-0.5">
                      {p.qte} UNITÉS VENDUES
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Répartition Valeur Stock */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-orange-50 h-full">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <LayoutGrid className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Valeur Stock</h2>
            </div>
          </div>
          <div className="flex-1 space-y-5">
            {(data?.repartition || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10 italic">Stock non répertorié.</p>
            ) : (
              (data?.repartition || []).slice(0, 6).map((c, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm items-center">
                    <span className="font-bold text-gray-700">{c.name}</span>
                    <span className="font-extrabold text-blue-600 tabular-nums">{c.percent}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000"
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-8 pt-5 border-t border-gray-100 bg-gray-50/50 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Capital Immobilisé (PAMP)</span>
                <span className="text-xl font-black text-emerald-700 tabular-nums">{(data?.valeurStockTotal || 0).toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">CA Prévisionnel</span>
                <span className="text-xl font-black text-blue-700 tabular-nums">{(data?.valeurStockVente || 0).toLocaleString('fr-FR')} F</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alertes stock faible */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-orange-50 h-full">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Alertes Stock</h2>
            </div>
            {lowStock.length > 0 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-lg animate-pulse">
                {lowStock.length}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-4">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-2">
                <p className="text-2xl">✅</p>
                <p className="text-sm text-gray-400 font-medium italic text-center text-balance">Tous les stocks sont au-dessus du seuil critique.</p>
              </div>
            ) : (
              lowStock.slice(0, 5).map((p, i) => {
                const pct = Math.min(100, Math.round((p.stock / p.min) * 100))
                return (
                  <div key={i} className="space-y-1.5 p-3 rounded-xl bg-gray-50/30 border border-gray-100/50 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-4">
                      <div className="h-2 flex-1 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${pct < 25 ? 'bg-red-600' : 'bg-orange-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded tabular-nums whitespace-nowrap">{p.stock} Unités</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <Link
            href="/dashboard/stock"
            className="mt-6 block w-full rounded-xl bg-gray-900 py-3.5 text-center text-sm font-black text-white hover:bg-orange-600 transition-all shadow-lg hover:shadow-orange-200"
          >
            VOIR TOUT LE STOCK
          </Link>
        </div>
      </div>

      {/* Activité récente + Suggestions IA */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activité récente */}
        <div className="flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-orange-50">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <ShoppingCart className="h-5 w-5 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Flux de ventes</h2>
            </div>
            <Link href="/dashboard/ventes" className="text-sm font-black text-orange-600 hover:underline">
              Voir tout
            </Link>
          </div>
          <RecentActivity items={activityItems} loading={refreshing} />
        </div>

        {/* Suggestions / IA */}
        <div className="flex flex-col h-full">
          <SuggestionsAchat />
        </div>
      </div>
    </div>
  )
}
