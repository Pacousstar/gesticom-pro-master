'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Plus, Loader2, Eye, Printer, Search, 
  FileText, ArrowLeft, History, ShoppingCart, Calendar, User
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type Archive = {
  id: number
  numeroFactureOrigine: string
  date: string
  montantTotal: number
  clientLibre: string | null
  observation: string | null
  client: { nom: string } | null
  utilisateur: { nom: string }
  lignes: Array<{ designation: string; quantite: number; prixUnitaire: number; montant: number }>
}

export default function ArchivesVentesPage() {
  const [archives, setArchives] = useState<Archive[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedArchive, setSelectedArchive] = useState<Archive | null>(null)
  const [filterDateDebut, setFilterDateDebut] = useState('')
  const [filterDateFin, setFilterDateFin] = useState('')
  const [filterMontantMin, setFilterMontantMin] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    fetchArchives()
  }, [])

  const fetchArchives = async () => {
    try {
      const res = await fetch('/api/archives/ventes')
      const data = await res.json()
      setArchives(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filteredArchives = archives.filter(a => {
    const matchSearch = (a.numeroFactureOrigine || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.client?.nom || a.clientLibre || '').toLowerCase().includes(search.toLowerCase())
    
    const matchDate = (!filterDateDebut || a.date >= filterDateDebut) && 
                      (!filterDateFin || a.date <= filterDateFin)
    
    const matchMontant = (!filterMontantMin || a.montantTotal >= Number(filterMontantMin))

    return matchSearch && matchDate && matchMontant
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <History className="h-8 w-8 text-orange-600" />
            Archives des Anciennes Ventes
          </h1>
          <p className="text-white/70 font-medium whitespace-pre-wrap">Consultation de l'historique pré-GestiCom</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsPreviewOpen(true)}
            disabled={loading || filteredArchives.length === 0}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-black transition-all uppercase tracking-widest text-sm border border-white/20"
          >
            <Printer className="h-5 w-5" />
            Imprimer Journal
          </button>
          <Link 
            href="/dashboard/archives/ventes/nouvelle"
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-orange-600/20 transition-all uppercase tracking-widest text-sm"
          >
            <Plus className="h-5 w-5" />
            Enregistrer une Archive
          </Link>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-emerald-100/50">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-900/30" />
          <input
            type="text"
            placeholder="Rechercher par N° Facture ou Client..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-emerald-50/50 border-none focus:ring-2 focus:ring-orange-500 font-bold transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100/50">
            <Calendar className="h-4 w-4 text-emerald-400 ml-2" />
            <input 
              type="date" 
              className="bg-transparent border-none text-xs font-bold text-emerald-950 focus:ring-0 w-full"
              value={filterDateDebut}
              onChange={e => setFilterDateDebut(e.target.value)}
              placeholder="Date début"
            />
            <span className="text-emerald-300">→</span>
            <input 
              type="date" 
              className="bg-transparent border-none text-xs font-bold text-emerald-950 focus:ring-0 w-full"
              value={filterDateFin}
              onChange={e => setFilterDateFin(e.target.value)}
              placeholder="Date fin"
            />
          </div>
          <div className="flex items-center gap-2 bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100/50">
            <ShoppingCart className="h-4 w-4 text-emerald-400 ml-2" />
            <input 
              type="number" 
              placeholder="Montant Min (CFA)"
              className="bg-transparent border-none text-xs font-bold text-emerald-950 focus:ring-0 w-full"
              value={filterMontantMin}
              onChange={e => setFilterMontantMin(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setSearch('')
              setFilterDateDebut('')
              setFilterDateFin('')
              setFilterMontantMin('')
            }}
            className="text-[10px] font-black uppercase tracking-widest text-emerald-900/40 hover:text-orange-600 transition-colors"
          >
            Réinitialiser les filtres
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-12 w-12 text-orange-600 animate-spin" />
            <p className="font-black text-emerald-900/40 uppercase tracking-widest text-sm">Chargement des archives...</p>
          </div>
        ) : filteredArchives.length === 0 ? (
          <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100">
            <FileText className="h-16 w-16 text-emerald-900/10 mx-auto mb-4" />
            <p className="text-emerald-900/40 font-black uppercase tracking-widest">Aucune archive trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-[11px] font-black text-emerald-900/40 uppercase tracking-[0.2em] text-left">
                  <th className="px-4 py-2">Date d'origine</th>
                  <th className="px-4 py-2">N° Facture</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredArchives.map((a) => (
                  <tr key={a.id} className="group hover:scale-[1.01] transition-all duration-300">
                    <td className="bg-emerald-50/30 rounded-l-2xl px-4 py-4 font-bold text-emerald-950">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-600/50" />
                        {formatDate(a.date)}
                      </div>
                    </td>
                    <td className="bg-emerald-50/30 px-4 py-4 font-black text-orange-700">
                      {a.numeroFactureOrigine}
                    </td>
                    <td className="bg-emerald-50/30 px-4 py-4">
                      <div className="font-bold text-emerald-900">
                        {a.client?.nom || a.clientLibre || 'Passager'}
                      </div>
                    </td>
                    <td className="bg-emerald-50/30 px-4 py-4 text-right font-black text-emerald-950">
                      {a.montantTotal.toLocaleString()} <span className="text-[10px] text-emerald-600/50">CFA</span>
                    </td>
                    <td className="bg-emerald-50/30 rounded-r-2xl px-4 py-4 text-center">
                      <button 
                        onClick={() => setSelectedArchive(a)}
                        className="p-2.5 rounded-xl bg-white text-emerald-600 hover:bg-emerald-100 shadow-sm transition-colors"
                        title="Voir Détails"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Détails (Simplifié pour le moment) */}
      {selectedArchive && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-md" onClick={() => setSelectedArchive(null)} />
          <div className="relative bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-[#FCF6E8] border-b border-emerald-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tighter">Détails de l'Archive</h2>
                <p className="text-orange-600 font-black tracking-widest text-xs uppercase mt-1">N {selectedArchive.numeroFactureOrigine}</p>
              </div>
              <button 
                onClick={() => setSelectedArchive(null)}
                className="p-2 rounded-full hover:bg-emerald-100 transition-colors"
              >
                <Plus className="h-6 w-6 rotate-45 text-emerald-900" />
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-900/30 tracking-widest block mb-1">Date Facture</span>
                    <div className="flex items-center gap-2 font-bold text-emerald-950">
                      <Calendar className="h-4 w-4 text-orange-600" />
                      {formatDate(selectedArchive.date)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-900/30 tracking-widest block mb-1">Client d'origine</span>
                    <div className="flex items-center gap-2 font-bold text-emerald-950">
                      <User className="h-4 w-4 text-emerald-600" />
                      {selectedArchive.client?.nom || selectedArchive.clientLibre || 'Client Libre'}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl flex flex-col justify-center items-center">
                  <span className="text-[10px] font-black uppercase text-emerald-900/40 tracking-widest mb-1">Montant Total Archive</span>
                  <div className="text-3xl font-black text-emerald-950">{selectedArchive.montantTotal.toLocaleString()} <span className="text-sm">CFA</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-emerald-900/40 tracking-[0.2em] border-b border-emerald-100 pb-2">Articles enregistrés</h3>
                {selectedArchive.lignes.map((l, i) => (
                  <div key={i} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
                    <div>
                      <div className="font-black text-emerald-950 uppercase text-xs">{l.designation}</div>
                      <div className="text-[10px] font-bold text-emerald-600/70">{l.quantite} x {l.prixUnitaire.toLocaleString()} CFA</div>
                    </div>
                    <div className="font-black text-emerald-950">{l.montant.toLocaleString()} CFA</div>
                  </div>
                ))}
              </div>

              {selectedArchive.observation && (
                <div className="mt-8 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <span className="text-[10px] font-black uppercase text-orange-900/40 tracking-widest block mb-1">Observation</span>
                  <p className="text-sm font-bold text-orange-900 italic">"{selectedArchive.observation}"</p>
                </div>
              )}
            </div>

            <div className="p-8 bg-emerald-50/50 flex items-center justify-end gap-4">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-emerald-950 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all"
              >
                <Printer className="h-4 w-4" />
                Imprimer Preuve
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rendu Système (Impression Native) */}
      <div className="hidden print:block absolute inset-0 bg-white shadow-2xl">
        {chunkArray(filteredArchives, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
            <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                <ListPrintWrapper
                    title="Journal des Archives Ventes"
                    subtitle={`Audit Historique pré-GestiCom - Page ${index + 1}/${allChunks.length}`}
                    pageNumber={index + 1}
                    totalPages={allChunks.length}
                    hideHeader={index > 0}
                    hideVisa={index < allChunks.length - 1}
                >
                    <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner font-sans">
                        <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                <th className="border-r-2 border-black px-3 py-3 text-left">Date Origine</th>
                                <th className="border-r-2 border-black px-3 py-3 text-left italic">N° Facture</th>
                                <th className="border-r-2 border-black px-3 py-3 text-left tracking-tighter">Client d'Origine</th>
                                <th className="px-3 py-3 text-right tabular-nums">Montant Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chunk.map((a, idx) => (
                                <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors">
                                    <td className="border-r-2 border-black px-3 py-2 font-black italic text-slate-800">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                                    <td className="border-r-2 border-black px-3 py-2 font-black uppercase text-xs italic text-orange-700 tracking-widest">{a.numeroFactureOrigine}</td>
                                    <td className="border-r-2 border-black px-3 py-2 font-black uppercase tracking-tighter italic text-gray-600">
                                        {a.client?.nom || a.clientLibre || 'Passager'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black shadow-inner bg-gray-50/50 underline decoration-double tabular-nums text-blue-900 underline-offset-2">
                                        {a.montantTotal.toLocaleString()} F
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                            <tfoot>
                                <tr className="bg-black text-white font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                    <td colSpan={3} className="px-3 py-6 text-right tracking-[0.22em] underline decoration-orange-500 decoration-2">TOTAL CUMULÉ DES ARCHIVES ANALYSÉES</td>
                                    <td className="px-3 py-6 text-right bg-slate-900 ring-2 ring-white text-[18px] font-mono">
                                        {filteredArchives.reduce((acc, a) => acc + a.montantTotal, 0).toLocaleString()} F
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </ListPrintWrapper>
            </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION ARCHIVES */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter shadow-2xl">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal Archives</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Audit Historique des Transactions pré-système
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-orange-600 italic uppercase">Période Archives</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic leading-none">{filterDateDebut || '...'} au {filterDateFin || '...'}</span>
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
                  Imprimer le journal
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                {chunkArray(filteredArchives, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                  <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                    <ListPrintWrapper
                      title="JOURNAL DES ARCHIVES DÉTAILLÉ"
                      subtitle={`Analyse de l'historique de facturation - ${filteredArchives.length} Pièces`}
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                      <table className="w-full text-[14px] border-collapse border-4 border-black font-sans shadow-2xl">
                        <thead>
                          <tr className="bg-black text-white uppercase font-black border-2 border-black">
                            <th className="border-r-2 border-white px-4 py-4 text-left">Date / Réf</th>
                            <th className="border-r-2 border-white px-4 py-4 text-left italic">Client & Identité</th>
                            <th className="border-r-2 border-white px-4 py-4 text-right tabular-nums tracking-tighter">Valorisation Brute</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((a, idx) => (
                            <tr key={idx} className="border-b-2 border-black hover:bg-orange-50/30 transition-colors">
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black text-slate-800 tracking-tighter">{new Date(a.date).toLocaleDateString('fr-FR')}</div>
                                <div className="text-[10px] font-bold text-orange-700 uppercase tracking-widest bg-orange-50 px-2 rounded-md w-max mt-1 border border-orange-100 shadow-sm">{a.numeroFactureOrigine}</div>
                              </td>
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black uppercase leading-tight italic text-slate-700 tracking-tighter text-[13px]">{a.client?.nom || a.clientLibre || 'Passager'}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1"><History className="h-2 w-2" /> DATA ARCHIVE</div>
                              </td>
                              <td className="px-4 py-3 text-right font-black tabular-nums text-lg text-blue-900 bg-gray-50/50 underline decoration-double decoration-gray-300 shadow-inner italic">{a.montantTotal.toLocaleString()} F</td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-black text-white font-black text-[18px] border-t-4 border-black uppercase italic shadow-2xl">
                                <td colSpan={2} className="px-4 py-8 text-right tracking-[0.3em] underline decoration-orange-500 decoration-4 underline-offset-8">CHIFFRE D'AFFAIRES ARCHIVÉ CUMULÉ</td>
                                <td className="px-4 py-8 text-right text-3xl tabular-nums bg-slate-900 border-x-4 border-white shadow-inner font-mono ring-4 ring-slate-800">
                                  {filteredArchives.reduce((acc, a) => acc + a.montantTotal, 0).toLocaleString()} F
                                </td>
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

