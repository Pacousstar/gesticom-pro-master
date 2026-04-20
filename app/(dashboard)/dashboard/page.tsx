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
  ArrowUpRight,
  ArrowDownRight,
  LayoutGrid,
  ClipboardList,
  Loader2,
  RefreshCw,
  TrendingUp,
  Banknote,
  FileText,
  ShieldCheck,
  Wallet,
  BarChart3,
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
  totalDepensesCount: number
  totalDepensesAmount: number
  tresorerieReelle: number
  tresorerieCaisse: number
  tresorerieBanque: number
  totalDettes: number
  totalCreances: number
  monthlyTrends: Array<{ month: string; current: number; previous: number }>
  systemAlertes?: any[]
  creditAlerts?: any[]
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
        </div>
      )}

      {/* ALERTES SYSTÈME CRITIQUES (Intelligence GestiCom) */}
      {(data?.creditAlerts || []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4">
           {data?.creditAlerts?.map((alerte) => (
             <div key={alerte.id} className="flex items-center justify-between p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 text-indigo-900 shadow-sm animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-xl bg-indigo-500 shadow-md shadow-indigo-200">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2 py-0.5 rounded italic">Alerte Crédit</span>
                      <span className="text-[9px] font-bold opacity-60 uppercase">{new Date(alerte.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm font-bold tracking-tight">{alerte.message}</p>
                  </div>
                </div>
                <Link 
                  href="/dashboard/clients"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Gérer
                </Link>
             </div>
           ))}
        </div>
      )}

      {(data?.systemAlertes || []).filter(a => !a.lu).length > 0 && (
        <div className="grid grid-cols-1 gap-3">
           {(data?.systemAlertes || []).filter(a => !a.lu).slice(0, 2).map((alerte) => (
             <div key={alerte.id} className={`flex items-center justify-between p-3 rounded-2xl border backdrop-blur-xl ${alerte.type === 'CRITICAL' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${alerte.type === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'}`}>
                    <AlertTriangle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 italic">{alerte.categorie}</span>
                    </div>
                    <p className="text-xs font-bold tracking-tight">{alerte.message}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    await fetch(`/api/notifications/marquer-lues`, { method: 'POST', body: JSON.stringify({ id: alerte.id }) })
                    mutate()
                  }}
                  className="text-[9px] font-black uppercase tracking-widest py-1.5 px-3 bg-white/50 border border-current rounded-lg hover:bg-white transition-all"
                >
                  Ok
                </button>
             </div>
           ))}
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

      {/* KPIs Opérational & Financiers */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Chiffre d'Affaire (Jour)",
            value: data?.caJour ?? 0,
            icon: ArrowUp,
            isFcfa: true,
            color: 'from-orange-500 to-amber-500',
          },
          {
            title: "Chiffre d'Affaire (Mois)",
            value: data?.caMois ?? 0,
            icon: TrendingUp,
            isFcfa: true,
            color: 'from-emerald-600 to-teal-500',
          },
          {
            title: 'Panier Moyen',
            value: data?.panierMoyen ?? 0,
            icon: ShoppingCart,
            isFcfa: true,
            color: 'from-blue-600 to-sky-500',
          },
          {
            title: 'Valeur Stock (Achat PAMP)',
            value: data?.valeurStockTotal ?? 0,
            subValue: `CA Est: ${(data?.valeurStockVente ?? 0).toLocaleString('fr-FR')} F`,
            icon: Banknote,
            isFcfa: true,
            color: 'from-indigo-600 to-violet-500',
          },
        ].map((s, i) => (
          <KpiCard
            key={i}
            title={s.title}
            value={s.isFcfa ? `${(s.value as number).toLocaleString('fr-FR')} F` : (s as any).isPercent ? `${s.value}%` : s.value}
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
            color: 'from-yellow-400 to-orange-400',
            trend: txTrend.trend,
            trendValue: txTrend.value,
          },
          {
            title: 'Produits (Catalogue)',
            value: data?.totalProduitsCatalogue ?? 0,
            icon: Package,
            color: 'from-purple-600 to-fuchsia-500',
          },
          {
            title: 'Produits en Stock',
            value: data?.produitsEnStock ?? 0,
            icon: ShoppingBag,
            color: 'from-teal-500 to-emerald-400',
          },
          {
            title: 'Mouvements Jour',
            value: data?.mouvementsJour ?? 0,
            icon: RefreshCw,
            color: 'from-pink-600 to-rose-500',
          },
          {
            title: 'Clients Actifs',
            value: data?.clientsActifs ?? 0,
            icon: Users,
            color: 'from-cyan-600 to-blue-500',
          },
        ].map((s, i) => (
          <KpiCard
            key={i}
            title={s.title}
            value={(s as any).isPercent ? `${s.value}%` : s.value}
            icon={s.icon}
            color={s.color as any}
            trend={(s as any).trend as any}
            trendValue={(s as any).trendValue}
            loading={refreshing}
          />
        ))}
      </div>

      {/* Actions Rapides */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/achats"
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 transition-all"
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
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-700 transition-all"
        >
          <ShoppingCart className="h-4 w-4" />
          Nouvelle Vente
        </Link>
        <Link
          href="/dashboard/produits"
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-700 border border-gray-200 shadow-sm hover:shadow-md transition-all"
        >
          <Package className="h-4 w-4 text-orange-500" />
          Ajouter Produit
        </Link>
      </div>

      {/* GRILLE DE PERFORMANCE COMPACTE (Top 5, Valeur Stock, Alertes) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top 5 Produits */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-lg border border-gray-100">
          <div className="mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
               <TrendingUp className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Top 5 Ventes</h2>
          </div>
          <div className="space-y-4">
            {(data?.topProduits || []).slice(0, 5).map((p, i) => {
              const maxCa = (data?.topProduits || [])[0]?.ca || 1
              const pct = Math.round((p.ca / maxCa) * 100)
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-gray-700 truncate pr-2">{p.name}</span>
                    <span className="text-emerald-600 font-black">{p.ca.toLocaleString()} F</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Valeur Stock */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-lg border border-gray-100">
          <div className="mb-4 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
               <LayoutGrid className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Valeur Stock</h2>
          </div>
          <div className="space-y-4">
            {(data?.repartition || []).slice(0, 4).map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">{c.name}</span>
                  <span className="text-blue-600 font-black">{c.percent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${c.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-5 flex justify-between items-end">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Valeur Achat</span>
                <span className="text-sm font-black text-gray-900">{(data?.valeurStockTotal || 0).toLocaleString()} F</span>
             </div>
             <div className="flex flex-col text-right">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">CA Prévisionnel</span>
                <span className="text-sm font-black text-blue-600">{(data?.valeurStockVente || 0).toLocaleString()} F</span>
             </div>
          </div>
        </div>

        {/* Alertes Stock Faible */}
        <div className="flex flex-col rounded-2xl bg-white p-5 shadow-lg border border-red-50">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                 <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Alertes Stock</h2>
            </div>
          </div>
          <div className="space-y-3">
            {lowStock.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-10">Aucune alerte critique</p>
            ) : (
              lowStock.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-xs font-bold text-gray-800 truncate">{p.name}</span>
                  <span className="text-xs font-black text-red-600 bg-red-50 px-2.5 py-1 rounded whitespace-nowrap">{p.stock} unités</span>
                </div>
              ))
            )}
          </div>
          <Link href="/dashboard/stock" className="mt-4 block text-center text-[9px] font-black uppercase text-gray-500 hover:text-red-600 transition-colors">
            Voir tout le stock
          </Link>
        </div>
      </div>

      {/* Activité récente + Suggestions IA */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activité récente */}
        <div className="flex flex-col rounded-2xl bg-white p-4 shadow-lg border border-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                 <ShoppingCart className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">Flux de ventes</h2>
            </div>
            <Link href="/dashboard/ventes" className="text-[10px] font-bold text-orange-600 hover:underline">
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

      {/* SECTION FINANCIÈRE & TENDANCES */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Graphique de Tendance (2/3) */}
        <div className="lg:col-span-2 flex flex-col rounded-2xl bg-white p-6 shadow-lg border border-gray-100">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                 <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                 <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">Tendance des Ventes</h2>
                 <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Comparaison Année N vs N-1</p>
              </div>
            </div>
          </div>
          
          <div className="relative h-48 w-full mt-4 flex items-end justify-between gap-1.5 px-2">
            {(!data?.monthlyTrends || data.monthlyTrends.length === 0) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                 <BarChart3 className="h-8 w-8 text-gray-200 mb-2" />
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center px-4">Analyse des données en cours ou aucune vente enregistrée sur les 24 derniers mois</p>
              </div>
            ) : (
              (data?.monthlyTrends || []).map((m: any, i: number) => {
                const trends = data?.monthlyTrends || []
                // Calcul du max sur toute la série pour une échelle cohérente
                const maxVal = Math.max(...trends.map((t: any) => Math.max(t.current || 0, t.previous || 0)))
                const max = maxVal > 0 ? maxVal : 1
                
                // Calcul des hauteurs (min 2% pour visibilité)
                const hCurrent = Math.max(2, Math.round(((m.current || 0) / max) * 100))
                const hPrevious = Math.max(2, Math.round(((m.previous || 0) / max) * 100))
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end">
                     <div className="flex items-end gap-1 w-full justify-center h-full pb-1">
                        {/* Barre Année Précédente */}
                        <div 
                          className="w-2 bg-gray-200 rounded-t-sm transition-all duration-700 hover:bg-gray-300" 
                          style={{ height: `${hPrevious}%` }} 
                          title={`Année précédente : ${(m.previous || 0).toLocaleString()} F`} 
                        />
                        {/* Barre Année Actuelle */}
                        <div 
                          className="w-2 bg-blue-600 rounded-t-sm transition-all duration-700 shadow-[0_0_10px_rgba(37,99,235,0.2)] hover:bg-blue-700" 
                          style={{ height: `${hCurrent}%` }} 
                          title={`Année actuelle : ${(m.current || 0).toLocaleString()} F`} 
                        />
                     </div>
                     <span className="mt-2 text-[9px] font-black text-gray-400 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{m.month}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Trésorerie & Dettes */}
        <div className="flex flex-col gap-4">
           {/* Trésorerie */}
           <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 shadow-xl text-white">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-2 bg-white/20 rounded-xl">
                    <Wallet className="h-5 w-5" />
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-widest opacity-70 italic font-serif">OHADA</span>
              </div>
              <div>
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Trésorerie Globale</p>
                 <h3 className="text-2xl font-black mt-1">{(data?.tresorerieReelle || 0).toLocaleString()} F</h3>
                 
                 <div className="h-px bg-white/10 my-3" />
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                       <p className="text-[8px] font-black uppercase opacity-60">Caisse</p>
                       <p className="text-xs font-bold">{(data?.tresorerieCaisse || 0).toLocaleString()} F</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black uppercase opacity-60">Banque</p>
                       <p className="text-xs font-bold">{(data?.tresorerieBanque || 0).toLocaleString()} F</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* Dettes / Créances */}
           <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex-1">
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <ArrowDownRight className="h-4 w-4 text-red-500" />
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Dettes</span>
                    </div>
                    <span className="text-sm font-black text-red-600">{(data?.totalDettes || 0).toLocaleString()} F</span>
                 </div>
                 <div className="h-px bg-gray-50" />
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Créances</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">{(data?.totalCreances || 0).toLocaleString()} F</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>

  )
}
