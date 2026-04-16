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
                          {/* T-2 AUDIT : Numérotation continue inter-pages corrigée */}
                          {index === 0 ? idx + 1 : 15 + (index - 1) * 23 + idx + 1}
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


      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Soldes Clients</h1>
          <p className="text-sm text-white/90 font-medium">Synthèse financière globale par client</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const params = new URLSearchParams()
              if (startDate) params.set('dateDebut', startDate)
              if (endDate) params.set('dateFin', endDate)
              if (search) params.set('q', search)
              window.location.href = `/api/clients/soldes/export-excel?${params.toString()}`
            }}
            disabled={loading || filteredData.length === 0}
            className="flex items-center gap-2 rounded-xl border-2 border-slate-800 bg-white px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-50 shadow-lg transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            <Download className="h-5 w-5" />
            EXCEL
          </button>
          <button 
            onClick={handleDirectPrint}
            disabled={loading || filteredData.length === 0 || isPrinting}
            className="flex items-center gap-2 rounded-xl border-2 border-slate-800 bg-white px-6 py-3 text-sm font-black text-slate-900 hover:bg-slate-50 shadow-lg transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            {isPrinting ? <Loader2 className="h-5 w-5 animate-spin mx-auto text-orange-500" /> : <Printer className="h-5 w-5" />} 
            IMPRIMER
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

      {/* Cartes de Totaux */}
      {/* T-5 AUDIT : Badge ⚠️ Filtré quand search est actif */}
      {search && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 no-print">
          ⚠️ Filtre actif : les totaux ci-dessous ne concernent que les clients correspondant à « {search} » — ils ne représentent pas le portefeuille global.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 no-print">
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Total Factures{search && ' ⚠️'}</p>
              <p className="text-xl font-bold text-gray-900">{totals.factures.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-100 bg-green-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500 p-2 text-white">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Total Paiements{search && ' ⚠️'}</p>
              <p className="text-xl font-bold text-gray-900">{totals.paiements.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500 p-2 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Variation Période{search && ' ⚠️'}</p>
              <p className="text-xl font-bold text-gray-900">{totals.variationPeriode.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>

        <div className={`rounded-xl border p-4 shadow-sm ${totals.soldeClient > 0 ? 'border-red-100 bg-red-50/50' : 'border-emerald-100 bg-emerald-50/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 text-white ${totals.soldeClient > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-xs font-medium uppercase tracking-wider ${totals.soldeClient > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                Solde Net Global{search && ' ⚠️'}
              </p>
              <p className="text-xl font-bold text-gray-900">{totals.soldeClient.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex flex-col md:flex-row gap-3 no-print">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-2 items-end bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <button type="submit" className="bg-orange-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-orange-700 flex items-center gap-2 h-[34px]">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="flex-1 flex items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code ou localisation..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-10 pr-4 mt-auto text-sm focus:border-orange-500 focus:outline-none shadow-sm transition-all h-[34px]"
            />
          </div>
        </div>
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Dernière Facture</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Code / Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Localisation</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Total Factures (Période)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Paiements (Période)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 underline decoration-red-200">Reste à payer (PÉRIODE)</th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-900 bg-orange-50 font-black">Solde Global Client</th>
                  <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500">Statut Global</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedData.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-bold text-orange-600">
                      {c.derniereFacture || '—'}
                      {c.derniereBon && (
                        <div className="text-[10px] font-black text-slate-400 mt-0.5" title="Numéro de BON associé">
                          BON: {c.derniereBon}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div 
                        className="flex flex-col cursor-pointer hover:text-orange-600 transition-colors"
                        onClick={() => router.push(`/dashboard/clients/soldes/${c.id}`)}
                      >
                        <span className="text-xs font-mono font-bold text-gray-400 uppercase">{c.code || 'SANS CODE'}</span>
                        <span className="font-semibold text-gray-900 group-hover:text-orange-600">{c.nom}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 italic">
                      {c.localisation || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-600">
                      {c.factures.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-emerald-600">
                      {c.paiements.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-amber-600">
                      {c.variationPeriode.toLocaleString('fr-FR')} F
                    </td>
                    <td 
                      className={`whitespace-nowrap px-6 py-4 text-right text-sm font-bold cursor-pointer hover:bg-orange-50 transition-all ${c.statut === 'DOIT' ? 'text-red-600' : c.statut === 'CREDIT' ? 'text-blue-600' : 'text-emerald-700'}`}
                      onClick={() => router.push(`/dashboard/clients/soldes/${c.id}`)}
                    >
                      {c.soldeClient.toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                        c.statut === 'DOIT' ? 'bg-red-100 text-red-800' :
                        c.statut === 'CREDIT' ? 'bg-blue-100 text-blue-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.statut === 'DOIT' ? 'DOIT' : c.statut === 'CREDIT' ? 'EN CRÉDIT' : 'SOLDÉ'}
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
