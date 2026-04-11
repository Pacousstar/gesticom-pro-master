'use client'

import { useState, useEffect } from 'react'
import { Printer, Loader2, ArrowLeft, Filter, Search, X } from 'lucide-react'
import Link from 'next/link'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type Depense = {
  id: number
  date: string
  categorie: string
  libelle: string
  montant: number
  modePaiement: string
  beneficiaire: string | null
  magasin: { id: number; code: string; nom: string } | null
}

const CATEGORIES = [
  'LOYER', 'SALAIRES', 'TRANSPORT', 'COMMUNICATION', 'MAINTENANCE', 'FOURNITURES', 'PUBLICITE', 
  'ASSURANCE', 'IMPOTS', 'FRAIS_BANCAIRES', 'AMORTISSEMENT', 'PROVISION', 'INTERETS', 
  'FRAIS_JURIDIQUES', 'FRAIS_COMPTABLES', 'FORMATION', 'CARBURANT', 'TELEPHONE', 'INTERNET', 
  'NETTOYAGE', 'SECURITE', 'GARDENNAGE', 'REPARATION', 'AUTRE'
]

export default function DepenseJournalPage() {
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [loading, setLoading] = useState(true)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  
  // Filtres
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [magasins, setMagasins] = useState<{ id: number; nom: string }[]>([])
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [enterprise, setEnterprise] = useState<any>(null)

  useEffect(() => {
    fetch('/api/parametres').then(r => r.ok && r.json()).then(setEnterprise).catch(() => {})
    fetch('/api/magasins').then(r => r.ok && r.json()).then(setMagasins)
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = now.toISOString().split('T')[0]
    setDateDebut(start)
    setDateFin(end)
    fetchData(start, end, '', '', '')
  }, [])

  const fetchData = async (start: string, end: string, cat: string, mag: string, search: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '10000' }) // On veut tout pour le journal
      if (start) params.set('dateDebut', start)
      if (end) params.set('dateFin', end)
      if (cat) params.set('categorie', cat)
      if (mag) params.set('magasinId', mag)
      if (search) params.set('search', search)

      const res = await fetch('/api/depenses?' + params.toString())
      if (res.ok) {
        const data = await res.json()
        setDepenses(data.data || data) // Gérer les deux formats possibles de l'API
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(dateDebut, dateFin, filtreCategorie, filtreMagasin, searchTerm)
  }

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 500)
  }

  const total = depenses.reduce((acc, d) => acc + d.montant, 0)

  return (
    <div className="space-y-6">
      {/* HEADER ÉCRAN */}
      <div className="print:hidden flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/depenses" className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            <ArrowLeft className="h-5 w-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Journal des Dépenses</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aperçu pour impression détaillée</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={loading || depenses.length === 0}
            className="flex items-center gap-2 bg-slate-100 border-2 border-slate-800 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            <Printer className="h-4 w-4" />
            Aperçu Impression
          </button>
        </div>
      </div>

      {/* FILTRES ÉCRAN */}
      <div className="print:hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <form onSubmit={handleFilter} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Du</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Au</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Catégorie</label>
            <select value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500">
              <option value="">Toutes</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Libellé, bénéficiaire..." className="w-full bg-slate-50 border-none rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500" />
            </div>
          </div>
          <button type="submit" className="bg-slate-900 text-white rounded-xl py-2.5 font-black uppercase tracking-widest text-xs hover:bg-black transition-all">
            Filtrer
          </button>
        </form>
      </div>

      {/* VUE APERÇU ÉCRAN */}
      <div className="print:hidden bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Chargement du journal...</p>
          </div>
        ) : depenses.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-bold uppercase italic text-sm">Aucune donnée pour cette sélection.</p>
          </div>
        ) : (
          <div className="p-8">
            <div className="mb-6 flex justify-between items-end border-b-2 border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Aperçu du Document</h2>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Total Sélection</p>
                <p className="text-2xl font-black text-orange-600 tracking-tighter">{total.toLocaleString()} FCFA</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-inner max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-600 uppercase font-black tracking-widest">
                    <th className="p-3 text-left rounded-l-lg text-[9px]">Date</th>
                    <th className="p-3 text-left text-[9px]">Catégorie</th>
                    <th className="p-3 text-left text-[9px]">Libellé</th>
                    <th className="p-3 text-right text-[9px]">Montant</th>
                    <th className="p-3 text-left rounded-r-lg text-[9px]">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {depenses.map((d, i) => (
                    <tr key={i} className="hover:bg-white/50 transition-colors">
                      <td className="p-3 font-bold">{new Date(d.date).toLocaleDateString('fr-FR')}</td>
                      <td className="p-3 font-black text-slate-400 uppercase">{d.categorie}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800 uppercase">{d.libelle}</p>
                        {d.beneficiaire && <p className="text-[9px] text-slate-500 italic">Bénéficiaire : {d.beneficiaire}</p>}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">{d.montant.toLocaleString()} F</td>
                      <td className="p-3 uppercase text-[10px] font-black text-slate-500">{d.modePaiement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* VUE IMPRESSION (Masquée à l'écran) */}
      <div className="hidden print:block absolute inset-0 bg-white text-black">
        {chunkArray(depenses, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="Journal des Dépenses"
              subtitle={`Période du ${dateDebut || '...'} au ${dateFin || '...'}`}
              pageNumber={index + 1}
              totalPages={allChunks.length}
              hideHeader={index > 0}
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-2 border-black">
                    <th className="border-r-2 border-black px-3 py-3 text-left">Date</th>
                    <th className="border-r-2 border-black px-3 py-3 text-left">Catégorie</th>
                    <th className="border-r-2 border-black px-3 py-3 text-left">Libellé / Bénéficiaire</th>
                    <th className="border-r-2 border-black px-3 py-4 text-right">Montant</th>
                    <th className="px-3 py-3 text-left text-[11px]">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((d, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r-2 border-black px-3 py-2 whitespace-nowrap font-medium italic">{new Date(d.date).toLocaleDateString('fr-FR')}</td>
                      <td className="border-r-2 border-black px-3 py-2 font-black uppercase text-xs italic text-gray-600">{d.categorie}</td>
                      <td className="border-r-2 border-black px-3 py-2">
                        <div className="font-black uppercase leading-tight tracking-tighter italic">{d.libelle}</div>
                        {d.beneficiaire && <div className="text-[10px] font-bold opacity-60 uppercase truncate max-w-[200px]">Bénéficiaire : {d.beneficiaire}</div>}
                      </td>
                      <td className="border-r-2 border-black px-3 py-2 text-right font-black whitespace-nowrap bg-gray-50 underline decoration-double shadow-inner">{d.montant.toLocaleString()} F</td>
                      <td className="px-3 py-2 uppercase text-[10px] font-bold text-gray-500">{d.modePaiement}</td>
                    </tr>
                  ))}
                </tbody>
                {index === allChunks.length - 1 && (
                  <tfoot>
                    <tr className="bg-gray-200 font-black text-[15px] border-2 border-black uppercase italic shadow-2xl">
                        <td colSpan={3} className="px-3 py-5 text-right tracking-[0.2em] underline decoration-double">TOTAL CUMULÉ DES CHARGES DE PÉRIODE</td>
                        <td className="px-3 py-5 text-right text-[18px] bg-white ring-2 ring-black font-mono">
                          {total.toLocaleString()} F
                        </td>
                        <td className="px-3 py-5 bg-white"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION JOURNAL DÉPENSES */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter shadow-2xl">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal Charges</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Analyse détaillée des Décaissements et Flux
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-orange-600 italic uppercase">Période du {dateDebut}</span>
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic leading-none">Au {dateFin}</span>
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
              <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                {chunkArray(depenses, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                  <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                    <ListPrintWrapper
                      title="JOURNAL DÉTAILLÉ DES DÉPENSES"
                      subtitle={`Audit financier des charges - Période du ${dateDebut} au ${dateFin}`}
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                      <table className="w-full text-[14px] border-collapse border-4 border-black font-sans shadow-2xl">
                        <thead>
                          <tr className="bg-black text-white uppercase font-black border-2 border-black">
                            <th className="border-r-2 border-white px-4 py-4 text-left">Date / Cat.</th>
                            <th className="border-r-2 border-white px-4 py-4 text-left italic">Libellé & Opération</th>
                            <th className="border-r-2 border-white px-4 py-4 text-right tabular-nums tracking-tighter">Décaissement</th>
                            <th className="px-4 py-4 text-left text-[11px] bg-slate-800">Mag. / Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((d, idx) => (
                            <tr key={idx} className="border-b-2 border-black hover:bg-orange-50/30 transition-colors">
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black text-slate-800">{new Date(d.date).toLocaleDateString('fr-FR')}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{d.categorie}</div>
                              </td>
                              <td className="border-r-2 border-black px-4 py-3">
                                <div className="font-black uppercase leading-tight italic text-slate-700 tracking-tighter">{d.libelle}</div>
                                {d.beneficiaire && <div className="text-[10px] font-bold text-orange-600 uppercase mt-1 flex items-center gap-1"><span className="opacity-50 italic">Par :</span> {d.beneficiaire}</div>}
                              </td>
                              <td className="border-r-2 border-black px-4 py-3 text-right font-black tabular-nums text-lg text-rose-700 bg-gray-50/50 underline decoration-double">{d.montant.toLocaleString()} F</td>
                              <td className="px-4 py-3">
                                <div className="text-[10px] font-black uppercase text-slate-600 tracking-widest truncate">{d.magasin?.nom || 'GLOBAL'}</div>
                                <div className="text-[9px] font-bold text-slate-400 opacity-60">{d.modePaiement}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-black text-white font-black text-[18px] border-t-4 border-black uppercase italic shadow-2xl">
                                <td colSpan={2} className="px-4 py-8 text-right tracking-[0.3em] underline decoration-orange-500 decoration-4 underline-offset-8">VOLUME NET DES DÉPENSES PÉRIODE</td>
                                <td className="px-4 py-8 text-right text-3xl tabular-nums bg-slate-900 border-x-4 border-white shadow-inner font-mono ring-4 ring-slate-800">
                                  {total.toLocaleString()} F
                                </td>
                                <td className="bg-slate-900"></td>
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
