'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Download, Filter, Wallet, FileText, Landmark, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface SoldeClient {
  id: number
  code: string | null
  nom: string
  telephone: string | null
  ncc: string | null
  localisation: string | null
  factures: number
  paiements: number
  soldeInitial: number
  variationPeriode: number
  soldeClient: number
  statut: 'DOIT' | 'SOLDE' | 'CREDIT'
  derniereFacture: string | null
  derniereBon: string | null
}

export default function SoldesClientsPage() {
  const router = useRouter()
  const [data, setData] = useState<SoldeClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const { error: showError } = useToast()
  const [isPrinting, setIsPrinting] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
  }, [])

  const fetchData = async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/soldes?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d)) {
          setData(d)
        } else {
          setData([])
          showError('Format de données invalide reçu du serveur.')
        }
      } else {
        showError('Impossible de charger les soldes.')
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

  const handleDirectPrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 1000)
  }

  const filteredData = Array.isArray(data) ? data.filter(c => 
    c.nom.toLowerCase().includes(search.toLowerCase()) || 
    (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
    (c.localisation && c.localisation.toLowerCase().includes(search.toLowerCase()))
  ) : []

  const totals = filteredData.reduce((acc, c) => ({
    factures: acc.factures + c.factures,
    paiements: acc.paiements + c.paiements,
    variationPeriode: acc.variationPeriode + c.variationPeriode,
    soldeClient: acc.soldeClient + c.soldeClient
  }), { factures: 0, paiements: 0, variationPeriode: 0, soldeClient: 0 })

  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)

  return (
    <div className="space-y-6">
      {/* Rendu Système (Impression Native) */}
      {/* ZONE D'IMPRESSION (Masquée à l'écran, optimisée pour éviter la page blanche) */}
      <div className="hidden print:block bg-white w-full">
        {filteredData.length > 0 ? (
          paginateArray(filteredData, 15, 23).map((chunk, index, allChunks) => (
            <div key={index} className="page-break">
              <ListPrintWrapper
                title="ÉTAT SYNTHÉTIQUE DES SOLDES CLIENTS"
                subtitle={`Point Financier Global au ${new Date().toLocaleDateString('fr-FR')}`}
                pageNumber={index + 1}
                totalPages={allChunks.length}
                enterprise={entreprise}
                layout="landscape"
                hideVisa={index < allChunks.length - 1}
              >
                <table className="w-full text-[14px] border-collapse border-2 border-black font-sans">
                  <thead>
                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                      <th className="border border-black px-2 py-3 text-center w-10">N°</th>
                      <th className="border border-black px-3 py-3 text-left">Nom du Client</th>
                      <th className="border border-black px-3 py-3 text-right">Engagements</th>
                      <th className="border border-black px-3 py-3 text-right">Variations</th>
                      <th className="border border-black px-3 py-3 text-right font-black bg-gray-50 underline decoration-double">SOLDE GLOBAL NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((c, idx) => (
                      <tr key={idx} className="border-b border-black">
                        <td className="border border-black px-2 py-2 text-center font-bold">
                          {(index === 0 ? 0 : 15 + (index - 1) * 23) + idx + 1}
                        </td>
                        <td className="border border-black px-3 py-2">
                          <div className="font-black uppercase text-[13px]">{c.nom}</div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.code || 'SANS CODE'}</div>
                        </td>
                        <td className="border border-black px-3 py-2 text-right font-medium">{c.factures.toLocaleString()} F</td>
                        <td className={`border border-black px-3 py-2 text-right font-bold ${c.variationPeriode >= 0 ? 'text-gray-600' : 'text-blue-800'}`}>
                          {c.variationPeriode.toLocaleString()} F
                        </td>
                        <td className={`border border-black px-3 py-2 text-right font-black text-lg ${c.statut === 'DOIT' ? 'text-red-900 bg-red-50/30' : 'text-emerald-800 bg-emerald-50/30'}`}>
                          {c.soldeClient.toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {index === allChunks.length - 1 && (
                    <tfoot>
                      <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-inner">
                        <td className="border border-black px-2 py-6 text-center bg-white">{filteredData.length}</td>
                        <td className="border border-black px-3 py-6 text-right tracking-widest bg-white">TOTAUX DES ENCOURS CLIENTS :</td>
                        <td className="border border-black px-3 py-6 text-right tabular-nums bg-white shadow-inner">
                          {totals.factures.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-6 text-right tabular-nums bg-white shadow-inner">
                          {totals.variationPeriode.toLocaleString()} F
                        </td>
                        <td className="border border-black px-3 py-6 text-right text-2xl tabular-nums bg-slate-900 text-white shadow-2xl">
                          {totals.soldeClient.toLocaleString()} F
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </ListPrintWrapper>
            </div>
          ))
        ) : (
          <div className="p-20 text-center font-black uppercase italic text-gray-400">
            Aucune donnée de solde disponible pour l'impression.
          </div>
        )}
      </div>

      {/* La modale d'aperçu a été supprimée au profit de l'impression directe */}


      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
             <Landmark className="h-8 w-8" />
             Soldes & Créances
          </h1>
          <p className="mt-1 text-white/90 font-medium italic">Tableau de bord de la solvabilité clients et suivi des encours</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => {
              const params = new URLSearchParams()
              if (startDate) params.set('dateDebut', startDate)
              if (endDate) params.set('dateFin', endDate)
              if (search) params.set('q', search)
              window.location.href = `/api/clients/soldes/export-excel?${params.toString()}`
            }}
            disabled={loading || filteredData.length === 0}
            className="group flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="h-5 w-5" />
            EXPORTER EXCEL
          </button>
          <button 
            onClick={handleDirectPrint}
            disabled={loading || filteredData.length === 0 || isPrinting}
            className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : <Printer className="h-5 w-5" />} 
            IMPRIMER L'ÉTAT
          </button>
        </div>
      </div>

      {isPrinting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md no-print">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-4 border-orange-500 transform scale-110">
            <Loader2 className="h-16 w-16 animate-spin mx-auto text-orange-500 mb-6" />
            <h3 className="text-2xl font-black text-gray-900 uppercase italic">Préparation Financière</h3>
            <p className="mt-2 text-gray-600 font-bold uppercase text-[11px] tracking-widest">
              Génération du rapport des soldes en cours...
            </p>
          </div>
        </div>
      )}

      {/* Cartes de Totaux (Analyse de Compteur) */}
      <div className="space-y-2 no-print">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] ml-6 italic">Analyse des flux financiers tiers</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Facturé", val: totals.factures.toLocaleString('fr-FR') + ' F', icon: FileText, color: "from-blue-600 to-indigo-700", sub: "Volume général" },
            { label: "Total Payé", val: totals.paiements.toLocaleString('fr-FR') + ' F', icon: Wallet, color: "from-emerald-600 to-teal-700", sub: "Recouvrements" },
            { label: "Variation Période", val: totals.variationPeriode.toLocaleString('fr-FR') + ' F', icon: Landmark, color: "from-indigo-500 to-purple-600", sub: "Flux période" },
            { 
              label: "Net à Recouvrer", 
              val: totals.soldeClient.toLocaleString('fr-FR') + ' F', 
              icon: Filter, 
              color: totals.soldeClient > 0 ? "from-orange-500 to-rose-600" : "from-emerald-500 to-teal-600",
              sub: totals.soldeClient > 0 ? "Créances clients" : "Avoirs clients"
            },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${c.color} p-6 h-36 shadow-2xl transition-all border border-white/10 group`}>
               <div className="relative z-10 text-white flex flex-col justify-between h-full">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                    <c.icon className="h-4 w-4" />
                    {c.label}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter italic">{c.val}</h3>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                  </div>
               </div>
               <c.icon className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>
      </div>

      {/* Barre de recherche & Filtres */}
      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-slate-800/50 border border-slate-700 p-4 backdrop-blur-sm shadow-xl no-print">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Rechercher un client (nom, code, localisation)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-2xl border-2 border-slate-700 bg-slate-900/50 py-3 pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-600 focus:border-orange-500 focus:outline-none transition-all"
          />
        </div>
        
        <form onSubmit={handleFilter} className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">Dès le</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-bold text-white focus:border-orange-500 focus:outline-none transition-all"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-500 uppercase ml-2 mb-1">jusqu'au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border-2 border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-bold text-white focus:border-orange-500 focus:outline-none transition-all"
            />
          </div>
          <button type="submit" className="mt-4 flex items-center gap-2 rounded-xl bg-slate-700 px-6 py-2.5 text-sm font-black text-white hover:bg-slate-600 transition-all shadow-lg active:scale-95">
            <Filter className="h-4 w-4" /> FILTRER
          </button>
        </form>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm no-print">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic">Aucun client trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dernière Opération</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Partenaire / Identifiant</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Localisation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Facturation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Règlements</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 bg-orange-50/50">Variation</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 bg-slate-100">Solde Global Net</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedData.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-6 py-4 text-sm font-black text-orange-600 italic">
                      {c.derniereFacture || '—'}
                      {c.derniereBon && (
                        <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          <FileText className="h-3 w-3" /> BON: {c.derniereBon}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 cursor-pointer" onClick={() => router.push(`/dashboard/clients/soldes/${c.id}`)}>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{c.code || 'SANS CODE'}</span>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors uppercase italic">{c.nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 italic uppercase">
                      {c.localisation || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-slate-700">
                      {c.factures.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-emerald-600">
                      {c.paiements.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-orange-500 bg-orange-50/30">
                      {c.variationPeriode >= 0 ? '+' : ''}{c.variationPeriode.toLocaleString('fr-FR')} F
                    </td>
                    <td 
                      className={`whitespace-nowrap px-6 py-4 text-right text-base font-black italic tabular-nums bg-slate-50/50 ${c.statut === 'DOIT' ? 'text-rose-600' : c.statut === 'CREDIT' ? 'text-blue-600' : 'text-emerald-700'}`}
                    >
                      {c.soldeClient.toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black tracking-widest uppercase ${
                        c.statut === 'DOIT' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        c.statut === 'CREDIT' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${c.statut === 'DOIT' ? 'bg-rose-500' : c.statut === 'CREDIT' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                        {c.statut === 'DOIT' ? 'DOIT' : c.statut === 'CREDIT' ? 'AVOIR' : 'SOLDÉ'}
                      </span>
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
    </div>
  )
}
