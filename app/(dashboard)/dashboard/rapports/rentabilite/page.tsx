'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Filter, FileBarChart2, Loader2, Package, Search } from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import Pagination from '@/components/ui/Pagination'

export default function RentabilitePage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30) // 30 jours en arrière
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split('T')[0])
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchRentabilite()
  }, [])

  const fetchRentabilite = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapports/rentabilite?dateDebut=${dateDebut}&dateFin=${dateFin}`)
      if (res.ok) {
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredData = data.filter(item => 
    item.designation.toLowerCase().includes(recherche.toLowerCase()) ||
    item.code.toLowerCase().includes(recherche.toLowerCase())
  )

  const stats = filteredData.reduce((acc, item) => {
    acc.ca += item.chiffreAffairesHT
    acc.marge += item.margeBrute
    return acc
  }, { ca: 0, marge: 0 })

  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const tauxMoy = stats.ca > 0 ? (stats.marge / stats.ca) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Rentabilité par Produit</h1>
          <p className="mt-1 text-white/90">Analyse des marges nettes sur les ventes</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-orange-100 p-3 text-orange-900 border border-orange-200">
                <TrendingUp className="h-5 w-5" />
                <div>
                    <p className="text-xs font-medium uppercase opacity-70">Marge Globale</p>
                    <p className="text-lg font-bold">{stats.marge.toLocaleString('fr-FR')} FCFA</p>
                </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-purple-100 p-3 text-purple-900 border border-purple-200">
                <ArrowUpRight className="h-5 w-5" />
                <div>
                    <p className="text-xs font-medium uppercase opacity-70">Taux Moyen</p>
                    <p className="text-lg font-bold">{tauxMoy.toFixed(1)}%</p>
                </div>
            </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700">Rechercher un produit</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Code ou désignation..."
              className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Période du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          onClick={fetchRentabilite}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 flex items-center gap-2"
        >
          <Filter className="h-4 w-4" /> Filtrer
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Produit</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Qté Vendue</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">C.A HT</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Coût Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Marge Brute</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Taux (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
                    <p className="mt-2 text-sm text-gray-500">Calcul des marges en cours...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500">
                    Aucune vente enregistrée sur cette période.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr key={item.produitId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-500">
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.designation}</p>
                          <p className="text-xs text-gray-500">{item.code} • {item.categorie}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-medium">
                      {item.quantiteVendue.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-medium">
                      {item.chiffreAffairesHT.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">
                      {item.coutTotalHT.toLocaleString('fr-FR')}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-bold ${item.margeBrute >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.margeBrute.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.tauxMarge > 25 ? 'bg-green-100 text-green-800' : 
                        item.tauxMarge > 10 ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {item.tauxMarge.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && totalPages > 1 && (
          <div className="flex justify-center p-6 border-t border-gray-100 mt-2">
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              itemsPerPage={itemsPerPage} 
              totalItems={filteredData.length} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>
    </div>
  )
}
