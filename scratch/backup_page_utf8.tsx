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
  ShieldCheck,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  LineChart as ChartIcon
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
  systemAlertes: Array<{ id: number; date: string; type: string; categorie: string; message: string; lu: boolean }>
  creditAlerts?: Array<{ id: string; date: string; type: string; categorie: string; message: string }>
  totalDepensesCount: number
  totalDepensesAmount: number
  tresorerieReelle: number
  tresorerieCaisse: number
  tresorerieBanque: number
  totalDettes: number
  totalCreances: number
  monthlyTrends: Array<{ month: string; current: number; previous: number }>
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

  // Fetcher personnalis├® pour g├®rer le timeout et les erreurs sp├®cifiques
  const fetcher = async (url: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    try {
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        if (d._timeout) {
          throw new Error('R├®ponse partielle (timeout). Fermez le portable puis rechargez.')
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
    revalidateIfStale: true,     // Recharge s'il y a plus r├®cent
    keepPreviousData: true,      // Affiche les anciennes donn├®es pendant le chargement au lieu d'un spinner
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
          <p className="font-bold flex items-center gap-2 underline"><AlertTriangle className="h-4 w-4" /> Probl├¿me de chargement</p>
          <p className="text-sm">{err}</p>
        </div>
      )}

       {/* ALERTES SYST├êME CRITIQUES (Intelligence GestiCom) */}
       {(data?.creditAlerts || []).length > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4">
           {data?.creditAlerts?.map((alerte) => (
             <div key={alerte.id} className="flex items-center justify-between p-5 rounded-3xl border-2 border-indigo-500/50 bg-indigo-500/10 backdrop-blur-3xl text-indigo-100 shadow-2xl animate-pulse">
                <div className="flex items-center gap-5">
                  <div className="p-3 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/50">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-500 text-white px-3 py-0.5 rounded-full italic">Alerte Cr├®dit - 90%</span>
                      <span className="text-[9px] font-bold opacity-60 uppercase">{new Date(alerte.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-base font-black italic tracking-tight uppercase">{alerte.message}</p>
                  </div>
                </div>
                <Link 
                  href="/dashboard/clients"
                  className="bg-white/10 hover:bg-indigo-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 whitespace-nowrap"
                >
                  G├®rer Client
                </Link>
             </div>
           ))}
        </div>
      )}

      {(data?.systemAlertes || []).filter(a => !a.lu).length > 0 && (
        <div className="grid grid-cols-1 gap-4">
           {data?.systemAlertes.filter(a => !a.lu).slice(0, 3).map((alerte) => (
             <div key={alerte.id} className={`flex items-center justify-between p-4 rounded-2xl border-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-700 ${alerte.type === 'CRITICAL' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-amber-500/10 border-amber-500/50 text-amber-600'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${alerte.type === 'CRITICAL' ? 'bg-red-500' : 'bg-amber-500'}`}>
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded italic">{alerte.categorie}</span>
                      <span className="text-[9px] font-bold opacity-60 uppercase">{new Date(alerte.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm font-black italic tracking-tight">{alerte.message}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    await fetch(`/api/notifications/marquer-lues`, { method: 'POST', body: JSON.stringify({ id: alerte.id }) })
                    mutate()
                  }}
                  className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Acquitter
                </button>
             </div>
           ))}
        </div>
      )}


      {/* En-t├¬te avec bouton actualiser */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard ERP</h1>
          <p className="mt-1 text-white/80 text-sm font-medium">
            Vue d├®cisionnelle ÔÇö Performances, stocks et activit├® en temps r├®el
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

      {/* KPIs Op├®rationnels & Financiers */}
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
          {
            title: 'Taux de Rupture',
            value: data?.tauxRupture ?? 0,
            icon: AlertTriangle,
            isPercent: true,
            color: 'from-rose-600 to-red-500',
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
          R├®ception Rapide
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
              <p className="text-sm text-gray-400 text-center py-10 italic">Aucune donn├®e de vente disponible.</p>
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
                      {p.qte} UNIT├ëS VENDUES
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* R├®partition Valeur Stock */}
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
              <p className="text-sm text-gray-400 text-center py-10 italic">Stock non r├®pertori├®.</p>
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
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Capital Immobilis├® (PAMP)</span>
                <span className="text-xl font-black text-emerald-700 tabular-nums">{(data?.valeurStockTotal || 0).toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">CA Pr├®visionnel</span>
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
                <p className="text-2xl">Ô£à</p>
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
                      <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded tabular-nums whitespace-nowrap">{p.stock} Unit├®s</span>
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

      {/* Activit├® r├®cente + Suggestions IA */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activit├® r├®cente */}
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

      {/* SECTION FINANCI├êRE & TENDANCES (AJOUT├ëE EN BAS) */}
      <div className="grid gap-6 lg:grid-cols-3 mt-8">
        {/* Graphique de Tendance (2/3) */}
        <div className="lg:col-span-2 flex flex-col rounded-3xl bg-white p-8 shadow-xl border border-gray-100">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50">
                <ChartIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase italic underline decoration-blue-500/30">Tendance des Ventes</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-0.5">Performance glissante sur 12 mois</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex items-end justify-between gap-1 sm:gap-4 h-64 mt-6 px-2">
            {(!data?.monthlyTrends || data.monthlyTrends.every((m: any) => m.current === 0 && m.previous === 0)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl z-0 border border-dashed border-gray-200">
                <ChartIcon className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Donn├®es de tendance en attente...</p>
              </div>
            )}
            
            {(data?.monthlyTrends || Array(12).fill({ month: '-', current: 0, previous: 0 })).map((m: any, i: number) => {
              const trends = data?.monthlyTrends || []
              const allValues = trends.map((t: any) => Math.max(t.current, t.previous))
              const max = Math.max(1, ...allValues)
              
              const hCurrent = Math.max(3, Math.round((m.current / max) * 100))
              const hPrevious = Math.max(3, Math.round((m.previous / max) * 100))
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end z-10">
                  <div className="flex items-end gap-1 h-full w-full justify-center">
                    {/* Ann├®e Pr├®c├®dente (Gris - Plus visible) */}
                    <div 
                      className="w-full max-w-[10px] bg-slate-300 rounded-t-sm transition-all duration-1000 group-hover:bg-slate-400"
                      style={{ height: `${hPrevious}%` }}
                    />
                    {/* Ann├®e Courante (Gradient Indigo/Blue - Premium) */}
                    <div 
                      className="w-full max-w-[10px] bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-sm transition-all duration-700 group-hover:scale-y-105 group-hover:from-blue-500 group-hover:to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                      style={{ height: `${hCurrent}%` }}
                    />
                  </div>
                  <span className="mt-4 text-[9px] font-black text-gray-500 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{m.month}</span>
                  
                  {/* Tooltip ultra-l├®ger */}
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white text-[10px] p-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20 shadow-2xl whitespace-nowrap border border-white/10 scale-90 group-hover:scale-100">
                    <p className="font-black border-b border-white/10 pb-1.5 mb-1.5 uppercase tracking-widest text-center">{m.month}</p>
                    <div className="space-y-1">
                      <p className="flex justify-between gap-4 font-bold">
                        <span className="text-gray-400 uppercase">Actuel</span>
                        <span className="text-blue-400">{m.current.toLocaleString()} F</span>
                      </p>
                      <p className="flex justify-between gap-4 font-bold">
                        <span className="text-gray-400 uppercase font-medium">Pr├®c├®dent</span>
                        <span className="text-gray-300">{m.previous.toLocaleString()} F</span>
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Compteurs Financiers (1/3) */}
        <div className="flex flex-col gap-6">
          {/* Tr├®sorerie d├®taill├®e */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 shadow-xl shadow-emerald-200 text-white border border-white/10">
            <div className="flex justify-between items-start mb-6">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Tr├®sorerie Globale</span>
                <TrendingUp className="h-4 w-4 opacity-50 mt-1" />
              </div>
            </div>
            
            <div className="space-y-4">
               <div>
                  <h3 className="text-3xl font-black tabular-nums tracking-tighter">
                    {(data?.tresorerieReelle || 0).toLocaleString('fr-FR')} F
                  </h3>
                  <p className="text-[9px] mt-1 opacity-60 italic uppercase font-bold tracking-widest">Liquidit├®s totales disponibles</p>
               </div>
               
               <div className="h-px bg-white/10 w-full" />
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-70">En Caisse</p>
                     <p className="text-sm font-bold tabular-nums">{(data?.tresorerieCaisse || 0).toLocaleString('fr-FR')} F</p>
                  </div>
                  <div className="space-y-1 text-right">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Banque & MM</p>
                     <p className="text-sm font-bold tabular-nums">{(data?.tresorerieBanque || 0).toLocaleString('fr-FR')} F</p>
                  </div>
               </div>
            </div>
            
            <div className="mt-6">
               <Link href="/dashboard/banque" className="block w-full text-center py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10">
                  D├®tails & Virements
               </Link>
            </div>
          </div>

          {/* Dettes / Cr├®ances */}
          <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
             <div className="space-y-6">
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="h-4 w-4 text-rose-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dettes Fournisseurs</span>
                   </div>
                   <p className="text-xl font-black text-rose-600 tabular-nums">
                      {(data?.totalDettes || 0).toLocaleString('fr-FR')} F
                   </p>
                </div>
                <div className="h-px bg-gray-50 w-full" />
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cr├®ances Clients</span>
                   </div>
                   <p className="text-xl font-black text-emerald-600 tabular-nums">
                      {(data?.totalCreances || 0).toLocaleString('fr-FR')} F
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
