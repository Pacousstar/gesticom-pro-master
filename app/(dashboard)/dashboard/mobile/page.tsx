'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { TrendingUp, DollarSign, ShoppingCart, ClipboardList, ArrowUp, ArrowDown, Package, Users, RefreshCw, ChevronLeft, ChevronRight, Smartphone, Wallet, AlertTriangle, Banknote } from 'lucide-react'
import DonutChart from '@/components/dashboard/DonutChart'
import CalendarHeatmap from '@/components/dashboard/CalendarHeatmap'

type DashboardData = {
  caJour: number; caMois: number; panierMoyen: number; transactionsJour: number; transactionsHier: number
  produitsEnStock: number; totalProduitsCatalogue: number; clientsActifs: number
  caParCategorie: Array<{ categorie: string; montant: number }>
  caJournalier: Array<{ jour: number; montant: number }>
  topProduits: Array<{ name: string; ca: number; qte: number }>
  recentSales: Array<{ id: string; numero: string; client: string; montant: number; time: string }>
  tresorerieReelle: number; tresorerieCaisse: number; tresorerieBanque: number
  valeurStockTotal: number
  lowStock: Array<{ name: string; stock: number; min: number; category: string }>
}

const PAGES = [
  { id: 'kpi', label: 'KPI', icon: TrendingUp },
  { id: 'charts', label: 'Graphiques', icon: DollarSign },
  { id: 'top', label: 'Top Produits', icon: Package },
  { id: 'ventes', label: 'Ventes', icon: ShoppingCart },
  { id: 'finance', label: 'Finance', icon: Wallet },
]

