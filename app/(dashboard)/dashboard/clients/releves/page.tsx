'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Users, Search, Calendar, FileText, Download, Printer, 
  ArrowLeft, Loader2, DollarSign, CreditCard, ChevronRight,
  TrendingDown, TrendingUp, Wallet
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import Pagination from '@/components/ui/Pagination'

type Client = {
  id: number
  nom: string
  code: string | null
  telephone: string | null
  dette: number
}

type Vente = {
  id: number
  numero: string
  date: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  statut: string
  statutPaiement: string
  lignes: Array<{
    designation: string
    quantite: number
    prixUnitaire: number
  }>
}

export default function ClientRelevesPage() {
  const searchParams = useSearchParams()
  const initialClientId = searchParams.get('id')
  const { error: showError } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '')
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date()
    d.setDate(1) // Premier du mois
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState<string>(new Date().toISOString().split('T')[0])
  
  const [data, setData] = useState<Vente[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const itemsPerPage = 20
  const ITEMS_PER_PAGE_REPORT = 18

  // Chargement des clients pour le selecteur
  useEffect(() => {
    fetch('/api/clients?limit=1000')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(res => {
        setClients(res.data || [])
        setLoadingClients(false)
      })
      .catch(() => setLoadingClients(false))
  }, [])

  const fetchReleve = async () => {
    if (!selectedClientId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: dateDebut,
        end: dateFin
      })
      const res = await fetch(`/api/rapports/ventes/clients/${selectedClientId}/history?${params.toString()}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        showError("Impossible de charger le relevé.")
      }
    } catch (e) {
      showError("Erreur réseau lors du chargement du relevé.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClientId) {
      setCurrentPage(1)
      fetchReleve()
    }
  }, [selectedClientId, dateDebut, dateFin])

  const selectedClient = clients.find(c => c.id === Number(selectedClientId))

  const totals = useMemo(() => {
    return data.reduce((acc, v) => {
      acc.du += v.montantTotal
      acc.paye += v.montantPaye
      return acc
    }, { du: 0, paye: 0 })
  }, [data])

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      setIsPreviewOpen(true)
      setIsPrinting(false)
    }, 500)
  }

  const paginatedData = useMemo(() => {
    return data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  }, [data, currentPage])

  const totalPages = Math.ceil(data.length / itemsPerPage)

  return (
    <div className="space-y-6">

      {/* Header & Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Relevés de Comptes</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Analyse détaillée de la dette client</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={!selectedClientId || data.length === 0 || isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50 no-print shadow-xl transition-all"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Aperçu Relevé
          </button>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="grid gap-4 sm:grid-cols-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 no-print">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Client</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nom} {c.code ? `(${c.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Date Début</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Date Fin</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          />
        </div>
      </div>

      {selectedClientId ? (
        <>
          {/* Compteurs Professionnels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><TrendingUp className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Facturé (Période)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totals.du.toLocaleString()} F</p>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-emerald-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><TrendingDown className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payé (Période)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totals.paye.toLocaleString()} F</p>
            </div>

            <div className={`bg-white rounded-[2rem] p-6 shadow-xl border-b-8 ${(totals.du - totals.paye) > 0 ? 'border-amber-500' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><CreditCard className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Période</span>
              </div>
              <p className={`text-3xl font-black tracking-tighter italic ${(totals.du - totals.paye) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {(totals.du - totals.paye).toLocaleString()} F
              </p>
            </div>

            <div className="bg-gray-900 rounded-[2rem] p-6 shadow-xl border-b-8 border-red-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><Wallet className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Global Client</span>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter italic">
                {(selectedClient?.dette || 0).toLocaleString()} F
              </p>
            </div>
          </div>

          {/* Tableau de transactions */}
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 no-print">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Détail des opérations
              </h3>
              <p className="text-[10px] text-gray-400 font-bold italic uppercase tracking-tighter">
                Du {formatDate(dateDebut)} au {formatDate(dateFin)}
              </p>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Génération du relevé en cours...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400 italic">Aucune transaction trouvée sur cette période.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Dû (Facturé)</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Réglé (Payé)</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Reste</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedData.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-700">{formatDate(v.date)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-gray-900 italic tracking-tight">{v.numero}</p>
                          <p className="text-[10px] text-gray-400 font-medium uppercase">{v.modePaiement}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-gray-900">{v.montantTotal.toLocaleString()} F</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-emerald-600">{v.montantPaye.toLocaleString()} F</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`text-sm font-black ${(v.montantTotal - v.montantPaye) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                            {(v.montantTotal - v.montantPaye).toLocaleString()} F
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${v.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                            {v.statutPaiement === 'PAYE' ? 'SÉCURISÉ' : 'À RECOUVRER'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-900 text-white">
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest opacity-60">Totaux Période :</td>
                      <td className="px-6 py-4 text-right font-black text-lg italic tracking-tighter">{totals.du.toLocaleString()} F</td>
                      <td className="px-6 py-4 text-right font-black text-lg text-emerald-400 italic tracking-tighter">{totals.paye.toLocaleString()} F</td>
                      <td className="px-6 py-4 text-right font-black text-lg text-red-400 italic tracking-tighter">{(totals.du - totals.paye).toLocaleString()} F</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={data.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] p-20 shadow-xl border border-white/20 flex flex-col items-center justify-center text-center no-print">
          <div className="p-8 bg-orange-50 rounded-full text-orange-500 mb-6 group-hover:scale-110 transition-transform">
            <Users className="h-16 w-16" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Aucun client sélectionné</h2>
        </div>
      )}

      {/* MODALE D'APERÇU IMPRESSION RELEVÉ CLIENT */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu du Relevé de Compte Client</h2>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest italic">{selectedClient?.nom}</p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-600 uppercase">
                 {data.length} Transactions
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
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-10 py-2 text-sm font-black text-white hover:bg-blue-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className="mx-auto max-w-[210mm] shadow-2xl">
               {(() => {
                  const chunks = [];
                  for (let i = 0; i < data.length; i += ITEMS_PER_PAGE_REPORT) {
                    chunks.push(data.slice(i, i + ITEMS_PER_PAGE_REPORT));
                  }
                  return chunks.map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break mb-8 border-b-2 border-dashed border-gray-100 pb-8' : ''}>
                      <ListPrintWrapper
                        title={`RELEVÉ DE COMPTE : ${selectedClient?.nom}`}
                        subtitle={`Transactions du ${formatDate(dateDebut)} au ${formatDate(dateFin)}`}
                        pageNumber={index + 1}
                        totalPages={allChunks.length}
                        hideHeader={index > 0} // Header seulement sur la page 1
                        hideVisa={index < allChunks.length - 1} // Visa seulement sur la dernière page
                      >
                         <table className="w-full text-[14px] border-collapse border-2 border-black">
                          <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-2 border-black">
                              <th className="border-2 border-black px-3 py-3 text-left">Date</th>
                              <th className="border-2 border-black px-3 py-3 text-left">Référence / Mode</th>
                              <th className="border-2 border-black px-3 py-3 text-right">Facturé (Dû)</th>
                              <th className="border-2 border-black px-3 py-3 text-right">Réglé (Payé)</th>
                              <th className="border-2 border-black px-3 py-3 text-right">Solde</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((v, idx) => (
                              <tr key={idx} className="border border-black">
                                <td className="border border-black px-3 py-2 whitespace-nowrap">{formatDate(v.date)}</td>
                                <td className="border border-black px-3 py-2 font-black">
                                   <div className="uppercase tracking-tight">{v.numero}</div>
                                   <div className="text-[10px] italic font-normal text-gray-500">{v.modePaiement}</div>
                                </td>
                                <td className="border border-black px-3 py-2 text-right font-black">
                                  {v.montantTotal.toLocaleString()} F
                                </td>
                                <td className="border border-black px-3 py-2 text-right font-black text-emerald-800 bg-emerald-50/20">
                                  {v.montantPaye.toLocaleString()} F
                                </td>
                                <td className="border border-black px-3 py-2 text-right font-black text-rose-800">
                                  {(v.montantTotal - v.montantPaye).toLocaleString()} F
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {index === allChunks.length - 1 && (
                            <tfoot>
                              <tr className="bg-gray-200 font-black text-[15px] border-2 border-black uppercase italic">
                                <td colSpan={2} className="border border-black px-3 py-5 text-right tracking-widest">SITUATION TOTALE</td>
                                <td className="border border-black px-3 py-5 text-right bg-white">{totals.du.toLocaleString()} F</td>
                                <td className="border border-black px-3 py-5 text-right bg-white text-emerald-800">{totals.paye.toLocaleString()} F</td>
                                <td className="border border-black px-3 py-5 text-right bg-white text-rose-800 underline decoration-double">{(totals.du - totals.paye).toLocaleString()} F</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                        {index === allChunks.length - 1 && (
                          <div className="mt-6 p-4 border-2 border-black bg-gray-50 rounded-lg">
                             <p className="text-[15px] font-black uppercase text-gray-900 italic">Solde de clôture global du client au {formatDate(dateFin)} :</p>
                             <p className="text-4xl font-black text-red-700 tracking-tighter mt-1">{(selectedClient?.dette || 0).toLocaleString()} FCFA</p>
                          </div>
                        )}
                      </ListPrintWrapper>
                    </div>
                  ));
               })()}
            </div>
          </div>
        </div>
      )}

      {/* Rendu Système (Impression Native) */}
      <div className="hidden print:block absolute inset-0 bg-white">
          {(() => {
                const chunks = [];
                for (let i = 0; i < data.length; i += ITEMS_PER_PAGE_REPORT) {
                  chunks.push(data.slice(i, i + ITEMS_PER_PAGE_REPORT));
                }
                return chunks.map((chunk, index, allChunks) => (
                  <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                    <ListPrintWrapper
                      title={`RELEVÉ DE COMPTE : ${selectedClient?.nom}`}
                      subtitle={`Audit des transactions du ${formatDate(dateDebut)} au ${formatDate(dateFin)}`}
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                       <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-3 py-3 text-left">Date</th>
                            <th className="border-r-2 border-black px-3 py-3 text-left italic">Référence / Mode</th>
                            <th className="border-r-2 border-black px-3 py-3 text-right">Facturé (Dû)</th>
                            <th className="border-r-2 border-black px-3 py-3 text-right">Réglé (Payé)</th>
                            <th className="px-3 py-3 text-right">Solde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((v, idx) => (
                            <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors shadow-sm">
                              <td className="border-r-2 border-black px-3 py-2 font-medium italic text-slate-800">{formatDate(v.date)}</td>
                              <td className="border-r-2 border-black px-3 py-2 font-black uppercase text-[12px] italic text-orange-700 tracking-tighter">
                                {v.numero}
                                <div className="text-[9px] font-bold text-gray-400 not-italic tracking-widest">{v.modePaiement}</div>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{v.montantTotal.toLocaleString()} F</td>
                              <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums text-emerald-800 bg-emerald-50/10 shadow-inner">{v.montantPaye.toLocaleString()} F</td>
                              <td className="px-3 py-2 text-right font-black tabular-nums text-rose-800 underline decoration-double underline-offset-2 italic">{(v.montantTotal - v.montantPaye).toLocaleString()} F</td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                              <td colSpan={2} className="px-3 py-6 text-right tracking-[0.2em] underline decoration-slate-400">ARRÊTÉ DU RELEVÉ AU {formatDate(dateFin)}</td>
                              <td className="border-r-2 border-black px-3 py-6 text-right bg-white ring-2 ring-black font-mono shadow-inner">{totals.du.toLocaleString()} F</td>
                              <td className="border-r-2 border-black px-3 py-6 text-right bg-white text-emerald-800 font-mono shadow-inner">{totals.paye.toLocaleString()} F</td>
                              <td className="px-3 py-6 text-right bg-slate-900 text-white font-mono shadow-2xl">{(totals.du - totals.paye).toLocaleString()} F</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </ListPrintWrapper>
                  </div>
                ));
          })()}
      </div>
    </div>
  )
}
