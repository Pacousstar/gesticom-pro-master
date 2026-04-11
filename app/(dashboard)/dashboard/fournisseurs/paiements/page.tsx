'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Loader2, Calendar, User, CreditCard, Hash, Coins, Download, Filter, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface PaiementFournisseur {
  id: number
  date: string
  fournisseurCode: string | null
  fournisseurNom: string
  modePaiement: string
  achatNumero: string
  montant: number
  observation: string | null
}

export default function PaiementsFournisseursPage() {
  const [data, setData] = useState<PaiementFournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const ITEMS_PER_PAGE_REPORT = 18
  const { error: showError } = useToast()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrintingData, setIsPrintingData] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)

  useEffect(() => {
    const now = new Date()
    // Par défaut, derniers 30 jours (au lieu du calendrier fixe) pour assurer la visibilité le 1er du mois
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)
    
    const start = thirtyDaysAgo.toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fournisseurs/paiements?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      } else {
        showError('Impossible de charger les paiements.')
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

  const handleOpenPreview = async () => {
    setIsPrintingData(true)
    try {
      setIsPreviewOpen(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPrintingData(false)
    }
  }

  const filteredData = Array.isArray(data) ? data.filter(p => 
    (p.fournisseurNom || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.achatNumero || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.fournisseurCode && p.fournisseurCode.toLowerCase().includes(search.toLowerCase()))
  ) : []

  const total = filteredData.reduce((acc, p) => acc + p.montant, 0)
  
  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)
  
  const totalsByMode = useMemo(() => {
    const modes: Record<string, number> = {}
    filteredData.forEach(p => {
      modes[p.modePaiement] = (modes[p.modePaiement] || 0) + p.montant
    })
    return modes
  }, [filteredData])

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Décaissements Fournisseurs</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest italic">Historique des paiements effectués par période</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (startDate) params.set('dateDebut', startDate)
              if (endDate) params.set('dateFin', endDate)
              window.location.href = `/api/fournisseurs/paiements/export-excel?${params.toString()}`
            }}
            disabled={loading || filteredData.length === 0}
            className="flex items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
          >
            <Download className="h-5 w-5" />
            Excel
          </button>
          <button 
            onClick={handleOpenPreview}
            disabled={isPrintingData || filteredData.length === 0}
            className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
          >
            {isPrintingData ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} 
            Aperçu Journal
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
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

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher (fournisseur, réf)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-purple-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Résumé par mode de paiement */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 no-print">
        <div className="rounded-lg bg-purple-100 px-4 py-3 border border-purple-200 md:col-span-2 shadow-sm">
          <p className="text-sm text-purple-800 font-bold uppercase">Total Décaissé (Période)</p>
          <p className="text-2xl font-black text-purple-900">{total.toLocaleString('fr-FR')} F</p>
        </div>
        {Object.entries(totalsByMode).map(([mode, sum]) => (
          <div key={mode} className="rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase truncate">{mode}</p>
            <p className="text-lg font-bold text-gray-900">{sum.toLocaleString('fr-FR')} F</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic">Aucun paiement fournisseur sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Date</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><User className="h-3 w-3" /> Fournisseur</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> Mode</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><Hash className="h-3 w-3" /> Réf. Achat</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2 justify-end"><Coins className="h-3 w-3" /> Montant</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedData.map((p: PaiementFournisseur) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {new Date(p.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{p.fournisseurNom}</span>
                        <span className="text-xs text-gray-400 uppercase">{p.fournisseurCode || '—'}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {p.modePaiement}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                      {p.achatNumero}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-gray-900">
                      {p.montant.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* MODALE D'APERÇU IMPRESSION PAIEMENTS */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu du Journal des Paiements</h2>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">Période du {new Date(startDate).toLocaleDateString()} au {new Date(endDate).toLocaleDateString()}</p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                 {filteredData.length} OPÉRATIONS
               </span>
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
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen">
               {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: PaiementFournisseur[], index: number, allChunks: PaiementFournisseur[][]) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break border-b-2 border-dashed border-gray-100 mb-8 pb-8' : ''}>
                       <ListPrintWrapper
                        title="Journal des Paiements Fournisseurs"
                        subtitle={`Transactions du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                        pageNumber={index + 1}
                        totalPages={allChunks.length}
                        hideHeader={index > 0} // Header seulement sur la page 1
                        hideVisa={index < allChunks.length - 1} // Visa seulement sur la dernière page
                      >
                         <table className="w-full text-[14px] border-collapse border-2 border-black">
                          <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-2 border-black">
                              <th className="border-2 border-black px-3 py-3 text-left">Date / Réf.</th>
                              <th className="border-2 border-black px-3 py-3 text-left">Fournisseur</th>
                              <th className="border-2 border-black px-3 py-3 text-center">Mode</th>
                              <th className="border-2 border-black px-3 py-3 text-right">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((p: PaiementFournisseur, idx: number) => (
                              <tr key={idx} className="border border-black">
                                <td className="border border-black px-3 py-2">
                                   <div className="font-bold">{new Date(p.date).toLocaleDateString('fr-FR')}</div>
                                   <div className="text-[10px] font-mono text-gray-500">{p.achatNumero}</div>
                                </td>
                                <td className="border border-black px-3 py-2 font-black uppercase tracking-tight">
                                  {p.fournisseurNom}
                                </td>
                                <td className="border border-black px-3 py-2 text-center text-[12px] uppercase font-bold italic">
                                  {p.modePaiement}
                                </td>
                                <td className="border border-black px-3 py-2 text-right font-black text-[15px]">
                                  {p.montant.toLocaleString()} F
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {index === allChunks.length - 1 && (
                            <tfoot>
                              <tr className="bg-gray-200 font-black text-[16px] border-2 border-black uppercase italic">
                                <td colSpan={3} className="border border-black px-3 py-5 text-right tracking-[0.2em]">TOTAL GÉNÉRAL DÉCAISSÉ</td>
                                <td className="border border-black px-3 py-5 text-right bg-white underline decoration-double shadow-inner">{total.toLocaleString()} F</td>
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

      {/* Rendu Système (Impression Native) */}
      <div className="hidden print:block absolute inset-0 bg-white">
          {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk: PaiementFournisseur[], index: number, allChunks: PaiementFournisseur[][]) => (
                  <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                    <ListPrintWrapper
                      title="Journal des Paiements Fournisseurs"
                      subtitle={`Synthèse du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                       <table className="w-full text-[14px] border-collapse border-2 border-black">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900">
                            <th className="border-2 border-black px-3 py-3 text-left">Date</th>
                            <th className="border-2 border-black px-3 py-3 text-left">Fournisseur</th>
                            <th className="border-2 border-black px-3 py-3 text-center">Mode</th>
                            <th className="border-2 border-black px-3 py-3 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((p: PaiementFournisseur, idx: number) => (
                            <tr key={idx} className="border border-black">
                              <td className="border border-black px-3 py-2 font-bold">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                              <td className="border border-black px-3 py-2 font-black uppercase text-[12px]">{p.fournisseurNom}</td>
                              <td className="border border-black px-3 py-2 text-center italic">{p.modePaiement}</td>
                              <td className="border border-black px-3 py-2 text-right font-black">{p.montant.toLocaleString()} F</td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-100 font-black text-[15px] border-t-2 border-black uppercase italic">
                              <td colSpan={3} className="border-2 border-black px-3 py-4 text-right">TOTAL GÉNÉRAL</td>
                              <td className="border-2 border-black px-3 py-4 text-right bg-white">{total.toLocaleString()} F</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </ListPrintWrapper>
                  </div>
                ))}
      </div>
    </div>
  )
}