export default function MobileDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const touchX = useRef(0)

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) setData(await res.json())
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { charger(); intervalRef.current = setInterval(charger, 60000); return () => clearInterval(intervalRef.current) }, [charger])

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) setPage(p => Math.max(0, Math.min(PAGES.length - 1, p + (diff > 0 ? 1 : -1))))
  }

  function formatFCFA(v: number) { return (v || 0).toLocaleString('fr-FR') + ' F' }
  function calcTrend(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? { dir: 'up' as const, val: 100 } : { dir: 'neutral' as const, val: 0 }
    const dir = cur >= prev ? 'up' : 'down'
    return { dir: dir as 'up' | 'down', val: Math.round(Math.abs((cur - prev) / prev * 100)) }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center bg-gray-950">
      <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  )

  const trend = calcTrend(data?.transactionsJour || 0, data?.transactionsHier || 0)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-orange-400" />
          <span className="font-black text-sm">MOBILE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-bold">{PAGES[page].label}</span>
          <button onClick={() => { setRefreshing(true); charger() }} className="p-2 rounded-xl bg-gray-800 active:scale-90" disabled={refreshing}>
            <RefreshCw className={`h-5 w-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/dashboard" className="text-xs text-orange-400 font-bold underline">Vue complète</Link>
        </div>
      </div>

      {/* Pages swipeable */}
      <div className="flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="h-full flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${page * (100 / PAGES.length)}%)`, width: `${PAGES.length * 100}%` }}>
          {/* Page 1: KPI */}
          <div className="h-full w-full p-4 overflow-y-auto" style={{ width: `${100 / PAGES.length}%` }}>
            <div className="space-y-3">
              {[
                { title: 'CA Jour', value: formatFCFA(data?.caJour || 0), icon: DollarSign, color: 'from-orange-500 to-amber-500' },
                { title: 'CA Mois', value: formatFCFA(data?.caMois || 0), icon: TrendingUp, color: 'from-emerald-600 to-teal-500' },
                { title: 'Panier Moyen', value: formatFCFA(data?.panierMoyen || 0), icon: ShoppingCart, color: 'from-blue-600 to-sky-500' },
                { title: 'Valeur Stock', value: formatFCFA(data?.valeurStockTotal || 0), icon: Package, color: 'from-indigo-600 to-violet-500' },
              ].map((k, i) => (
                <div key={i} className={`rounded-2xl bg-gradient-to-br ${k.color} p-5 shadow-lg`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white/80">{k.title}</p>
                    <k.icon className="h-6 w-6 text-white/60" />
                  </div>
                  <p className="mt-2 text-3xl font-black text-white">{k.value}</p>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-gray-800 p-4 text-center">
                  <ClipboardList className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-white">{data?.transactionsJour || 0}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Ventes</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {trend.dir === 'up' ? <ArrowUp className="h-3 w-3 text-emerald-400" /> : <ArrowDown className="h-3 w-3 text-red-400" />}
                    <span className={`text-xs font-bold ${trend.dir === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>{trend.val}%</span>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-800 p-4 text-center">
                  <Package className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-white">{data?.produitsEnStock || 0}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">En stock</p>
                  <p className="text-[10px] text-gray-500 mt-1">/{data?.totalProduitsCatalogue || 0}</p>
                </div>
                <div className="rounded-xl bg-gray-800 p-4 text-center">
                  <Users className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-black text-white">{data?.clientsActifs || 0}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Clients</p>
                </div>
              </div>

              {/* Alertes Stock Faible */}
              {(data?.lowStock || []).length > 0 && (
                <div className="rounded-xl bg-red-900/30 border border-red-800/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <p className="text-xs font-black text-red-400 uppercase tracking-wider">Alertes Stock</p>
                  </div>
                  {data?.lowStock.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-red-800/20 last:border-0">
                      <p className="text-sm font-bold truncate flex-1">{p.name}</p>
                      <span className="text-xs font-black text-red-400 bg-red-950/50 px-2 py-0.5 rounded">{p.stock} unités</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Page 2: Graphiques */}
          <div className="h-full w-full p-4 overflow-y-auto" style={{ width: `${100 / PAGES.length}%` }}>
            <div className="space-y-6">
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="font-black text-sm text-gray-300 mb-4 uppercase tracking-wider">CA par catégorie</h3>
                <DonutChart data={data?.caParCategorie || []} total={data?.caMois || 0} dark />
              </div>
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="font-black text-sm text-gray-300 mb-4 uppercase tracking-wider">Heatmap mensuelle</h3>
                <CalendarHeatmap data={data?.caJournalier || []} mois={new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date())} dark />
              </div>
            </div>
          </div>

          {/* Page 3: Top Produits */}
          <div className="h-full w-full p-4 overflow-y-auto" style={{ width: `${100 / PAGES.length}%` }}>
            <h3 className="font-black text-sm text-gray-300 mb-4 uppercase tracking-wider">Top Produits</h3>
            <div className="space-y-2">
              {(data?.topProduits || []).map((p, i) => (
                <div key={i} className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center font-black text-orange-400 text-lg">#{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.qte} vendu{p.qte > 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-black text-orange-400 text-sm">{formatFCFA(p.ca)}</p>
                </div>
              ))}
              {(!data?.topProduits || data.topProduits.length === 0) && (
                <p className="text-center text-gray-500 py-8">Aucune donnée</p>
              )}
            </div>
            <div className="mt-6 rounded-2xl bg-gray-900 border border-gray-800 p-5">
              <h3 className="font-black text-sm text-gray-300 mb-3 uppercase tracking-wider">Trésorerie</h3>
              <p className="text-3xl font-black text-emerald-400">{formatFCFA((data?.tresorerieCaisse || 0) + (data?.tresorerieBanque || 0))}</p>
              <div className="flex items-center gap-4 mt-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Caisse</p>
                  <p className="text-sm font-bold text-white">{formatFCFA(data?.tresorerieCaisse || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Banque</p>
                  <p className="text-sm font-bold text-white">{formatFCFA(data?.tresorerieBanque || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Page 4: Ventes */}
          <div className="h-full w-full p-4 overflow-y-auto" style={{ width: `${100 / PAGES.length}%` }}>
            <h3 className="font-black text-sm text-gray-300 mb-4 uppercase tracking-wider">Dernières ventes</h3>
            <div className="space-y-2">
              {(data?.recentSales || []).map((v, i) => (
                <div key={v.id || i} className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{v.numero}</p>
                    <p className="text-xs text-gray-400 truncate">{v.client || 'Client divers'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-400 text-sm">{formatFCFA(v.montant)}</p>
                    <p className="text-[10px] text-gray-500">{v.time}</p>
                  </div>
                </div>
              ))}
              {(!data?.recentSales || data.recentSales.length === 0) && (
                <p className="text-center text-gray-500 py-8">Aucune vente récente</p>
              )}
            </div>
          </div>

          {/* Page 5: Finance */}
          <div className="h-full w-full p-4 overflow-y-auto" style={{ width: `${100 / PAGES.length}%` }}>
            <h3 className="font-black text-sm text-gray-300 mb-4 uppercase tracking-wider">Finance</h3>
            <div className="space-y-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="h-5 w-5 text-white/70" />
                  <p className="text-xs font-black text-white/70 uppercase tracking-wider">Trésorerie</p>
                </div>
                <p className="text-4xl font-black text-white">{formatFCFA((data?.tresorerieCaisse || 0) + (data?.tresorerieBanque || 0))}</p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] font-black text-white/60 uppercase">Caisse</p>
                    <p className="text-lg font-black text-white">{formatFCFA(data?.tresorerieCaisse || 0)}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] font-black text-white/60 uppercase">Banque</p>
                    <p className="text-lg font-black text-white">{formatFCFA(data?.tresorerieBanque || 0)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5">
                <h3 className="font-black text-sm text-gray-300 mb-3 uppercase tracking-wider">Valeur Stock</h3>
                <p className="text-3xl font-black text-indigo-400">{formatFCFA(data?.valeurStockTotal || 0)}</p>
                <p className="text-xs text-gray-500 mt-2">Valorisé au coût d&apos;achat (PAMP)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard/ventes" className="rounded-xl bg-orange-600 p-4 text-center active:scale-95 transition-transform">
                  <ShoppingCart className="h-6 w-6 text-white/80 mx-auto mb-1" />
                  <p className="text-xs font-black text-white">Ventes</p>
                </Link>
                <Link href="/dashboard/stock" className="rounded-xl bg-indigo-600 p-4 text-center active:scale-95 transition-transform">
                  <Package className="h-6 w-6 text-white/80 mx-auto mb-1" />
                  <p className="text-xs font-black text-white">Stock</p>
                </Link>
                <Link href="/dashboard/caisse" className="rounded-xl bg-emerald-600 p-4 text-center active:scale-95 transition-transform">
                  <Wallet className="h-6 w-6 text-white/80 mx-auto mb-1" />
                  <p className="text-xs font-black text-white">Caisse</p>
                </Link>
                <Link href="/dashboard/banque" className="rounded-xl bg-blue-600 p-4 text-center active:scale-95 transition-transform">
                  <Banknote className="h-6 w-6 text-white/80 mx-auto mb-1" />
                  <p className="text-xs font-black text-white">Banque</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-2 py-3 bg-gray-900 border-t border-gray-800 shrink-0">
        {PAGES.map((p, i) => (
          <button key={p.id} onClick={() => setPage(i)} className={`transition-all ${i === page ? 'bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-bold' : 'bg-gray-800 text-gray-300 px-2 py-1 rounded-full text-[10px] font-bold hover:bg-gray-700'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Arrows for desktop/non-touch */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 pointer-events-none flex items-center justify-between px-2">
        {page > 0 && <button onClick={() => setPage(p => p - 1)} className="pointer-events-auto bg-gray-800/80 p-3 rounded-full text-white shadow-lg"><ChevronLeft className="h-6 w-6" /></button>}
        {page < PAGES.length - 1 && <button onClick={() => setPage(p => p + 1)} className="pointer-events-auto bg-gray-800/80 p-3 rounded-full text-white shadow-lg"><ChevronRight className="h-6 w-6" /></button>}
      </div>
    </div>
  )
}

