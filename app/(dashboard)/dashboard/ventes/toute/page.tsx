'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Loader2, 
  Download, 
  Filter, 
  ShoppingCart, 
  Calendar, 
  Tag, 
  CreditCard, 
  Warehouse, 
  TrendingUp, 
  ArrowUp, 
  Printer, 
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  ChevronRight
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ModificationVenteModal from '@/components/dashboard/ventes/ModificationVenteModal'
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
  produits: string
}

export default function ToutesLesVentesPage() {
  const [data, setData] = useState<VenteListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { error: showError } = useToast()
  const [statutPaiement, setStatutPaiement] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrintingData, setIsPrintingData] = useState(false)
  const [allVentesForPrint, setAllVentesForPrint] = useState<VenteListe[]>([])
  const [printType, setPrintType] = useState<'GLOBAL' | 'DETAIL' | null>(null)
  const [editingVenteId, setEditingVenteId] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [entreprise, setEntreprise] = useState<any>(null)
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')
  
  const ITEMS_PER_PAGE_REPORT = 18

  useEffect(() => {
    const now = new Date()
    // Par défaut, on remonte 30 jours en arrière au lieu du 1er du mois (pour que les données de fin de mois soient visibles le 1er du mois suivant)
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

  const handleSupprimer = async (id: number, numero: string) => {
    if (!confirm(`Supprimer définitivement la vente ${numero} ? Cette action est irréversible et annulera les stocks et la comptabilité liée.`)) return
    setSupprimant(id)
    try {
      const res = await fetch(`/api/ventes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showError('Vente supprimée avec succès.') // Toast success masquerade as error for simplicity of existing hook? No, I'll check toast hook.
        // Actually the existing page uses error: showError from useToast().
        fetchData(startDate, endDate)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la suppression.')
      }
    } catch (err) {
      showError('Erreur de connexion.')
    } finally {
      setSupprimant(null)
    }
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(startDate, endDate)
  }

  const handleOpenPreview = async (type: 'GLOBAL' | 'DETAIL') => {
    setIsPrintingData(true)
    setPrintType(type)
    try {
      // On utilise les données filtrées actuelles ou on peut refetch si besoin
      // Ici on utilise filteredData qui est déjà chargé
      setAllVentesForPrint(filteredData)
      setIsPreviewOpen(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsPrintingData(false)
    }
  }

  const filteredData = data.filter(v => 

    v.numero.toLowerCase().includes(search.toLowerCase()) || 
    v.client.toLowerCase().includes(search.toLowerCase()) ||
    v.produits.toLowerCase().includes(search.toLowerCase())
  )

  // Statistiques
  const now = new Date().toISOString().split('T')[0]
  const todaySales = data.filter(v => v.date.split('T')[0] === now)
  const caDay = todaySales.reduce((acc, v) => acc + v.montantTotal, 0)
  const nbSalesDay = todaySales.length
  
  const caMonth = data.reduce((acc, v) => acc + v.montantTotal, 0)
  const nbSalesMonth = data.length
  const encaisseMonth = data.reduce((acc, v) => acc + v.montantPaye, 0)

  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const formatFcfa = (val: number) => val.toLocaleString('fr-FR') + ' F'

  return (
    <div className="pb-12">
      {/* VUE ÉCRAN (Masquée à l'impression) */}
      <div className="print:hidden space-y-6">
        {/* HEADER ORANGE PREMIUM */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-500 to-orange-700 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Toutes les Ventes</h1>
              <p className="mt-2 text-white/90 font-medium max-w-2xl">
                Console analytique globale. Suivez vos performances en temps réel.
              </p>
            </div>
            <div className="flex gap-3 no-print">
               <button 
                onClick={() => handleOpenPreview('GLOBAL')}
                className="flex items-center gap-2 rounded-xl bg-orange-600 border-2 border-orange-400 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
                disabled={isPrintingData}
              >
                {isPrintingData && printType === 'GLOBAL' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                IMPRIMER JOURNAL
              </button>
              <button 
                onClick={() => {
                  let url = `/api/ventes/export?dateDebut=${startDate}&dateFin=${endDate}`
                  if (search) url += `&search=${encodeURIComponent(search)}`
                  window.open(url, '_blank')
                }}
                className="flex items-center gap-2 rounded-xl bg-white border-2 border-slate-200 px-6 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all uppercase tracking-widest shadow-xl active:scale-95"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                EXPORTER EXCEL
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MODALE D'APERÇU IMPRESSION */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic">Aperçu du Rapport des Ventes</h2>
                 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                   Mode : {printType === 'GLOBAL' ? 'Journal Simplifié' : 'Journal Détaillé'}
                 </p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                 {allVentesForPrint.length} OPÉRATIONS
               </span>
               <div className="h-10 w-px bg-gray-200" />
               <div className="flex items-center gap-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase">Orientation :</label>
                 <select 
                   value={printLayout}
                   onChange={(e) => setPrintLayout(e.target.value as any)}
                   className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-orange-500"
                 >
                   <option value="portrait">Portrait</option>
                   <option value="landscape">Paysage</option>
                 </select>
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
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className={`mx-auto ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} bg-white shadow-2xl min-h-screen`}>
               {chunkArray(allVentesForPrint, ITEMS_PER_PAGE_REPORT).map((chunk, index, allChunks) => (
                <div key={index} className={index < allChunks.length - 1 ? 'page-break border-b-2 border-dashed border-gray-100 mb-8 pb-8' : ''}>
                   <ListPrintWrapper
                    title={printType === 'GLOBAL' ? "Journal Global des Ventes" : "Journal Détaillé des Ventes"}
                    subtitle={`Rapport extrait du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                    pageNumber={index + 1}
                    totalPages={allChunks.length}
                    hideHeader={index > 0} // Header seulement sur la page 1
                    hideVisa={index < allChunks.length - 1} // Visa seulement sur la dernière page
                    layout={printLayout}
                  >
                    {printType === 'GLOBAL' ? (
                      <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-3 py-3 text-left">Réf / Date</th>
                            <th className="border-r-2 border-black px-3 py-3 text-left">Client / Magasin</th>
                            <th className="border-r-2 border-black px-3 py-3 text-center">Paiement</th>
                            <th className="border-r-2 border-black px-3 py-3 text-right">Montant Total</th>
                            <th className="px-3 py-3 text-right">Encaissé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((v) => (
                            <tr key={v.id} className="border-b border-black">
                              <td className="border-r-2 border-black px-3 py-2">
                                <span className="font-black text-slate-800">{v.numero}</span><br/>
                                <span className="text-xs italic font-bold text-gray-500">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 font-black uppercase italic">
                                {v.client}<br/>
                                <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{v.magasin}</div>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 text-center text-[14px] uppercase font-bold">
                                <div className="text-[10px] font-black text-blue-800">{v.modePaiement}</div>
                                <span className={`text-[11px] font-black underline decoration-double ${v.statutPaiement === 'PAYE' ? 'text-emerald-700' : 'text-rose-700'}`}>{v.statutPaiement}</span>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 text-right font-black shadow-inner bg-gray-50/50">
                                {v.montantTotal.toLocaleString()} F
                              </td>
                              <td className="px-3 py-2 text-right font-black text-emerald-800 tabular-nums">
                                {v.montantPaye.toLocaleString()} F
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                <td colSpan={3} className="px-3 py-5 text-right tracking-[0.2em] underline decoration-double">AUDIT VOLUME NET PÉRIODE</td>
                                <td className="px-3 py-5 text-right bg-white ring-2 ring-black font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString()} F
                                </td>
                                <td className="px-3 py-5 text-right text-emerald-800 bg-white shadow-inner font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantPaye, 0).toLocaleString()} F
                                </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    ) : (
                      <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-2 py-3 text-left">Référence / Date</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left w-1/4">Client / Magasin</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left w-1/3">Produits & Quantités</th>
                            <th className="px-2 py-3 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((v) => (
                            <tr key={v.id} className="border-b border-black">
                              <td className="border-r-2 border-black px-2 py-2">
                                <span className="font-black text-slate-800">{v.numero}</span><br/>
                                <span className="text-xs italic font-bold text-gray-500">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                              </td>
                              <td className="border-r-2 border-black px-2 py-2 font-black uppercase italic">
                                {v.client}<br/>
                                <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{v.magasin}</div>
                              </td>
                              <td className="border-r-2 border-black px-2 py-2 text-[14px] whitespace-pre-wrap leading-tight italic font-medium">
                                {v.produits || '-'}
                              </td>
                              <td className="px-2 py-2 text-right font-black text-[15px] bg-gray-50/50 shadow-inner tabular-nums">
                                {v.montantTotal.toLocaleString()} F
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                <td colSpan={3} className="px-2 py-5 text-right tracking-[0.3em] underline decoration-double">CHIFFRE D'AFFAIRES CUMULÉ ANALYTIQUE</td>
                                <td className="px-2 py-5 text-right bg-white text-[18px] ring-2 ring-black font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString()} F
                                </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    )}
                  </ListPrintWrapper>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ZONE D'IMPRESSION SYSTÈME (HIDDEN SCREEN) */}
      <div className="hidden print:block absolute inset-0 bg-white">
          {chunkArray(allVentesForPrint, ITEMS_PER_PAGE_REPORT).map((chunk, index, allChunks) => (
            <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
               <ListPrintWrapper
                title={printType === 'GLOBAL' ? "Journal Global des Ventes" : "Journal Détaillé des Ventes"}
                subtitle={`Rapport extrait du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                pageNumber={index + 1}
                totalPages={allChunks.length}
                hideHeader={index > 0}
                hideVisa={index < allChunks.length - 1}
                layout={printLayout}
              >
                  {printType === 'GLOBAL' ? (
                      <table className="w-full text-[14px] border-collapse border-2 border-black">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-3 py-3 text-left">Réf / Date</th>
                            <th className="border-r-2 border-black px-3 py-3 text-left">Client / Magasin</th>
                            <th className="border-r-2 border-black px-3 py-3 text-center">Paiement</th>
                            <th className="border-r-2 border-black px-3 py-3 text-right">Montant Total</th>
                            <th className="px-3 py-3 text-right">Encaissé</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((v) => (
                            <tr key={v.id} className="border-b border-black">
                              <td className="border-r-2 border-black px-3 py-2">
                                <span className="font-black text-slate-800">{v.numero}</span><br/>
                                <span className="text-xs italic font-bold text-gray-500">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 font-black uppercase italic">
                                {v.client}<br/>
                                <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{v.magasin}</div>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 text-center text-[14px] uppercase font-bold">
                                <div className="text-[10px] font-black text-blue-800">{v.modePaiement}</div>
                                <span className={`text-[11px] font-black underline decoration-double ${v.statutPaiement === 'PAYE' ? 'text-emerald-700' : 'text-rose-700'}`}>{v.statutPaiement}</span>
                              </td>
                              <td className="border-r-2 border-black px-3 py-2 text-right font-black shadow-inner bg-gray-50/50">
                                {v.montantTotal.toLocaleString()} F
                              </td>
                              <td className="px-3 py-2 text-right font-black text-emerald-800 tabular-nums">
                                {v.montantPaye.toLocaleString()} F
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                <td colSpan={3} className="px-3 py-5 text-right tracking-[0.2em] underline decoration-double">AUDIT VOLUME NET PÉRIODE</td>
                                <td className="px-3 py-5 text-right bg-white ring-2 ring-black font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString()} F
                                </td>
                                <td className="px-3 py-5 text-right text-emerald-800 bg-white shadow-inner font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantPaye, 0).toLocaleString()} F
                                </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    ) : (
                      <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-2 py-3 text-left">Référence / Date</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left w-1/4">Client / Magasin</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left w-1/3">Produits & Quantités</th>
                            <th className="px-2 py-3 text-right">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((v) => (
                            <tr key={v.id} className="border-b border-black">
                              <td className="border-r-2 border-black px-2 py-2">
                                <span className="font-black text-slate-800">{v.numero}</span><br/>
                                <span className="text-xs italic font-bold text-gray-500">{new Date(v.date).toLocaleDateString('fr-FR')}</span>
                              </td>
                              <td className="border-r-2 border-black px-2 py-2 font-black uppercase italic">
                                {v.client}<br/>
                                <div className="font-bold text-[10px] text-gray-400 truncate max-w-[150px]">{v.magasin}</div>
                              </td>
                              <td className="border-r-2 border-black px-2 py-2 text-[14px] whitespace-pre-wrap leading-tight italic font-medium">
                                {v.produits || '-'}
                              </td>
                              <td className="px-2 py-2 text-right font-black text-[15px] bg-gray-50/50 shadow-inner tabular-nums">
                                {v.montantTotal.toLocaleString()} F
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                <td colSpan={3} className="px-2 py-5 text-right tracking-[0.3em] underline decoration-double">CHIFFRE D'AFFAIRES CUMULÉ ANALYTIQUE</td>
                                <td className="px-2 py-5 text-right bg-white text-[18px] ring-2 ring-black font-mono">
                                  {allVentesForPrint.reduce((acc, v) => acc + v.montantTotal, 0).toLocaleString()} F
                                </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    )}
              </ListPrintWrapper>
            </div>
          ))}
      </div>

      {/* COMPTEURS DE PERFORMANCE (Analyse de Compteur) */}
      <div className="space-y-2 print:hidden">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] ml-6">Analyse de Compteur : 1 / 4</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "C.A AUJOURD'HUI", val: formatFcfa(caDay), sub: `${nbSalesDay} ventes`, icon: TrendingUp, color: "bg-emerald-500" },
            { label: "C.A DU MOIS", val: formatFcfa(caMonth), sub: `${nbSalesMonth} ventes`, icon: ShoppingCart, color: "bg-orange-600" },
            { label: "TOTAL ENCAISSÉ", val: formatFcfa(encaisseMonth), sub: "Règlements reçus", icon: CheckCircle2, color: "bg-blue-600" },
            { label: "NOMBRE DE VENTES", val: String(nbSalesMonth), sub: "Volume du mois", icon: Tag, color: "bg-indigo-600" },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl hover:scale-[1.02] transition-transform group`}>
               <div className="relative z-10 text-white flex flex-col justify-between h-full">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                  </div>
               </div>
               <c.icon className="absolute right-4 bottom-4 h-12 w-12 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>
      </div>


      {/* FILTRES & RECHERCHE */}
      <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4 flex-1">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
          <button type="submit" className="rounded-xl bg-gray-900 px-8 py-2.5 text-sm font-black text-white hover:bg-black transition-all shadow-lg uppercase tracking-widest flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Référence, client, produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* JOURNAL DES VENTES */}
      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
        <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-500" />
              Journal détaillé des transactions
            </h2>
            <div className="flex gap-2">
               <span className="bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {filteredData.length} Opérations
               </span>
            </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            <p className="text-xs font-black uppercase tracking-widest italic text-gray-500">Chargement des données...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
             <ShoppingCart className="h-16 w-16" />
             <p className="text-sm font-black uppercase tracking-widest italic">Aucun mouvement trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                  <th className="px-8 py-5">Référence / Date</th>
                  <th className="px-8 py-5">Client / Magasin</th>
                  <th className="px-8 py-5 text-center">Règlement</th>
                  <th className="px-8 py-5 text-right">C.A Total</th>
                  <th className="px-8 py-5 text-right">Encaissé</th>
                  <th className="px-8 py-5 text-right">Dette</th>
                  <th className="px-8 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((v) => (
                  <tr key={v.id} className="group hover:bg-orange-50/30 transition-colors">
                    <td className="px-8 py-6">
                       <p className="font-mono text-xs font-black text-orange-600">{v.numero}</p>
                       <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                          {new Date(v.date).toLocaleDateString('fr-FR', {day: '2-digit', month: 'long', year: 'numeric'})}
                       </p>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">{v.client}</p>
                       <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5 uppercase">
                          <Warehouse className="h-3 w-3" /> {v.magasin}
                       </p>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-col items-center gap-2">
                          <span className="bg-gray-100 px-3 py-1 rounded-lg text-[9px] font-black text-gray-600 uppercase tracking-widest">
                             {v.modePaiement}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${v.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                             {v.statutPaiement}
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <p className="text-sm font-black text-gray-900 tracking-tighter">{formatFcfa(v.montantTotal)}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <p className="text-sm font-black text-emerald-600 tracking-tighter">{formatFcfa(v.montantPaye)}</p>
                    </td>
                      <td className="px-8 py-6 text-right">
                        <p className={`text-sm font-black tracking-tighter ${v.montantTotal - v.montantPaye > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                           {formatFcfa(v.montantTotal - v.montantPaye)}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingVenteId(v.id)}
                            className="rounded-xl border border-gray-200 bg-white p-2.5 text-orange-600 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleSupprimer(v.id, v.numero)}
                            disabled={supprimant === v.id}
                            className="rounded-xl border border-gray-200 bg-white p-2.5 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                            title="Supprimer"
                          >
                            {supprimant === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100">
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
      <ModificationVenteModal
        isOpen={editingVenteId !== null}
        onClose={() => setEditingVenteId(null)}
        venteId={editingVenteId || 0}
        onSuccess={() => fetchData(startDate, endDate)}
      />

    </div>
  )
}
