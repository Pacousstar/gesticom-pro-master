'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Download, Filter, Wallet, FileText, ShoppingBag, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface SoldeFournisseur {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  localisation: string | null
  achats: number
  paiements: number
  variationPeriode: number
  soldeGlobal: number
  derniereFacture: string | null
}

export default function SoldesFournisseursPage() {
  const router = useRouter()
  const [data, setData] = useState<SoldeFournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const ITEMS_PER_PAGE_REPORT = 18
  const { error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fournisseurs/soldes?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      } else {
        showError('Impossible de charger les soldes fournisseurs.')
      }
    } catch (err) {
      console.error(err)
      showError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchData(startDate, endDate)
  }

  const handleDirectPrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 1000)
  }

  const filteredData = data.filter(f => 
    f.nom.toLowerCase().includes(search.toLowerCase()) || 
    (f.code && f.code.toLowerCase().includes(search.toLowerCase())) ||
    (f.localisation && f.localisation.toLowerCase().includes(search.toLowerCase()))
  )

  const totals = filteredData.reduce((acc, f) => ({
    achats: acc.achats + f.achats,
    paiements: acc.paiements + f.paiements,
    variationPeriode: acc.variationPeriode + f.variationPeriode,
    soldeGlobal: acc.soldeGlobal + f.soldeGlobal
  }), { achats: 0, paiements: 0, variationPeriode: 0, soldeGlobal: 0 })

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Soldes Fournisseurs</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest italic">Synthèse de nos dettes et paiements par fournisseur</p>
        </div>
        <button 
          onClick={handleDirectPrint}
          disabled={loading || filteredData.length === 0 || isPrinting}
          className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 disabled:opacity-50 no-print uppercase tracking-widest"
        >
          {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} 
          IMPRIMER
        </button>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500 p-2 text-white">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Achats (Période)</p>
              <p className="text-xl font-bold text-gray-900">{totals.achats.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500 p-2 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Payé (Période)</p>
              <p className="text-xl font-bold text-gray-900">{totals.paiements.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Variation Dette</p>
              <p className="text-xl font-bold text-gray-900">{totals.variationPeriode.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${totals.soldeGlobal > 0 ? 'border-red-100 bg-red-50/50' : 'border-blue-100 bg-blue-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 text-white ${totals.soldeGlobal > 0 ? 'bg-red-500' : 'bg-blue-500'}`}>
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wider ${totals.soldeGlobal > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                Dette Totale Net
              </p>
              <p className="text-xl font-bold text-gray-900">{totals.soldeGlobal.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col md:flex-row gap-3 no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-2 items-end bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700 flex items-center gap-2 h-[34px]">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="flex-1 flex items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code ou localisation..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-10 pr-4 mt-auto text-sm focus:border-purple-500 focus:outline-none shadow-sm transition-all h-[34px]"
            />
          </div>
        </div>
      </div>

      {isPrinting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md no-print">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-4 border-orange-500 transform scale-110">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-orange-500 mb-6" />
            <h3 className="text-2xl font-black text-gray-900 uppercase italic">Préparation Financière</h3>
            <p className="mt-2 text-gray-600 font-bold uppercase text-[11px] tracking-widest">
              Génération du rapport des soldes fournisseurs...
            </p>
          </div>
        </div>
      )}

      {/* ZONE D'IMPRESSION (Optimisée Landscape) */}
      <div className="hidden print:block bg-white w-full">
        {filteredData.length > 0 ? (
          paginateArray(filteredData, 15, 23).map((chunk, index, allChunks) => (
            <div key={index} className="page-break">
              <ListPrintWrapper
                title="ÉTAT SYNTHÉTIQUE DES SOLDES FOURNISSEURS"
                subtitle={`Point Financier au ${new Date().toLocaleDateString('fr-FR')}`}
                pageNumber={index + 1}
                totalPages={allChunks.length}
                enterprise={entreprise}
                layout="landscape"
                hideVisa={index < allChunks.length - 1}
              >
                <table className="w-full text-[14px] border-collapse border-2 border-black font-sans">
                  <thead>
                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                      <th className="border border-black px-2 py-3 text-center w-10">N°</th>
                      <th className="border border-black px-3 py-3 text-left">Nom du Fournisseur</th>
                      <th className="border border-black px-3 py-3 text-right">Dette Totale</th>
                      <th className="border border-black px-3 py-3 text-right">Payé</th>
                      <th className="border border-black px-3 py-3 text-right">Reste / Variation</th>
                      <th className="border border-black px-3 py-3 text-right font-black bg-gray-50 underline decoration-double">SOLDE NET GLOBAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((f, idx) => (
                      <tr key={idx} className="border-b border-black">
                        <td className="border border-black px-2 py-2 text-center font-bold">
                          {(index === 0 ? 0 : 15 + (index - 1) * 23) + idx + 1}
                        </td>
                        <td className="border border-black px-3 py-2">
                          <div className="font-black uppercase text-[13px]">{f.nom}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{f.code || 'SANS CODE'}</div>
                        </td>
                        <td className="border border-black px-3 py-2 text-right font-medium">{f.achats.toLocaleString()} F</td>
                        <td className="border border-black px-3 py-2 text-right font-bold text-emerald-800 italic">
                          {f.paiements.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-2 text-right font-bold text-orange-700">
                          {f.variationPeriode.toLocaleString()} F
                        </td>
                        <td className={`border border-black px-3 py-2 text-right font-black text-lg ${f.soldeGlobal > 0 ? 'text-red-900 bg-red-50/30' : 'text-emerald-800 bg-emerald-50/30'}`}>
                          {f.soldeGlobal.toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {index === allChunks.length - 1 && (
                    <tfoot>
                      <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-inner">
                        <td className="border border-black px-2 py-6 text-center bg-white">{filteredData.length}</td>
                        <td className="border border-black px-3 py-6 text-right tracking-widest bg-white">TOTAUX DES ENCOURS FOURNISSEURS :</td>
                        <td className="border border-black px-3 py-6 text-right tabular-nums bg-white shadow-inner">
                          {totals.achats.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-6 text-right tabular-nums bg-white shadow-inner">
                          {totals.paiements.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-6 text-right tabular-nums bg-white shadow-inner">
                          {totals.variationPeriode.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-6 text-right text-2xl tabular-nums bg-slate-900 text-white shadow-2xl">
                          {totals.soldeGlobal.toLocaleString()} F
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </ListPrintWrapper>
            </div>
          ))
        ) : (
          <div className="p-20 text-center font-black uppercase italic text-gray-400">
            Aucune donnée de solde disponible pour l'impression.
          </div>
        )}
      </div>
    </div>
  )
}
