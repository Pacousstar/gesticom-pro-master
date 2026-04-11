'use client'

import { useState, useEffect } from 'react'
import React from 'react'
import { Scale, Loader2, Filter, FileSpreadsheet, Download, Search, Printer } from 'lucide-react'
import ComptabiliteNav from '../ComptabiliteNav'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type BalanceEntry = {
  compte: { id: number; numero: string; libelle: string; classe: string; type: string }
  soldeDebit: number
  soldeCredit: number
  solde: number
}

type BalanceData = {
  balance: BalanceEntry[]
  totauxParClasse: Record<string, { debit: number; credit: number }>
  totalDebit: number
  totalCredit: number
}

export default function BalancePage() {
  const [data, setData] = useState<BalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Filtre et Pagination
  const [rechTextuelle, setRechTextuelle] = useState('')
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 30

  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateDebut(firstDay.toISOString().split('T')[0])
    setDateFin(lastDay.toISOString().split('T')[0])
  }, [])

  const fetchBalance = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin) params.set('dateFin', dateFin)
    
    fetch('/api/balance?' + params.toString())
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (dateDebut && dateFin) {
      fetchBalance()
    }
  }, [dateDebut, dateFin])

  let filteredBalance = data?.balance || []
  if (rechTextuelle && data) {
      const tr = rechTextuelle.toLowerCase()
      filteredBalance = data.balance.filter((c: any) => 
          (c.compte.libelle || '').toLowerCase().includes(tr) ||
          (c.compte.numero || '').toLowerCase().includes(tr) ||
          (c.compte.classe || '').toLowerCase().includes(tr)
      )
  }

  const totalPages = Math.max(1, Math.ceil(filteredBalance.length / ITEMS_PER_PAGE))
  const paginatedBalance = filteredBalance.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  // Reset page when filter changes
  useEffect(() => { setPage(1) }, [rechTextuelle])

  return (
    <div className="space-y-6">
      <ComptabiliteNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tighter italic">Balance des Comptes SYSCOHADA</h1>
          <p className="mt-1 text-white/90 text-sm font-bold tracking-widest uppercase">Balance générale des comptes selon le tableau standard</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={isPrinting || !data}
            className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-50 px-5 py-2.5 text-xs font-black text-orange-800 hover:bg-orange-100 shadow-md transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            Aperçu Impression
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-xl border-b-4 border-blue-600 bg-blue-500 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-400 hover:border-blue-500 transition-all uppercase tracking-widest active:translate-y-1 active:border-b-0 shadow-sm no-print"
          >
            <Filter className="h-4 w-4" />
            Filtres & Période
          </button>
        </div>
      </div>

      {/* Barre de Recherche Locale */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-xl flex items-center gap-3">
          <Search className="h-5 w-5 text-blue-500 ml-2 animate-pulse" />
          <input 
             type="text" 
             placeholder="Rechercher un numéro ou libellé de compte..." 
             value={rechTextuelle}
             onChange={e => setRechTextuelle(e.target.value)}
             className="w-full text-sm font-semibold outline-none py-2 text-slate-800 placeholder-slate-400 uppercase tracking-tight"
          />
          {rechTextuelle && <button onClick={() => setRechTextuelle('')} className="text-gray-400 font-black mr-4 hover:text-red-500">✕</button>}
      </div>

      {/* Filtres Avancés */}
      {showFilters && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-inner animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-[10px] font-black text-blue-900 mb-2 uppercase tracking-[0.2em] leading-none">Examen : Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-blue-900 mb-2 uppercase tracking-[0.2em] leading-none">Examen : Au</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-3 pt-6 border-t border-blue-100/50 justify-end">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                if (dateDebut) params.set('dateDebut', dateDebut)
                if (dateFin) params.set('dateFin', dateFin)
                window.open(`/api/balance/export-excel?${params.toString()}`, '_blank')
              }}
              className="rounded-xl border border-green-600 bg-emerald-50 px-5 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 transition-all flex items-center gap-2 uppercase tracking-[0.2em]"
              title="Exporter la balance en Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Obtenir Excel
            </button>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams()
                if (dateDebut) params.set('dateDebut', dateDebut)
                if (dateFin) params.set('dateFin', dateFin)
                window.open(`/api/balance/export-pdf?${params.toString()}`, '_blank')
              }}
              className="rounded-xl border border-rose-600 bg-rose-50 px-5 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-100 transition-all flex items-center gap-2 uppercase tracking-[0.2em]"
              title="Exporter la balance en PDF"
            >
              <Download className="h-4 w-4" />
              Tirer PDF
            </button>
          </div>
        </div>
      )}

      {/* Totaux Généraux */}
      {data && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border-2 border-rose-100 bg-white p-6 shadow-xl group hover:border-rose-300 transition-all hover:-translate-y-1">
            <div className="text-[10px] font-black text-rose-500 tracking-widest uppercase flex items-center gap-2">Débit Cumulé <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"/></div>
            <div className="mt-4 text-3xl font-black text-slate-800 tracking-tighter italic">
              {data.totalDebit.toLocaleString('fr-FR')} <span className="text-xs font-mono text-slate-400 uppercase tracking-widest opacity-60">FCFA</span>
            </div>
          </div>
          <div className="rounded-[2rem] border-2 border-emerald-100 bg-white p-6 shadow-xl group hover:border-emerald-300 transition-all hover:-translate-y-1">
            <div className="text-[10px] font-black text-emerald-600 tracking-widest uppercase flex items-center gap-2">Crédit Cumulé <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/></div>
            <div className="mt-4 text-3xl font-black text-slate-800 tracking-tighter italic">
              {data.totalCredit.toLocaleString('fr-FR')} <span className="text-xs font-mono text-slate-400 uppercase tracking-widest opacity-60">FCFA</span>
            </div>
          </div>
          <div className={`rounded-[2rem] border-2 p-6 shadow-xl transition-all hover:-translate-y-1 ${
            Math.abs(data.totalDebit - data.totalCredit) === 0 
              ? 'border-blue-200 bg-blue-50/50' 
              : 'border-orange-300 bg-orange-50/50'
          }`}>
            <div className={`text-[10px] font-black text-blue-600 tracking-widest uppercase flex justify-between items-center ${
              Math.abs(data.totalDebit - data.totalCredit) === 0 ? 'text-blue-600' : 'text-orange-700'
            }`}>
              Ajustement / Écart
              {Math.abs(data.totalDebit - data.totalCredit) === 0 && <span className="px-2 py-1 bg-white border border-blue-200 rounded-lg text-blue-600 shadow-sm">Équilibre Constaté</span>}
            </div>
            <div className={`mt-4 text-3xl font-black tracking-tighter italic ${
              Math.abs(data.totalDebit - data.totalCredit) === 0 ? 'text-blue-700' : 'text-orange-600'
            }`}>
              {Math.abs(data.totalDebit - data.totalCredit).toLocaleString('fr-FR')} <span className="text-xs font-mono text-slate-400 uppercase tracking-widest opacity-60">FCFA</span>
            </div>
          </div>
        </div>
      )}

      {/* Balance Tabulaire */}
      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center bg-white rounded-3xl shadow-sm border border-gray-100">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        </div>
      ) : !data || filteredBalance.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-16 text-center shadow-xl">
          <Scale className="mx-auto h-20 w-20 text-blue-100 mb-6" />
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Table de Balance Vierge</h2>
          <p className="mt-2 text-sm font-bold text-slate-400 uppercase tracking-widest">Aucune donnée disponible pour vos critères actuels</p>
        </div>
      ) : (
        <div className="rounded-[2.5rem] border border-gray-100 bg-white shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-slate-800 p-8 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Tableau SYNTHÉTIQUE</h3>
                <span className="text-[9px] font-black uppercase text-blue-100 tracking-[0.2em] border border-blue-800 bg-black/20 px-4 py-1.5 rounded-full shadow-sm">
                    {filteredBalance.length} Comptes Audités
                </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Cls</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Identifiant N°</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Intitulé Officiel</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Nature</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Débit Analytique</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Crédit Analytique</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 italic">Rapprochement Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  const rows: React.ReactNode[] = []
                  const classesAffichees = new Set<string>()
                  
                  paginatedBalance.forEach((entry, index) => {
                    // Logic for generating class headers/footers in pagination mode
                    const isNewClasse = index === 0 || paginatedBalance[index - 1].compte.classe !== entry.compte.classe
                    // Determine if its the last element of this class on THIS page, or last generally
                    const isLastClassePage = index === paginatedBalance.length - 1 || paginatedBalance[index + 1]?.compte.classe !== entry.compte.classe
                    
                    const classeTotal = data.totauxParClasse[entry.compte.classe]
                    
                    if (isNewClasse && !rechTextuelle) {
                      rows.push(
                        <tr key={`classe-header-${entry.compte.classe}`} className="bg-blue-50/50 border-y border-blue-100">
                          <td colSpan={7} className="px-6 py-4 text-xs font-black text-blue-700 uppercase tracking-[0.3em] italic">
                            GROUPEMENT {entry.compte.classe}
                          </td>
                        </tr>
                      )
                    }
                    
                    rows.push(
                      <tr key={entry.compte.id} className="hover:bg-slate-50 transition-colors group/row">
                        <td className="px-6 py-5 text-xs text-slate-400 font-black italic">{entry.compte.classe}</td>
                        <td className="px-6 py-5 font-mono text-sm font-black text-blue-600 tracking-tighter">
                            <span className="bg-white border border-gray-200 px-3 py-1 rounded-lg shadow-sm">{entry.compte.numero}</span>
                        </td>
                        <td className="px-6 py-5 text-sm font-black text-slate-800 uppercase tracking-tighter group-hover/row:text-blue-600 transition-colors italic">{entry.compte.libelle}</td>
                        <td className="px-6 py-5">
                          <span className={`px-4 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] shadow-sm italic ${
                            entry.compte.type === 'ACTIF' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            entry.compte.type === 'PASSIF' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                            entry.compte.type === 'CHARGES' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {entry.compte.type}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right text-sm font-black text-rose-500 tabular-nums italic">
                          {entry.soldeDebit > 0 ? entry.soldeDebit.toLocaleString('fr-FR') : '---'}
                        </td>
                        <td className="px-6 py-5 text-right text-sm font-black text-emerald-500 tabular-nums italic">
                          {entry.soldeCredit > 0 ? entry.soldeCredit.toLocaleString('fr-FR') : '---'}
                        </td>
                        <td className={`px-6 py-5 text-right text-base font-black tabular-nums tracking-tighter ${
                          entry.solde >= 0 ? 'text-emerald-600 bg-emerald-50/50' : 'text-rose-600 bg-rose-50/50'
                        }`}>
                          {entry.solde.toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    )
                    
                    // Display class totals only if no search filter, and it's the last element of class (not just end of page bounds, but logic permits ending it if desired)
                    // Let's only display if we know it's the end of that class for good or if we want it every page break.
                    // For UI cleanliness, we show it at `isLastClassePage`.
                    if (isLastClassePage && classeTotal && !classesAffichees.has(entry.compte.classe) && !rechTextuelle) {
                      classesAffichees.add(entry.compte.classe)
                      rows.push(
                        <tr key={`total-footer-${entry.compte.classe}`} className="bg-slate-100/50 font-black border-y-2 border-slate-200">
                          <td colSpan={4} className="px-6 py-4 text-[10px] text-slate-400 uppercase tracking-[0.3em] text-right italic">
                            Consolidé {entry.compte.classe}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-rose-600 tabular-nums">
                            {classeTotal.debit.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-emerald-600 tabular-nums">
                            {classeTotal.credit.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-6 py-4"></td>
                        </tr>
                      )
                    }
                  })
                  
                  return rows
                })()}
                {!rechTextuelle && page === totalPages && (
                     <tr className="bg-slate-900 shadow-xl border-t-4 border-emerald-500">
                        <td colSpan={4} className="px-6 py-8 text-right text-[10px] text-slate-400 uppercase tracking-[0.4em] italic opacity-80">
                            Conclusion Balance (Tous Piliers)
                        </td>
                        <td className="px-6 py-8 text-right text-2xl font-black text-rose-500 tabular-nums italic">
                            {data.totalDebit.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-8 text-right text-2xl font-black text-emerald-500 tabular-nums italic">
                            {data.totalCredit.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-8"></td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Section {page} / {totalPages}</span>
                  <Pagination 
                      currentPage={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      totalItems={filteredBalance.length}
                      itemsPerPage={ITEMS_PER_PAGE}
                  />
              </div>
          )}
        </div>
      )}
      {/* MODALE D'APERÇU IMPRESSION BALANCE */}
      {isPreviewOpen && data && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Balance Générale</h2>
                 <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                   SYSCOHADA - {dateDebut && dateFin ? `DU ${new Date(dateDebut).toLocaleDateString()} AU ${new Date(dateFin).toLocaleDateString()}` : "Toutes périodes"}
                 </p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-600 uppercase">
                 {data.balance.length} Comptes Audités
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
                {chunkArray(data.balance, 18).map((chunk, index, allChunks) => (
                  <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                    <ListPrintWrapper
                      title="BALANCE DES COMPTES RÉVISÉE"
                      subtitle="SYSCOHADA - Balance de synthèse des soldes et mouvements"
                      dateRange={{ start: dateDebut, end: dateFin }}
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                      <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-2 py-3 text-left">N° Compte</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left italic">Intitulé Officiel</th>
                            <th className="border-r-2 border-black px-2 py-3 text-right">MVT Débit</th>
                            <th className="border-r-2 border-black px-2 py-3 text-right">MVT Crédit</th>
                            <th className="border-r-2 border-black px-2 py-3 text-right">Solde Déb</th>
                            <th className="px-2 py-3 text-right italic shadow-inner">Solde Cré</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((e, idx) => (
                            <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors shadow-sm italic">
                              <td className="border-r-2 border-black px-2 py-2 font-black whitespace-nowrap text-blue-900">{e.compte.numero}</td>
                              <td className="border-r-2 border-black px-2 py-2 uppercase font-black text-[12px] leading-tight truncate max-w-[200px] text-slate-700">{e.compte.libelle}</td>
                              <td className="border-r-2 border-black px-2 py-2 text-right tabular-nums font-black">{e.soldeDebit > 0 ? e.soldeDebit.toLocaleString('fr-FR') : '—'}</td>
                              <td className="border-r-2 border-black px-2 py-2 text-right tabular-nums font-black text-emerald-800 bg-emerald-50/10 shadow-inner">{e.soldeCredit > 0 ? e.soldeCredit.toLocaleString('fr-FR') : '—'}</td>
                              <td className="border-r-2 border-black px-2 py-2 text-right font-black tabular-nums text-rose-800">
                                {e.solde >= 0 ? e.solde.toLocaleString('fr-FR') : '—'}
                              </td>
                              <td className="px-2 py-2 text-right font-black tabular-nums text-emerald-800 underline decoration-double underline-offset-2">
                                {e.solde < 0 ? Math.abs(e.solde).toLocaleString('fr-FR') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                              <td colSpan={2} className="px-3 py-6 text-right tracking-[0.2em] underline decoration-slate-400">ARRÊTÉ DE LA BALANCE GÉNÉRALE</td>
                              <td className="border-r-2 border-black px-3 py-6 text-right bg-white ring-2 ring-black font-mono shadow-inner">{data.totalDebit.toLocaleString()} F</td>
                              <td className="border-r-2 border-black px-3 py-6 text-right bg-white text-emerald-800 font-mono shadow-inner italic">{data.totalCredit.toLocaleString()} F</td>
                              <td className="border-r-2 border-black px-3 py-6 text-right bg-slate-900 text-white font-mono shadow-2xl">
                                {data.balance.filter(x => x.solde >= 0).reduce((acc, x) => acc + x.solde,0).toLocaleString()} F
                              </td>
                              <td className="px-3 py-6 text-right bg-slate-800 text-emerald-400 font-mono shadow-2xl italic border-l-2 border-white">
                                {data.balance.filter(x => x.solde < 0).reduce((acc, x) => acc + Math.abs(x.solde),0).toLocaleString()} F
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

      {/* Rendu masqué pour l'impression système direct */}
      <div className="hidden print:block absolute inset-0 bg-white shadow-2xl">
        {data && chunkArray(data.balance, 18).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="BALANCE DES COMPTES RÉVISÉE"
              subtitle="SYSCOHADA - Synthèse des soldes — Impression Directe"
              dateRange={{ start: dateDebut, end: dateFin }}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              hideHeader={index > 0}
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner font-sans">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border-r-2 border-black px-2 py-3 text-left">N° Compte</th>
                    <th className="border-r-2 border-black px-2 py-3 text-left italic">Intitulé Officiel</th>
                    <th className="border-r-2 border-black px-2 py-3 text-right">MVT Débit</th>
                    <th className="border-r-2 border-black px-2 py-3 text-right">MVT Crédit</th>
                    <th className="border-r-2 border-black px-2 py-3 text-right">Solde Déb</th>
                    <th className="px-2 py-3 text-right italic shadow-inner">Solde Cré</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((e, idx) => (
                    <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors shadow-sm italic">
                      <td className="border-r-2 border-black px-2 py-2 font-black whitespace-nowrap text-blue-900">{e.compte.numero}</td>
                      <td className="border-r-2 border-black px-2 py-2 font-black uppercase text-[12px] leading-tight truncate max-w-[200px] text-slate-700">{e.compte.libelle}</td>
                      <td className="border-r-2 border-black px-2 py-2 text-right tabular-nums font-black">{e.soldeDebit.toLocaleString()} F</td>
                      <td className="border-r-2 border-black px-2 py-2 text-right font-black tabular-nums text-emerald-800 bg-emerald-50/10 shadow-inner">{e.soldeCredit.toLocaleString()} F</td>
                      <td className="border-r-2 border-black px-2 py-2 text-right font-black tabular-nums text-rose-800">
                        {e.solde >= 0 ? e.solde.toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-black tabular-nums text-emerald-800 underline decoration-double shadow-inner">
                        {e.solde < 0 ? Math.abs(e.solde).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                      <td colSpan={2} className="px-3 py-6 text-right tracking-[0.2em] underline decoration-slate-400">ARRÊTÉ DE LA BALANCE GÉNÉRALE</td>
                      <td className="border-r-2 border-black px-3 py-6 text-right bg-white ring-2 ring-black font-mono shadow-inner">{data.totalDebit.toLocaleString()} F</td>
                      <td className="border-r-2 border-black px-3 py-6 text-right bg-white text-emerald-800 font-mono shadow-inner italic">{data.totalCredit.toLocaleString()} F</td>
                      <td className="border-r-2 border-black px-3 py-6 text-right bg-slate-900 text-white font-mono shadow-2xl">
                        {data.balance.filter(x => x.solde >= 0).reduce((acc, x) => acc + x.solde, 0).toLocaleString()} F
                      </td>
                      <td className="px-3 py-6 text-right bg-slate-800 text-emerald-400 font-mono shadow-2xl italic border-l-2 border-white">
                        {data.balance.filter(x => x.solde < 0).reduce((acc, x) => acc + Math.abs(x.solde), 0).toLocaleString()} F
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
  )
}
