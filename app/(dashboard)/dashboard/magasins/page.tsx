'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Package, Warehouse, ArrowRightLeft, AlertTriangle, DollarSign, Loader2, Building2, ShoppingCart, TrendingUp, MapPin, CheckCircle2, XCircle } from 'lucide-react'
import { formatApiError } from '@/lib/validation-helpers'
import { useToast } from '@/hooks/useToast'

type Magasin = { id: number; code: string; nom: string; localisation: string; actif: boolean; estDepotPrincipal: boolean; soldeCaisse: number }
type StockRow = { id: number | null; quantite: number; produit: { id: number; code: string; designation: string; prixVente: number | null; prixAchat: number | null; seuilMin: number } }

export default function MagasinsPage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [stocks, setStocks] = useState<Record<number, StockRow[]>>({})
  const [loading, setLoading] = useState(true)
  const { error: showError } = useToast()

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    try {
      const mRes = await fetch('/api/magasins?tous=1')
      if (!mRes.ok) return
      const mData = await mRes.json()
      const liste: Magasin[] = Array.isArray(mData) ? mData : mData.magasins || []
      setMagasins(liste)

      const stockMap: Record<number, StockRow[]> = {}
      for (const m of liste) {
        try {
          const sRes = await fetch(`/api/stock?magasinId=${m.id}&complet=1`)
          if (sRes.ok) {
            const sData = await sRes.json()
            stockMap[m.id] = (Array.isArray(sData) ? sData : sData.stocks || []).filter((s: StockRow) => s.quantite > 0)
          }
        } catch {}
      }
      setStocks(stockMap)
    } catch { showError('Erreur chargement magasins') }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Warehouse className="h-7 w-7 text-orange-500" /> Magasins & Entrepôts
          </h1>
          <p className="text-sm text-white dark:text-gray-400 mt-1">Gestion multi-magasins, stocks et transferts</p>
        </div>
        <Link href="/dashboard/stock" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-all">
          <Package className="h-4 w-4" /> Gérer les stocks
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {magasins.map(m => {
          const magStock = stocks[m.id] || []
          const valeurStock = magStock.reduce((a, s) => a + s.quantite * (s.produit.prixAchat || s.produit.prixVente || 0), 0)
          const enAlerte = magStock.filter(s => s.quantite <= s.produit.seuilMin).length

          return (
            <div key={m.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 dark:text-white text-lg">{m.nom}</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.estDepotPrincipal && (
                    <span className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-black uppercase">Principal</span>
                  )}
                  {m.actif ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <MapPin className="h-4 w-4" /> {m.localisation}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{magStock.length}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produits</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{valeurStock.toLocaleString('fr-FR')}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valeur stock</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
                  <p className={`text-2xl font-black ${enAlerte > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{enAlerte}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alertes</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link href={`/dashboard/stock?magasinId=${m.id}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                  <Package className="h-4 w-4" /> Voir le stock
                </Link>
                <Link href={`/dashboard/stock?transfert=1&origine=${m.id}`} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold text-xs hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-all">
                  <ArrowRightLeft className="h-4 w-4" /> Transférer
                </Link>
              </div>
            </div>
          )
        })}

        {magasins.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold text-lg">Aucun magasin trouvé</p>
            <p className="text-sm">Créez des magasins dans les paramètres</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-orange-500" /> Transferts récents
        </h2>
        <TransfertsRecents />
      </div>
    </div>
  )
}

function TransfertsRecents() {
  const [transferts, setTransferts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stock/transferts?limit=10')
      .then(r => r.json())
      .then(d => setTransferts(d.transferts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
  if (!transferts.length) return <p className="text-sm text-gray-400 text-center py-8">Aucun transfert récent</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <th className="pb-2 pr-4">N°</th>
            <th className="pb-2 pr-4">Date</th>
            <th className="pb-2 pr-4">Origine</th>
            <th className="pb-2 pr-4">Destination</th>
            <th className="pb-2 pr-4">Articles</th>
            <th className="pb-2 text-right">Statut</th>
          </tr>
        </thead>
        <tbody>
          {transferts.map((t: any) => (
            <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800">
              <td className="py-3 pr-4 font-bold text-gray-900 dark:text-white">{t.numero}</td>
              <td className="py-3 pr-4 text-gray-500">{new Date(t.dateTransfert).toLocaleDateString('fr-FR')}</td>
              <td className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-300">{t.magasinOrigine?.nom || t.magasinSourceId}</td>
              <td className="py-3 pr-4 font-medium text-gray-700 dark:text-gray-300">{t.magasinDestination?.nom || t.magasinDestId}</td>
              <td className="py-3 pr-4 text-gray-500">{t.lignes?.length || 0} article{(t.lignes?.length || 0) > 1 ? 's' : ''}</td>
              <td className="py-3 text-right">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                  {t.statut || 'Effectué'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
