'use client'

import { useState, useEffect } from 'react'
import { Search, Package, Loader2 } from 'lucide-react'

type StockInfo = {
  id: number
  produitId: number
  designation: string
  categorie: string | null
  quantite: number
  magasin: string
  seuilMin: number | null
}

export default function MobileStockPage() {
  const [stocks, setStocks] = useState<StockInfo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/produits?complet=1').then(r => r.ok ? r.json() : []),
      fetch('/api/stock?complet=1').then(r => r.ok ? r.json() : []),
    ]).then(([produits, stocksData]) => {
      const pList = Array.isArray(produits) ? produits : []
      const sList = Array.isArray(stocksData) ? stocksData : (stocksData?.data && Array.isArray(stocksData.data) ? stocksData.data : [])
      setStocks(buildStockList(pList, sList))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function buildStockList(produits: any[], stocksRaw: any[]): StockInfo[] {
    const stockByProduit: Record<number, { magasin: string; quantite: number }[]> = {}
    for (const s of stocksRaw) {
      const pid = s.produitId || s.produit?.id
      if (!pid) continue
      if (!stockByProduit[pid]) stockByProduit[pid] = []
      stockByProduit[pid].push({
        magasin: s.magasin?.nom || s.magasinNom || 'Magasin',
        quantite: s.quantite || s.stockActuel || 0,
      })
    }
    const result: StockInfo[] = []
    for (const p of produits) {
      const entries = stockByProduit[p.id] || []
      if (entries.length === 0) {
        result.push({
          id: p.id, produitId: p.id,
          designation: p.designation, categorie: p.categorie,
          quantite: 0, magasin: '—', seuilMin: p.seuilMin,
        })
      }
      for (const e of entries) {
        result.push({
          id: p.id, produitId: p.id,
          designation: p.designation, categorie: p.categorie,
          quantite: e.quantite, magasin: e.magasin, seuilMin: p.seuilMin,
        })
      }
    }
    return result
  }

  const searchLower = search.toLowerCase()
  const filtered = stocks.filter(s =>
    !search || s.designation.toLowerCase().includes(searchLower) ||
    (s.categorie && s.categorie.toLowerCase().includes(searchLower))
  )

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <Package className="h-5 w-5 text-orange-400" />
        <span className="font-black text-sm">Stock</span>
      </div>

      <div className="px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 font-bold"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filtered.map((s, i) => {
            const lowStock = s.seuilMin != null && s.quantite <= s.seuilMin
            const outOfStock = s.quantite <= 0
            return (
              <div key={`${s.produitId}-${i}`} className="flex items-center gap-3 bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  outOfStock ? 'bg-red-500/20' : lowStock ? 'bg-amber-500/20' : 'bg-emerald-500/20'
                }`}>
                  <Package className={`h-5 w-5 ${
                    outOfStock ? 'text-red-400' : lowStock ? 'text-amber-400' : 'text-emerald-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{s.designation}</p>
                  <p className="text-xs text-gray-400">{s.categorie || 'Général'} — {s.magasin}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${
                    outOfStock ? 'text-red-400' : lowStock ? 'text-amber-400' : 'text-white'
                  }`}>
                    {s.quantite}
                  </p>
                  {s.seuilMin != null && (
                    <p className="text-[10px] text-gray-500">min {s.seuilMin}</p>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Aucun produit trouvé</p>
          )}
        </div>
      </div>
    </div>
  )
}
