'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Filter, ShoppingBag, Truck, Calendar, CreditCard, Warehouse, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface AchatListe {
  id: number
  numero: string
  date: string
  fournisseur: string
  montantTotal: number
  montantPaye: number
  statutPaiement: string
  modePaiement: string
  acheteur: string
  magasin: string
}

export default function ListeAchatsPage() {
  const [data, setData] = useState<AchatListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
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
      const res = await fetch(`/api/rapports/achats/liste?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        showError('Impossible de charger la liste des achats.')
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

  const filteredData = data.filter(a => 
    a.numero.toLowerCase().includes(search.toLowerCase()) || 
    a.fournisseur.toLowerCase().includes(search.toLowerCase())
  )

  const totalAchats = filteredData.reduce((acc, a) => acc + a.montantTotal, 0)
  const totalPaye = filteredData.reduce((acc, a) => acc + a.montantPaye, 0)
  const totalReste = totalAchats - totalPaye

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Journal des Achats</h1>
          <p className="text-sm text-white/90 font-medium">Récapitulatif de tous les approvisionnements et règlements fournisseurs</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsPreviewOpen(true)}
            disabled={loading || filteredData.length === 0}
            className="flex items-center gap-2 rounded-lg border-2 border-slate-800 bg-white px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-50 shadow-xl transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            <Printer className="h-4 w-4" /> 
            Aperçu Impression
          </button>
        </div>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 no-print">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Achats du Journal</span>
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-indigo-900">{totalAchats.toLocaleString('fr-FR')} F</p>
        </div>
        
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Règlements Effectués</span>
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-emerald-900">{totalPaye.toLocaleString('fr-FR')} F</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Reste à Payer</span>
            <Filter className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-rose-900">{totalReste.toLocaleString('fr-FR')} F</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end flex-1">
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 underline decoration-indigo-200">Date Début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 underline decoration-indigo-200">Date Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 h-[41px]">
            <Filter className="h-4 w-4" /> Filtrer Achats
          </button>
        </form>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Référence ou Fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-[9px] pl-10 pr-4 focus:border-indigo-500 focus:outline-none shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic font-medium underline decoration-indigo-50">Aucun achat enregistré sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Référence / Date</th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Fournisseur / Magasin</th>
                  <th className="px-6 py-4 text-center text-xs font-black uppercase text-gray-500">Paiement</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Total Achat</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Réglé / Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredData.map((a) => (
                  <tr key={a.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-gray-900 group-hover:text-indigo-600">{a.numero}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> {new Date(a.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{a.fournisseur}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Warehouse className="h-3 w-3" /> {a.magasin}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                          {a.modePaiement}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${a.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {a.statutPaiement}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-indigo-900 bg-indigo-50/10">
                      {a.montantTotal.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-600">{a.montantPaye.toLocaleString('fr-FR')} F</span>
                          <span className={`text-[10px] font-bold ${a.montantTotal - a.montantPaye > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                            {(a.montantTotal - a.montantPaye).toLocaleString('fr-FR')} F
                          </span>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Rendu Système (Impression Native) */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="Journal des Achats"
              subtitle={`Rapport des approvisionnements - Période du ${startDate} au ${endDate}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              hideHeader={index > 0}
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border-r-2 border-black px-3 py-3 text-left">Référence / Date</th>
                    <th className="border-r-2 border-black px-3 py-3 text-left">Fournisseur / Magasin</th>
                    <th className="border-r-2 border-black px-3 py-3 text-center text-xs">Paiement</th>
                    <th className="border-r-2 border-black px-3 py-3 text-right">Montant Total</th>
                    <th className="px-3 py-3 text-right">Montant Réglé</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((a, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r-2 border-black px-3 py-2 font-medium italic">
                        <span className="font-black text-slate-800 tracking-tighter">{a.numero}</span><br/>
                        <span className="text-xs font-bold text-gray-500 opacity-60">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 uppercase font-black italic tracking-tighter">
                         {a.fournisseur}<br/>
                         <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{a.magasin}</div>
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 text-center text-[12px] font-bold">
                        <div className="text-[10px] font-black underline decoration-double text-indigo-700">{a.modePaiement}</div>
                        <span className={`text-[11px] font-black ${a.statutPaiement === 'PAYE' ? 'text-emerald-700' : 'text-rose-700'}`}>{a.statutPaiement}</span>
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 text-right font-black shadow-inner bg-gray-50/50 tabular-nums italic">
                         {a.montantTotal.toLocaleString()} F
                      </td>
                      <td className="px-3 py-2 text-right font-black tabular-nums text-emerald-800">
                         {a.montantPaye.toLocaleString()} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                        <td colSpan={3} className="px-3 py-5 text-right tracking-[0.2em] underline decoration-double underline-offset-4">TOTAL CUMULÉ DES APPROVISIONNEMENTS</td>
                        <td className="px-3 py-5 text-right bg-white ring-2 ring-black font-mono text-indigo-800">
                           {totalAchats.toLocaleString()} F
                        </td>
                        <td className="px-3 py-5 text-right bg-white shadow-inner font-mono text-emerald-800">
                           {totalPaye.toLocaleString()} F
                        </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION JOURNAL ACHATS */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter shadow-2xl">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal Achats</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Analyse des Approvisionnements et Règlements
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-indigo-600 italic uppercase">Période du {startDate}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic leading-none">Au {endDate}</span>
                 </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
                >
                  Fermer
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-10 py-2 text-sm font-black text-white hover:bg-indigo-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer le journal
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                  <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                    <ListPrintWrapper
                      title="JOURNAL DÉTAILLÉ DES ACHATS"
                      subtitle="Audit consolidé des flux fournisseurs et règlements"
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                      <table className="w-full text-[14px] border-collapse border-4 border-black font-sans shadow-2xl">
                        <thead>
                          <tr className="bg-black text-white uppercase font-black border-2 border-black">
                            <th className="border-r-2 border-white px-4 py-4 text-left">Référence / Date</th>
                            <th className="border-r-2 border-white px-4 py-4 text-left italic">Fournisseur & Magasin</th>
                            <th className="border-r-2 border-white px-4 py-4 text-right tabular-nums tracking-tighter">Engagement Brut</th>
                            <th className="px-4 py-4 text-left text-[11px] bg-slate-800 tracking-widest">Règlement / Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((a, idx) => (
                            <tr key={idx} className="border-b-2 border-black hover:bg-indigo-50/30 transition-colors">
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black text-slate-800 tracking-tighter">{a.numero}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 italic">{new Date(a.date).toLocaleDateString()}</div>
                              </td>
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black uppercase leading-tight italic text-slate-700 tracking-tighter text-[13px]">{a.fournisseur}</div>
                                <div className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5 flex items-center gap-1 opacity-60"><Warehouse className="h-2 w-2" /> {a.magasin}</div>
                              </td>
                              <td className="border-r-2 border-black px-4 py-3 text-right font-black tabular-nums text-lg text-indigo-900 bg-gray-50/50 underline decoration-double decoration-indigo-200 shadow-inner italic leading-none">{a.montantTotal.toLocaleString()} F</td>
                              <td className="px-4 py-3">
                                <div className="text-[10px] font-black uppercase text-emerald-600 tracking-widest truncate">{a.montantPaye.toLocaleString()} F</div>
                                <div className={`text-[9px] font-bold uppercase mt-0.5 tracking-[0.1em] ${a.statutPaiement === 'PAYE' ? 'text-emerald-500' : 'text-rose-500 opacity-60'}`}>{a.statutPaiement}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-black text-white font-black text-[18px] border-t-4 border-black uppercase italic shadow-2xl">
                                <td colSpan={2} className="px-4 py-8 text-right tracking-[0.3em] underline decoration-indigo-400 decoration-4 underline-offset-8">VOLUME TOTAL ACHATS PÉRIODE</td>
                                <td className="px-4 py-8 text-right text-3xl tabular-nums bg-indigo-950 border-x-4 border-white shadow-inner font-mono ring-4 ring-indigo-900 leading-none">
                                  {totalAchats.toLocaleString()} F
                                </td>
                                <td className="bg-indigo-950"></td>
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
