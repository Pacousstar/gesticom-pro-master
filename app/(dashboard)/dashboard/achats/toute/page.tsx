'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Loader2, 
  Download, 
  Filter, 
  ShoppingBag, 
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
import ModificationAchatModal from '@/components/dashboard/achats/ModificationAchatModal'
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
  produits: string
}

export default function TousLesAchatsPage() {
  const [data, setData] = useState<AchatListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { error: showError } = useToast()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')
  const [printType, setPrintType] = useState<'GLOBAL' | 'DETAIL' | null>(null)
  const [editingAchatId, setEditingAchatId] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [entreprise, setEntreprise] = useState<any>(null)

  useEffect(() => {
    const now = new Date()
    // Par défaut, afficher les 30 derniers jours (évite le vide le 1er du mois)
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

  const handleSupprimer = async (id: number, numero: string) => {
    if (!confirm(`Supprimer définitivement l'achat ${numero} ? Cette action est irréversible et annulera les entrées en stock et les écritures comptables.`)) return
    setSupprimant(id)
    try {
      const res = await fetch(`/api/achats/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showError('Achat supprimé avec succès.') 
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

  const handleOpenPreview = (type: 'GLOBAL' | 'DETAIL') => {
    setPrintType(type)
    setIsPreviewOpen(true)
  }

  const filteredData = data.filter(a => 
    a.numero.toLowerCase().includes(search.toLowerCase()) || 
    a.fournisseur.toLowerCase().includes(search.toLowerCase()) ||
    (a as any).produits?.toLowerCase().includes(search.toLowerCase())
  )

  // Statistiques
  const caMonth = data.reduce((acc, a) => acc + a.montantTotal, 0)
  const nbAchatsMonth = data.length
  const decaisseMonth = data.reduce((acc, a) => acc + a.montantPaye, 0)
  const resteAPayer = caMonth - decaisseMonth

  const itemsPerPage = 20
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const formatFcfa = (val: number) => val.toLocaleString('fr-FR') + ' F'

  return (
    <div className="pb-12">
      {/* VUE ÉCRAN (Masquée à l'impression) */}
      <div className="print:hidden space-y-6">
        {/* HEADER BLEU/VIOLET PREMIUM */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-800 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Tous les Achats</h1>
              <p className="mt-2 text-white/90 font-medium max-w-2xl">
                Suivi exhaustif des approvisionnements et engagements envers les fournisseurs.
              </p>
            </div>
            <div className="flex gap-3 no-print">
               <button 
                onClick={() => handleOpenPreview('GLOBAL')}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 border-2 border-indigo-400 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                IMPRIMER JOURNAL
              </button>
              <button 
                onClick={() => {
                  let url = `/api/achats/export?dateDebut=${startDate}&dateFin=${endDate}`
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

        {/* COMPTEURS DE PERFORMANCE */}
      </div>

      {/* IMPRESSION : JOURNAL GLOBAL */}
      <div className={printType === 'GLOBAL' ? 'hidden print:block' : 'hidden'}>
        {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title={printType === 'GLOBAL' ? "Journal Global des Achats" : "Journal Détaillé des Achats"}
              subtitle={`Rapport des approvisionnements - Période du ${startDate} au ${endDate}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              layout={printLayout}
              enterprise={entreprise}
            >
              <table className="w-full text-[14px] border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-700">
                    <th className="border border-gray-300 px-3 py-3 text-left">Réf / Date</th>
                    <th className="border border-gray-300 px-3 py-3 text-left">Fournisseur / Magasin</th>
                    <th className="border border-gray-300 px-3 py-3 text-center">Paiement</th>
                    <th className="border border-gray-300 px-3 py-3 text-right">Total Achat</th>
                    <th className="border border-gray-300 px-3 py-3 text-right">Décaissé</th>
                    <th className="border border-gray-300 px-3 py-3 text-right">Solde Dû</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((a) => (
                    <tr key={a.id} className="border-b border-gray-200">
                      <td className="border border-gray-300 px-3 py-2">
                        <span className="font-bold">{a.numero}</span><br/>
                        {new Date(a.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 font-bold uppercase">
                        {a.fournisseur}<br/>
                        <small className="font-normal italic text-gray-500">{a.magasin}</small>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-[12px] uppercase font-bold">
                        {a.modePaiement}<br/>
                        <span className={a.statutPaiement === 'PAYE' ? 'text-emerald-600' : 'text-rose-600'}>{a.statutPaiement}</span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-bold">
                        {a.montantTotal.toLocaleString()} F
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right text-emerald-700 font-bold">
                        {a.montantPaye.toLocaleString()} F
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right font-black text-rose-700">
                        {(a.montantTotal - a.montantPaye).toLocaleString()} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-black text-[12px] border-t-2 border-black uppercase italic">
                        <td colSpan={2} className="border border-gray-300 px-3 py-4 text-right">RÉCAPITULATIF SÉLECTION</td>
                        <td className="border border-gray-300 px-3 py-4 text-center">
                          Factures: {nbAchatsMonth}<br/>
                          Ex: {data.filter(a => a.modePaiement === 'ESPECES').length} | Ch: {data.filter(a => a.modePaiement === 'CHEQUE').length}
                        </td>
                        <td className="border border-gray-300 px-3 py-4 text-right bg-white">
                          VOLUME ACHATS<br/>
                          <span className="text-sm">{caMonth.toLocaleString()} F</span>
                        </td>
                        <td className="border border-gray-300 px-3 py-4 text-right text-emerald-700 bg-white">
                          TOTAL PAYÉ<br/>
                          <span className="text-sm">{decaisseMonth.toLocaleString()} F</span>
                        </td>
                        <td className="border border-gray-300 px-3 py-4 text-right text-rose-700 bg-white underline decoration-double">
                          RESTE À PAYER<br/>
                          <span className="text-sm">{(caMonth - decaisseMonth).toLocaleString()} F</span>
                        </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* IMPRESSION : JOURNAL DÉTAILLÉ */}
      <div className={printType === 'DETAIL' ? 'hidden print:block' : 'hidden'}>
        {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="Journal Détaillé des Achats"
              subtitle="Détail des achats comprenant les produits"
              pageNumber={index + 1}
              totalPages={allChunks.length}
              layout={printLayout}
              enterprise={entreprise}
            >
              <table className="w-full text-[14px] border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-700">
                    <th className="border border-gray-300 px-2 py-2 text-left">Réf / Date</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-1/4">Fournisseur / Magasin</th>
                    <th className="border border-gray-300 px-2 py-2 text-left w-1/3">Produits & Quantités</th>
                    <th className="border border-gray-300 px-2 py-2 text-center">Paiement</th>
                    <th className="border border-gray-300 px-2 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((a) => (
                    <tr key={a.id} className="border-b border-gray-200">
                      <td className="border border-gray-300 px-2 py-1">
                        <span className="font-bold">{a.numero}</span><br/>
                        {new Date(a.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 font-bold uppercase">
                        {a.fournisseur}<br/>
                        <small className="font-normal italic text-gray-500">{a.magasin}</small>
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-[11px] whitespace-pre-wrap leading-tight">
                        {(a as any).produits || '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold">
                        {a.modePaiement}<br/>
                        <span className={a.statutPaiement === 'PAYE' ? 'text-emerald-600' : 'text-rose-600'}>{a.statutPaiement}</span>
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-black text-[14px]">
                        {a.montantTotal.toLocaleString()} F
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-black text-[14px] border-t-2 border-black uppercase italic">
                        <td colSpan={4} className="border border-gray-300 px-2 py-3 text-right">VOLUME CUMULÉ DÉTAILLÉ</td>
                        <td className="border border-gray-300 px-2 py-3 text-right bg-white text-[16px]">
                          {caMonth.toLocaleString()} F
                        </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* COMPTEURS DE PERFORMANCE (Analyse de Compteur) */}
      <div className="space-y-2 no-print">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] ml-6">Analyse de Compteur : 1 / 4</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "VOLUME ACHATS", val: formatFcfa(caMonth), sub: `${nbAchatsMonth} factures f.`, icon: ShoppingBag, color: "bg-blue-600" },
            { label: "TOTAL PAYÉ", val: formatFcfa(decaisseMonth), sub: "Règlements fournisseurs", icon: CheckCircle2, color: "bg-emerald-600" },
            { label: "RESTE À PAYER", val: formatFcfa(resteAPayer), sub: "Dettes en suspens", icon: CreditCard, color: "bg-rose-600" },
            { label: "NB OPÉRATIONS", val: String(nbAchatsMonth), sub: "Volume de la période", icon: Tag, color: "bg-indigo-700" },
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
      <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4 flex-1">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-40 rounded-xl border-gray-200 bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
            placeholder="Référence, fournisseur, produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* JOURNAL DES ACHATS */}
      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
        <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between no-print">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              Journal des Approvisionnements
            </h2>
            <div className="flex gap-2">
               <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {filteredData.length} Opérations
               </span>
            </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-xs font-black uppercase tracking-widest italic text-gray-500">Chargement...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
             <ShoppingBag className="h-16 w-16" />
             <p className="text-sm font-black uppercase tracking-widest italic">Aucun mouvement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                  <th className="px-8 py-5">Référence / Date</th>
                  <th className="px-8 py-5">Fournisseur / Magasin</th>
                  <th className="px-8 py-5 text-center">Règlement</th>
                  <th className="px-8 py-5 text-right">Montant Total</th>
                  <th className="px-8 py-5 text-right">Décaissé</th>
                  <th className="px-8 py-5 text-right">Reste</th>
                  <th className="px-8 py-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((a) => (
                  <tr key={a.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-6">
                       <p className="font-mono text-xs font-black text-blue-600">{a.numero}</p>
                       <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">
                          {new Date(a.date).toLocaleDateString('fr-FR', {day: '2-digit', month: 'long', year: 'numeric'})}
                       </p>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">{a.fournisseur}</p>
                       <p className="text-[9px] font-bold text-gray-400 flex items-center gap-1 mt-0.5 uppercase">
                          <Warehouse className="h-3 w-3" /> {a.magasin}
                       </p>
                    </td>
                    <td className="px-8 py-6 text-center">
                       <div className="flex flex-col items-center gap-2">
                          <span className="bg-gray-100 px-3 py-1 rounded-lg text-[9px] font-black text-gray-600 uppercase tracking-widest">
                             {a.modePaiement}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${a.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                             {a.statutPaiement}
                          </span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <p className="text-sm font-black text-gray-900 tracking-tighter">{formatFcfa(a.montantTotal)}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <p className="text-sm font-black text-emerald-600 tracking-tighter">{formatFcfa(a.montantPaye)}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <p className={`text-sm font-black tracking-tighter ${a.montantTotal - a.montantPaye > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                          {formatFcfa(a.montantTotal - a.montantPaye)}
                       </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingAchatId(a.id)}
                          className="rounded-xl border border-gray-200 bg-white p-2.5 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSupprimer(a.id, a.numero)}
                          disabled={supprimant === a.id}
                          className="rounded-xl border border-gray-200 bg-white p-2.5 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                          title="Supprimer"
                        >
                          {supprimant === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
          <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100 no-print">
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

      <ModificationAchatModal
        isOpen={editingAchatId !== null}
        onClose={() => setEditingAchatId(null)}
        achatId={editingAchatId || 0}
        onSuccess={() => fetchData(startDate, endDate)}
      />

      {/* MODALE D'APERÇU IMPRESSION ACHATS (ZenPrint) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-md no-print font-sans text-slate-900 uppercase italic tracking-tighter">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Journal des Achats</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     {printType === 'GLOBAL' ? 'Consolidation des Approvisionnements' : 'Détails des Articles par Facture'}
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-blue-600 italic uppercase">Période : {new Date(startDate).toLocaleDateString()}</span>
                      <span className="text-xs font-black text-blue-600 italic uppercase">jusqu'au : {new Date(endDate).toLocaleDateString()}</span>
                    </div>
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
                  Imprimer
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} min-h-screen p-4 text-slate-900 not-italic tracking-normal`}>
                  {chunkArray(filteredData, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                      <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                          <ListPrintWrapper
                              title={printType === 'GLOBAL' ? "Journal Global des Achats" : "Journal Détaillé des Achats"}
                              subtitle={`Période du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`}
                              pageNumber={index + 1}
                              totalPages={allChunks.length}
                              layout={printLayout}
                              enterprise={entreprise}
                          >
                             {/* Injection dynamique du contenu selon le type */}
                             {printType === 'GLOBAL' ? (
                               <table className="w-full text-[13px] border-collapse border-2 border-black font-sans">
                                 <thead>
                                   <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                     <th className="border border-black px-3 py-3 text-left">Réf / Date</th>
                                     <th className="border border-black px-3 py-3 text-left w-1/4">Fournisseur</th>
                                     <th className="border border-black px-3 py-3 text-center">Paiement</th>
                                     <th className="border border-black px-3 py-3 text-right">Montant</th>
                                     <th className="border border-black px-3 py-3 text-right">Versé</th>
                                     <th className="border border-black px-3 py-3 text-right">Solde</th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {chunk.map((a) => (
                                     <tr key={a.id} className="border-b border-black">
                                       <td className="border border-black px-3 py-2">
                                         <span className="font-black text-blue-800">{a.numero}</span><br/>
                                         {new Date(a.date).toLocaleDateString('fr-FR')}
                                       </td>
                                       <td className="border border-black px-3 py-2 font-black uppercase text-gray-700">{a.fournisseur}</td>
                                       <td className="border border-black px-3 py-2 text-center text-[10px] font-black uppercase">{a.modePaiement}</td>
                                       <td className="border border-black px-3 py-2 text-right font-black">{a.montantTotal.toLocaleString()} F</td>
                                       <td className="border border-black px-3 py-2 text-right text-emerald-700 font-bold">{a.montantPaye.toLocaleString()} F</td>
                                       <td className="border border-black px-3 py-2 text-right font-black text-rose-700 bg-rose-50/10">{(a.montantTotal - a.montantPaye).toLocaleString()} F</td>
                                     </tr>
                                   ))}
                                 </tbody>
                                 {index === allChunks.length - 1 && (
                                   <tfoot>
                                     <tr className="bg-gray-50 font-black text-[14px] border-t-2 border-black tracking-widest leading-none">
                                       <td colSpan={3} className="border border-black px-3 py-4 text-right bg-white shadow-inner uppercase italic">Volume Global Transactions :</td>
                                       <td className="border border-black px-3 py-4 text-right bg-white text-blue-900 underline decoration-double">{caMonth.toLocaleString()} F</td>
                                       <td className="border border-black px-3 py-4 text-right bg-white text-emerald-800 underline decoration-double">{decaisseMonth.toLocaleString()} F</td>
                                       <td className="border border-black px-3 py-4 text-right bg-rose-50 text-rose-800 underline decoration-double shadow-2xl">{(caMonth - decaisseMonth).toLocaleString()} F</td>
                                     </tr>
                                   </tfoot>
                                 )}
                               </table>
                             ) : (
                               <table className="w-full text-[13px] border-collapse border-2 border-black font-sans">
                                 <thead>
                                   <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                     <th className="border border-black px-2 py-3 text-left w-24">Référence</th>
                                     <th className="border border-black px-2 py-3 text-left w-1/4">Fournisseur</th>
                                     <th className="border border-black px-2 py-3 text-left">Détail des Produits</th>
                                     <th className="border border-black px-2 py-3 text-right w-28">Net à Payer</th>
                                   </tr>
                                 </thead>
                                 <tbody>
                                   {chunk.map((a) => (
                                     <tr key={a.id} className="border-b border-black">
                                       <td className="border border-black px-2 py-2 font-black text-blue-800 text-[11px]">{a.numero}</td>
                                       <td className="border border-black px-2 py-2 font-black uppercase text-[11px] leading-tight">{a.fournisseur}</td>
                                       <td className="border border-black px-2 py-2 text-[10px] italic font-medium text-gray-600 leading-none">{(a as any).produits || '-'}</td>
                                       <td className="border border-black px-2 py-2 text-right font-black text-[14px] tabular-nums">{a.montantTotal.toLocaleString()} F</td>
                                     </tr>
                                   ))}
                                 </tbody>
                                 {index === allChunks.length - 1 && (
                                   <tfoot>
                                     <tr className="bg-emerald-950 text-white font-black text-[16px] border-t-4 border-black uppercase italic shadow-2xl">
                                       <td colSpan={3} className="border border-black px-4 py-6 text-right tracking-[0.2em] bg-emerald-950">TOTAL CUMULÉ DES APPROVISIONNEMENTS :</td>
                                       <td className="border border-black px-4 py-6 text-right bg-emerald-900 shadow-inner tabular-nums">{caMonth.toLocaleString()} FCFA</td>
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

    </div>
  )
}
