'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Loader2, Filter, Download, FileSpreadsheet, Search, Printer } from 'lucide-react'
import ComptabiliteNav from '../ComptabiliteNav'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type GrandLivreEntry = {
  compte: { numero: string; libelle: string; type: string }
  ecritures: Array<{
    id: number
    numero: string
    date: string
    journal: { code: string; libelle: string }
    piece: string | null
    libelle: string
    debit: number
    credit: number
    utilisateur: { nom: string }
  }>
  soldeDebit: number
  soldeCredit: number
  solde: number
}

type PlanCompte = { id: number; numero: string; libelle: string }

export default function GrandLivrePage() {
  const [data, setData] = useState<GrandLivreEntry[]>([])
  const [comptes, setComptes] = useState<PlanCompte[]>([])
  const [loading, setLoading] = useState(true)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreCompte, setFiltreCompte] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Nouveaux états
  const [rechTextuelle, setRechTextuelle] = useState('')

  const COMPTES_RAPIDES = ['701', '531', '658', '411', '601', '401', '311', '603']

  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateDebut(firstDay.toISOString().split('T')[0])
    setDateFin(lastDay.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    fetch('/api/plan-comptes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setComptes)
  }, [])

  const fetchGrandLivre = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin) params.set('dateFin', dateFin)
    if (filtreCompte) params.set('compteId', filtreCompte)
    
    fetch('/api/grand-livre?' + params.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (dateDebut && dateFin) {
      fetchGrandLivre()
    }
  }, [dateDebut, dateFin, filtreCompte])

  const totalDebit = data.reduce((sum, entry) => sum + entry.soldeDebit, 0)
  const totalCredit = data.reduce((sum, entry) => sum + entry.soldeCredit, 0)

  const applyQuickFilter = (numero: string) => {
      const c = comptes.find(x => x.numero === numero)
      if (c) {
          setFiltreCompte(String(c.id))
      } else {
          setFiltreCompte('')
      }
  }

  return (
    <div className="space-y-6">
      <ComptabiliteNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Grand Livre SYSCOHADA</h1>
          <p className="mt-1 text-white/90">Registre détaillé des mouvements comptables par compte</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={isPrinting || data.length === 0}
            className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-50 px-5 py-2.5 text-xs font-black text-orange-800 hover:bg-orange-100 shadow-md transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            Aperçu Impression
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-xs font-medium text-gray-800 hover:bg-gray-50 uppercase tracking-widest no-print shadow-sm"
          >
            <Filter className="h-4 w-4" />
            Options & Filtres
          </button>
        </div>
      </div>

      {/* Raccourcis SYSCOHADA */}
      <div className="flex flex-wrap gap-2 pb-2">
            <button 
                onClick={() => setFiltreCompte('')}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all uppercase tracking-widest ${!filtreCompte ? 'bg-orange-500 text-white border-orange-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'}`}
            >
                TOUS
            </button>
            {COMPTES_RAPIDES.map(num => {
                const isActif = comptes.find(x => String(x.id) === filtreCompte)?.numero === num
                return (
                    <button 
                        key={num}
                        onClick={() => applyQuickFilter(num)}
                        className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all uppercase tracking-widest ${isActif ? 'bg-blue-600 text-white border-blue-700 shadow-md transform scale-105' : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'} shadow-sm`}
                    >
                        {num}
                    </button>
                )
            })}
      </div>

      {/* Barre de Recherche Locale */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm flex items-center gap-3">
          <Search className="h-5 w-5 text-gray-400 ml-2" />
          <input 
             type="text" 
             placeholder="Rechercher dans le Grand Livre par Libellé, Pièce..." 
             value={rechTextuelle}
             onChange={e => setRechTextuelle(e.target.value)}
             className="w-full text-sm font-semibold outline-none py-2 text-slate-800 placeholder-slate-400 uppercase tracking-tight"
          />
          {rechTextuelle && <button onClick={() => setRechTextuelle('')} className="text-gray-400 font-black mr-4 hover:text-red-500">✕</button>}
      </div>

      {/* Filtres Avancés */}
      {showFilters && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-inner animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label className="block text-xs font-black text-blue-900 mb-2 uppercase tracking-widest leading-none">Période - Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-lg border-2 border-blue-200 px-4 py-2.5 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-blue-900 mb-2 uppercase tracking-widest leading-none">Période - Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-lg border-2 border-blue-200 px-4 py-2.5 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-blue-900 mb-2 uppercase tracking-widest leading-none">Filtre Compte Spécifique</label>
              <select
                value={filtreCompte}
                onChange={(e) => setFiltreCompte(e.target.value)}
                className="w-full rounded-lg border-2 border-blue-200 px-4 py-2.5 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none"
              >
                <option value="">Tous les comptes (Non recommandé)</option>
                {comptes.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.numero} - {c.libelle}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-blue-200/50">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                if (dateDebut) params.set('dateDebut', dateDebut)
                if (dateFin) params.set('dateFin', dateFin)
                if (filtreCompte) params.set('compteId', filtreCompte)
                window.open(`/api/grand-livre/export-excel?${params.toString()}`, '_blank')
              }}
              className="rounded-xl border-b-4 border-green-600 bg-green-500 px-5 py-2.5 text-xs font-black text-white hover:bg-green-400 hover:border-green-500 transition-all flex items-center gap-2 uppercase tracking-widest active:translate-y-1 active:border-b-0 shadow-sm"
              title="Exporter le grand livre en Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Générer Excel
            </button>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                if (dateDebut) params.set('dateDebut', dateDebut)
                if (dateFin) params.set('dateFin', dateFin)
                if (filtreCompte) params.set('compteId', filtreCompte)
                window.open(`/api/grand-livre/export-pdf?${params.toString()}`, '_blank')
              }}
              className="rounded-xl border-b-4 border-red-600 bg-red-500 px-5 py-2.5 text-xs font-black text-white hover:bg-red-400 hover:border-red-500 transition-all flex items-center gap-2 uppercase tracking-widest active:translate-y-1 active:border-b-0 shadow-sm"
              title="Exporter le grand livre en PDF"
            >
              <Download className="h-4 w-4" />
              Générer PDF
            </button>
          </div>
        </div>
      )}

      {/* Totaux Généraux */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border-2 border-rose-100 bg-white p-5 shadow-lg group hover:border-rose-400 transition-colors">
          <div className="flex items-center justify-between text-sm font-black text-rose-500 uppercase tracking-widest">Mouvement Débit <span className="p-1 bg-rose-50 rounded-md">Débiteur</span></div>
          <div className="mt-3 text-3xl font-black text-slate-800 group-hover:text-rose-600 transition-colors tracking-tighter">
            {totalDebit.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 uppercase opacity-70 italic font-mono">FCFA</span>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5 shadow-lg group hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between text-sm font-black text-emerald-500 uppercase tracking-widest">Mouvement Crédit <span className="p-1 bg-emerald-50 rounded-md">Créditeur</span></div>
          <div className="mt-3 text-3xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors tracking-tighter">
            {totalCredit.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 uppercase opacity-70 italic font-mono">FCFA</span>
          </div>
        </div>
        <div className={`rounded-2xl border-2 p-5 shadow-lg transition-colors ${
          Math.abs(totalDebit - totalCredit) === 0 
            ? 'border-blue-200 bg-blue-50/30' 
            : 'border-orange-300 bg-orange-50'
        }`}>
          <div className={`flex items-center justify-between text-sm font-black uppercase tracking-widest ${
            Math.abs(totalDebit - totalCredit) === 0 ? 'text-blue-600' : 'text-orange-700'
          }`}>
            Ajustement Balance
            {Math.abs(totalDebit - totalCredit) === 0 && <span className="text-xs bg-blue-100 px-2 py-1 rounded-lg">Équilibre</span>}
          </div>
          <div className={`mt-3 text-3xl font-black tracking-tighter ${
            Math.abs(totalDebit - totalCredit) === 0 ? 'text-blue-600' : 'text-orange-600'
          }`}>
            {Math.abs(totalDebit - totalCredit).toLocaleString('fr-FR')} <span className="text-xs text-slate-400 uppercase opacity-70 italic font-mono">FCFA</span>
          </div>
        </div>
      </div>

      {/* Grand Livre Données */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-16 text-center shadow-xl">
          <BookOpen className="mx-auto h-20 w-20 text-blue-100 mb-6" />
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Livre Vierge</h2>
          <p className="mt-2 text-sm font-bold text-slate-400 uppercase tracking-widest">Aucun flux comptabilisé sur la période désignée</p>
        </div>
      ) : (
        <div className="space-y-8">
          {data.map((entry) => (
             <ComptePagine key={entry.compte.numero} entry={entry} rechTextuelle={rechTextuelle} />
          ))}
        </div>
      )}
      {/* MODALE D'APERÇU IMPRESSION GRAND LIVRE */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Grand Livre</h2>
                 <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none uppercase">
                   SYSCOHADA - {dateDebut && dateFin ? `DU ${new Date(dateDebut).toLocaleDateString()} AU ${new Date(dateFin).toLocaleDateString()}` : "Toutes périodes"}
                 </p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                 {data.length} COMPTES
               </span>
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
            <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4">
                {(() => {
                  return data.map((entry, compteIndex) => {
                    const ecrituresChunks = chunkArray(entry.ecritures, 18);
                    
                    return ecrituresChunks.map((chunk: any[], chunkIndex: number, allChunks: any[][]) => (
                      <div key={`${compteIndex}-${chunkIndex}`} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                         <ListPrintWrapper
                          title={`GRAND LIVRE : ${entry.compte.numero} - ${entry.compte.libelle}`}
                          subtitle={`Registre détaillé des mouvements - Page ${chunkIndex + 1}/${allChunks.length}`}
                          dateRange={{ start: dateDebut, end: dateFin }}
                          pageNumber={chunkIndex + 1}
                          totalPages={allChunks.length}
                          hideHeader={chunkIndex > 0}
                          hideVisa={!(compteIndex === data.length - 1 && chunkIndex === allChunks.length - 1)}
                        >
                           <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                            <thead>
                              <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                <th className="border-r-2 border-black px-2 py-3 text-left">Date d'Opération</th>
                                <th className="border-r-2 border-black px-2 py-3 text-left italic">Journal</th>
                                <th className="border-r-2 border-black px-2 py-3 text-left">Pièce Rèf</th>
                                <th className="border-r-2 border-black px-2 py-3 text-left italic">Libellé du Flux</th>
                                <th className="border-r-2 border-black px-2 py-3 text-right">MVT Débit</th>
                                <th className="px-2 py-3 text-right shadow-inner">MVT Crédit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {chunk.map((e: any, idx: number) => (
                                <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors shadow-sm italic">
                                  <td className="border-r-2 border-black px-2 py-2 whitespace-nowrap font-black text-blue-900">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                                  <td className="border-r-2 border-black px-2 py-2 text-center font-black text-slate-600">{e.journal.code}</td>
                                  <td className="border-r-2 border-black px-2 py-2 font-mono text-[10px] font-black">{e.piece || '—'}</td>
                                  <td className="border-r-2 border-black px-2 py-2 uppercase text-[12px] leading-tight font-black text-slate-700">{e.libelle}</td>
                                  <td className="border-r-2 border-black px-2 py-2 text-right tabular-nums font-black text-rose-800">{e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '—'}</td>
                                  <td className="px-2 py-2 text-right tabular-nums font-black text-emerald-800 shadow-inner">{e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                            {chunkIndex === allChunks.length - 1 && (
                              <tfoot>
                                <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                  <td colSpan={4} className="border-r-2 border-black px-3 py-6 text-right bg-white tracking-widest text-[12px] underline decoration-slate-400">TOTAUX MOUVEMENTS COMPTE {entry.compte.numero}</td>
                                  <td className="border-r-2 border-black px-3 py-6 text-right bg-white ring-2 ring-black font-mono shadow-inner text-rose-800">{entry.soldeDebit.toLocaleString('fr-FR')}</td>
                                  <td className="px-3 py-6 text-right bg-white text-emerald-800 shadow-inner italic font-mono">{entry.soldeCredit.toLocaleString('fr-FR')}</td>
                                </tr>
                                <tr className="bg-slate-900 font-black text-[15px] border-t-2 border-white uppercase shadow-2xl">
                                  <td colSpan={4} className="border-r-2 border-white px-3 py-6 text-right italic text-[11px] text-slate-300">SOLDE DE CLÔTURE {entry.solde >= 0 ? 'DÉBITEUR' : 'CRÉDITEUR'}</td>
                                  <td colSpan={2} className={`px-3 py-6 text-right text-xl underline decoration-double shadow-inner ${entry.solde >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                      {Math.abs(entry.solde).toLocaleString('fr-FR')} FCFA
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </ListPrintWrapper>
                      </div>
                    ));
                  });
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Rendu masqué pour l'impression système direct */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {data.map((entry, compteIndex) => {
            const ecrituresChunks = chunkArray(entry.ecritures, 18);
            return ecrituresChunks.map((chunk: any[], chunkIndex: number, allChunks: any[][]) => (
              <div key={`${compteIndex}-${chunkIndex}`} className={chunkIndex < allChunks.length - 1 || compteIndex < data.length - 1 ? 'page-break' : ''}>
                <ListPrintWrapper
                  title={`GRAND LIVRE : ${entry.compte.numero} - ${entry.compte.libelle}`}
                  subtitle={`Registre détaillé des mouvements - Page ${chunkIndex + 1}/${allChunks.length}`}
                  dateRange={{ start: dateDebut, end: dateFin }}
                  pageNumber={chunkIndex + 1}
                  totalPages={allChunks.length}
                  hideHeader={chunkIndex > 0}
                  hideVisa={!(compteIndex === data.length - 1 && chunkIndex === allChunks.length - 1)}
                >
                  <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                    <thead>
                      <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                        <th className="border-r-2 border-black px-2 py-3 text-left">Date d'Opération</th>
                        <th className="border-r-2 border-black px-2 py-3 text-left italic">Journal</th>
                        <th className="border-r-2 border-black px-2 py-3 text-left">Pièce Rèf</th>
                        <th className="border-r-2 border-black px-2 py-3 text-left italic">Libellé du Flux</th>
                        <th className="border-r-2 border-black px-2 py-3 text-right">MVT Débit</th>
                        <th className="px-2 py-3 text-right shadow-inner">MVT Crédit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((e: any, idx: number) => (
                        <tr key={idx} className="border-b border-black shadow-sm italic font-sans font-black text-slate-800">
                          <td className="border-r-2 border-black px-2 py-2 whitespace-nowrap text-blue-900">{new Date(e.date).toLocaleDateString('fr-FR')}</td>
                          <td className="border-r-2 border-black px-2 py-2 text-center text-slate-600">{e.journal.code}</td>
                          <td className="border-r-2 border-black px-2 py-2 font-mono text-[10px]">{e.piece || '—'}</td>
                          <td className="border-r-2 border-black px-2 py-2 uppercase text-[12px] leading-tight text-slate-700">{e.libelle}</td>
                          <td className="border-r-2 border-black px-2 py-2 text-right tabular-nums text-rose-800">{e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '—'}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-800 shadow-inner">{e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    {chunkIndex === allChunks.length - 1 && (
                      <tfoot>
                        <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                          <td colSpan={4} className="border-r-2 border-black px-3 py-6 text-right bg-white tracking-widest text-[12px] underline decoration-slate-400">TOTAUX MOUVEMENTS COMPTE {entry.compte.numero}</td>
                          <td className="border-r-2 border-black px-3 py-6 text-right bg-white ring-2 ring-black font-mono shadow-inner text-rose-800">{entry.soldeDebit.toLocaleString('fr-FR')}</td>
                          <td className="px-3 py-6 text-right bg-white text-emerald-800 shadow-inner italic font-mono">{entry.soldeCredit.toLocaleString('fr-FR')}</td>
                        </tr>
                        <tr className="bg-slate-900 font-black text-[15px] border-t-2 border-white uppercase shadow-2xl">
                          <td colSpan={4} className="border-r-2 border-white px-3 py-6 text-right italic text-[11px] text-slate-300">SOLDE DE CLÔTURE {entry.solde >= 0 ? 'DÉBITEUR' : 'CRÉDITEUR'}</td>
                          <td colSpan={2} className={`px-3 py-6 text-right text-xl underline decoration-double shadow-inner ${entry.solde >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {Math.abs(entry.solde).toLocaleString('fr-FR')} FCFA
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </ListPrintWrapper>
              </div>
            ))
        })}
      </div>

    </div>
  )
}

// Composant local de Pagination d'Account pour gérer ses propres états de pages
function ComptePagine({ entry, rechTextuelle }: { entry: GrandLivreEntry, rechTextuelle: string }) {
    const [page, setPage] = useState(1)
    const ITEMS_PER_PAGE = 20

    // Filtre les écritures
    let filteredEc = entry.ecritures
    if (rechTextuelle) {
        const tr = rechTextuelle.toLowerCase()
        filteredEc = filteredEc.filter(e => 
            (e.libelle || '').toLowerCase().includes(tr) || 
            (e.piece || '').toLowerCase().includes(tr) ||
            (e.journal.code || '').toLowerCase().includes(tr)
        )
    }

    const totalPages = Math.max(1, Math.ceil(filteredEc.length / ITEMS_PER_PAGE))
    const paginatedEc = filteredEc.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

    // Si on a tapé une recherche et qu'il n'y a pas de résultat, on masque ce compte pour alléger (Optionnel)
    if (rechTextuelle && filteredEc.length === 0) return null;

    return (
        <div className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden group">
            <div className="bg-gradient-to-r from-blue-900 to-slate-800 px-6 py-5 flex items-center justify-between border-b border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
                <div className="relative z-10 flex gap-4 items-center">
                    <div className="h-16 w-16 bg-blue-800/50 rounded-2xl flex items-center justify-center shadow-inner border border-blue-700 font-mono text-xl font-black text-white italic tracking-tighter">
                        {entry.compte.numero}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter italic mb-1">{entry.compte.libelle}</h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-black/20 text-blue-100 text-[9px] font-black rounded-full border border-blue-700/50 uppercase tracking-widest shadow-sm">
                                CLASSE - {entry.compte.type}
                            </span>
                            <span className="px-3 py-1 bg-white/10 text-white text-[9px] font-black rounded-full uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                <span>Total Flux: {filteredEc.length}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div className="text-right relative z-10">
                    <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1">Clôture Période</p>
                    <div className={`text-3xl font-black tracking-tighter leading-none p-2 rounded-xl border-b-2 shadow-sm ${
                        entry.solde >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50' : 'bg-rose-500/10 text-rose-400 border-rose-500/50'
                    }`}>
                        {Math.abs(entry.solde).toLocaleString('fr-FR')} <span className="text-xs opacity-50 uppercase tracking-widest text-slate-300 italic">{entry.solde >= 0 ? 'Débiteur' : 'Créditeur'}</span>
                    </div>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Date de Valeur</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Journal</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Appui Documentaire</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Libellé d'Opération</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Imputation Débit</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Imputation Crédit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedEc.map((e) => (
                            <tr key={e.id} className="hover:bg-blue-50/30 transition-colors group/row">
                                <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase tracking-widest">
                                    {new Date(e.date).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="px-6 py-5">
                                    <span className="bg-gray-100 border border-gray-200 px-3 py-1 font-mono text-[10px] font-black text-slate-600 rounded-lg shadow-inner">
                                        {e.journal.code}
                                    </span>
                                </td>
                                <td className="px-6 py-5 text-sm font-black text-blue-600 tracking-tighter uppercase italic">{e.piece || 'SANS RÈF'}</td>
                                <td className="px-6 py-5">
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight italic group-hover/row:text-blue-600 transition-colors">{e.libelle}</span>
                                </td>
                                <td className="px-6 py-5 text-right text-sm font-black text-rose-500 tabular-nums italic">
                                    {e.debit > 0 ? <span className="p-1.5 rounded bg-rose-50/50">{e.debit.toLocaleString('fr-FR')}</span> : '---'}
                                </td>
                                <td className="px-6 py-5 text-right text-sm font-black text-emerald-500 tabular-nums italic">
                                    {e.credit > 0 ? <span className="p-1.5 rounded bg-emerald-50/50">{e.credit.toLocaleString('fr-FR')}</span> : '---'}
                                </td>
                            </tr>
                        ))}
                        {paginatedEc.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-xs font-black uppercase text-slate-300 tracking-[0.4em] italic">Aucune écriture trouvée</td>
                            </tr>
                        )}
                        <tr className="bg-slate-50 border-t-[3px] border-slate-200">
                            <td colSpan={4} className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Total Mouvements</td>
                            <td className="px-6 py-5 text-right text-lg font-black text-rose-600 tabular-nums bg-white shadow-inner rounded-l-xl border-y border-l border-rose-100">
                                {entry.soldeDebit.toLocaleString('fr-FR')}
                            </td>
                            <td className="px-6 py-5 text-right text-lg font-black text-emerald-600 tabular-nums bg-white shadow-inner rounded-r-xl border-y border-r border-emerald-100">
                                {entry.soldeCredit.toLocaleString('fr-FR')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Zone de Pagination */}
            {totalPages > 1 && (
                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Affichage {((page - 1) * ITEMS_PER_PAGE) + 1} à {Math.min(page * ITEMS_PER_PAGE, filteredEc.length)}</span>
                    <Pagination 
                        currentPage={page} 
                        totalPages={totalPages} 
                        totalItems={filteredEc.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setPage} 
                    />
                </div>
            )}
        </div>
    )
}
