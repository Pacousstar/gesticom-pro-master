'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Filter, ShoppingCart, User, Calendar, Tag, CreditCard, Warehouse, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface VenteListe {
  id: number
  numero: string
  date: string
  client: string
  montantTotal: number
  montantPaye: number
  statutPaiement: string
  modePaiement: string
  vendeur: string
  magasin: string
}

export default function ListeVentesPage() {
  const [data, setData] = useState<VenteListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')
  const { error: showError } = useToast()

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapports/ventes/liste?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        showError('Impossible de charger la liste des ventes.')
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
    fetchData(startDate, endDate)
  }

  const filteredData = data.filter(v => 
    v.numero.toLowerCase().includes(search.toLowerCase()) || 
    v.client.toLowerCase().includes(search.toLowerCase())
  )

  const caTotal = filteredData.reduce((acc, v) => acc + v.montantTotal, 0)
  const encaisseTotal = filteredData.reduce((acc, v) => acc + v.montantPaye, 0)
  const resteTotal = caTotal - encaisseTotal

  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Journal des Ventes</h1>
          <p className="text-sm text-white/90 font-medium">Liste exhaustive et consolidée de toutes les transactions</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-800 bg-slate-100 px-4 py-2 text-sm font-black text-slate-900 hover:bg-slate-200 shadow-lg transition-all active:scale-95 no-print uppercase"
          >
            <Printer className="h-4 w-4" /> 
            Aperçu Impression
          </button>
          <button 
            onClick={() => {/* Logique Excel */}}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm no-print"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 no-print">
        <div className="rounded-2xl bg-orange-600 p-6 text-white shadow-lg shadow-orange-100">
          <div className="flex items-center justify-between opacity-80 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest">C.A du Journal</span>
            <ShoppingCart className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black">{caTotal.toLocaleString('fr-FR')} F</p>
        </div>
        
        <div className="rounded-2xl bg-emerald-600 p-6 text-white shadow-lg shadow-emerald-100">
          <div className="flex items-center justify-between opacity-80 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest">Total Encaissé</span>
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black">{encaisseTotal.toLocaleString('fr-FR')} F</p>
        </div>

        <div className="rounded-2xl bg-gray-800 p-6 text-white shadow-lg shadow-gray-200">
          <div className="flex items-center justify-between opacity-80 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest">Reste à Recouvrer</span>
            <Tag className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black">{resteTotal.toLocaleString('fr-FR')} F</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end flex-1">
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <button type="submit" className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 flex items-center gap-2 h-[41px]">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher (N°, client)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-[9px] pl-10 pr-4 focus:border-orange-500 focus:outline-none shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic font-medium">Aucune vente enregistrée sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Référence / Date</th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Client / Magasin</th>
                  <th className="px-6 py-4 text-center text-xs font-black uppercase text-gray-500">Mode / Paiement</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Montant Total</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Payé / Reste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedData.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-gray-900">{v.numero}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> {new Date(v.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{v.client}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Warehouse className="h-3 w-3" /> {v.magasin}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 uppercase">
                          {v.modePaiement}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${v.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {v.statutPaiement}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-gray-900">
                      {v.montantTotal.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-600">{v.montantPaye.toLocaleString('fr-FR')} F</span>
                          <span className="text-[10px] text-red-500 font-bold">{(v.montantTotal - v.montantPaye).toLocaleString('fr-FR')} F</span>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center mt-6 no-print">
          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            itemsPerPage={itemsPerPage} 
            totalItems={filteredData.length} 
            onPageChange={setPage} 
          />
        </div>
      )}
      {/* Zone d'impression professionnelle standardisée */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: VenteListe[], index: number, allChunks: VenteListe[][]) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="Journal des Ventes"
              subtitle={`Rapport consolidé des transactions - Période du ${startDate} au ${endDate}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              hideHeader={index > 0}
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border-r-2 border-black px-3 py-3 text-left">Référence / Date</th>
                    <th className="border-r-2 border-black px-3 py-3 text-left">Client / Magasin</th>
                    <th className="border-r-2 border-black px-3 py-3 text-center">Paiement</th>
                    <th className="border-r-2 border-black px-3 py-3 text-right">Montant Total</th>
                    <th className="px-3 py-3 text-right">Montant Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((v: VenteListe, idx: number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r-2 border-black px-3 py-2">
                        <span className="font-bold">{v.numero}</span><br/>
                        <span className="italic text-xs text-gray-700">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 uppercase">
                         {v.client}<br/>
                         <span className="font-normal italic text-xs text-gray-600">{v.magasin}</span>
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 text-center text-xs uppercase font-bold">
                        {v.modePaiement} / {v.statutPaiement}
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 text-right font-black">
                         {v.montantTotal.toLocaleString('fr-FR')} F
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${v.statutPaiement === 'PAYE' ? 'text-emerald-700' : 'text-rose-700'}`}>
                         {v.montantPaye.toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black">
                      <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right uppercase italic">Totaux du Journal</td>
                      <td className="border-r-2 border-black px-3 py-4 text-right text-orange-700">
                         {caTotal.toLocaleString('fr-FR')} F
                      </td>
                      <td className="px-3 py-4 text-right text-emerald-700">
                         {encaisseTotal.toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION JOURNAL DES VENTES */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal des Ventes</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Consolidation des Transactions Commerciales
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-orange-600 italic">Période du {new Date(startDate).toLocaleDateString()}</span>
                   <span className="text-xs font-black text-orange-600 italic">au {new Date(endDate).toLocaleDateString()}</span>
                 </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase"
                >
                  Fermer
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"
                >
                  <Printer className="h-4 w-4" />
                  Lancer l'impression
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} min-h-screen p-4 text-slate-900 not-italic tracking-normal`}>
                  {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: VenteListe[], index: number, allChunks: VenteListe[][]) => (
                      <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                          <ListPrintWrapper
                              title="JOURNAL DES VENTES"
                              subtitle={`Rapport consolidé du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                              pageNumber={index + 1}
                              totalPages={allChunks.length}
                              hideHeader={index > 0}
                              hideVisa={index < allChunks.length - 1}
                          >
                              <table className="w-full text-[14px] border-collapse border-2 border-black">
                                  <thead>
                                      <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                          <th className="border-r-2 border-black px-3 py-3 text-left">Référence / Date</th>
                                          <th className="border-r-2 border-black px-3 py-3 text-left">Partenaire / Magasin</th>
                                          <th className="border-r-2 border-black px-3 py-3 text-center tabular-nums">Paiement</th>
                                          <th className="border-r-2 border-black px-3 py-3 text-right text-xs">C.A Total</th>
                                          <th className="px-3 py-3 text-right text-xs">Versé</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {chunk.map((v: VenteListe, idx: number) => (
                                          <tr key={idx} className="border-b border-black text-[13px]">
                                              <td className="border-r-2 border-black px-3 py-2">
                                                <span className="font-bold">{v.numero}</span><br/>
                                                <span className="text-[10px] font-medium text-gray-500 italic">{v.date}</span>
                                              </td>
                                              <td className="border-r-2 border-black px-3 py-2 font-black uppercase">{v.client}</td>
                                              <td className="border-r-2 border-black px-3 py-2 text-center font-bold text-[10px]">{v.modePaiement}</td>
                                              <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{v.montantTotal.toLocaleString()} F</td>
                                              <td className="px-3 py-2 text-right font-black text-emerald-600 tabular-nums">{v.montantPaye.toLocaleString()} F</td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  {index === allChunks.length - 1 && (
                                      <tfoot>
                                          <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                              <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right bg-white">VOLUME CHIFFRE D'AFFAIRES</td>
                                              <td className="border-r-2 border-black px-3 py-4 bg-white text-blue-900 underline underline-offset-4 decoration-double">{caTotal.toLocaleString()} F</td>
                                              <td className="px-3 py-4 bg-white text-emerald-700 underline underline-offset-4 decoration-double">{encaisseTotal.toLocaleString()} F</td>
                                          </tr>
                                      </tfoot>
                                  )}
                              </table>
                          </ListPrintWrapper>
                      </div>
                  ))}
              </div>
          </div>
        </div>
      )}

    </div>
  )
}
