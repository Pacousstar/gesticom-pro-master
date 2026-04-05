'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, Download, Filter, Wallet, FileText, Landmark, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

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
    setCurrentPage(1)
    fetchData(startDate, endDate)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Soldes Clients</h1>
          <p className="text-sm text-white/90 font-medium">Synthèse financière globale par client</p>
        </div>
        <button 
          onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 500); }}
          disabled={isPrinting}
          className="flex items-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-50 px-6 py-3 text-sm font-black text-emerald-800 hover:bg-emerald-100 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} 
          IMPRIMER LE RÉCAPITULATIF
        </button>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500 p-2 text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Total Factures</p>
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
              <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Total Paiements</p>
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
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Variation Période</p>
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
                Solde Net Global
              </p>
              <p className="text-xl font-bold text-gray-900">{totals.soldeClient.toLocaleString('fr-FR')} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex flex-col md:flex-row gap-3">
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
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">N° Facture</th>
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

      {/* Zone d'impression des Soldes Clients */}
      <div className="hidden print:block font-sans text-black bg-white p-4">
        <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">{entreprise?.nomEntreprise || 'GESTICOM PRO'}</h1>
            <p className="text-sm font-bold uppercase">{entreprise?.localisation || 'Localisation'}</p>
            <p className="text-xs font-medium text-gray-700">{entreprise?.contact || 'Contact'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-gray-800 uppercase italic">Soldes des Clients</h2>
            <p className="text-sm font-bold">{new Date().toLocaleDateString('fr-FR')}</p>
            <p className="text-[10px] uppercase text-gray-500 font-bold italic">
              Période du {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <table className="w-full text-xs border-collapse border-2 border-black">
          <thead>
            <tr className="bg-gray-200 uppercase font-black">
              <th className="border-2 border-black px-2 py-2 text-left">Code</th>
              <th className="border-2 border-black px-2 py-2 text-left">Nom du Client</th>
              <th className="border-2 border-black px-2 py-2 text-right">Facturation</th>
              <th className="border-2 border-black px-2 py-2 text-right">Encaissements</th>
              <th className="border-2 border-black px-2 py-2 text-right">Variation</th>
              <th className="border-2 border-black px-2 py-2 text-right">Solde Global</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((c) => (
              <tr key={c.id} className="border-b border-gray-300">
                <td className="border-2 border-black px-2 py-1 font-mono">{c.code || '-'}</td>
                <td className="border-2 border-black px-2 py-1 font-bold uppercase">{c.nom}</td>
                <td className="border-2 border-black px-2 py-1 text-right">{c.factures.toLocaleString('fr-FR')} F</td>
                <td className="border-2 border-black px-2 py-1 text-right text-emerald-700 font-medium">{c.paiements.toLocaleString('fr-FR')} F</td>
                <td className="border-2 border-black px-2 py-1 text-right italic">{c.variationPeriode.toLocaleString('fr-FR')} F</td>
                <td className={`border-2 border-black px-2 py-1 text-right font-black ${c.statut === 'DOIT' ? 'text-red-700 bg-red-50' : c.statut === 'CREDIT' ? 'text-blue-700' : 'text-green-700'}`}>
                  {c.soldeClient.toLocaleString('fr-FR')} F
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold">
            <tr className="bg-gray-900 text-white font-black uppercase italic">
              <td colSpan={2} className="border-2 border-black px-3 py-4 text-right text-sm">TOTAUX GÉNÉRAUX</td>
              <td className="border-2 border-black px-3 py-4 text-right">{totals.factures.toLocaleString('fr-FR')} F</td>
              <td className="border-2 border-black px-3 py-4 text-right text-emerald-200">{totals.paiements.toLocaleString('fr-FR')} F</td>
              <td className="border-2 border-black px-3 py-4 text-right">{totals.variationPeriode.toLocaleString('fr-FR')} F</td>
              <td className="border-2 border-black px-3 py-4 text-right text-2xl underline decoration-double tracking-tighter">
                {totals.soldeClient.toLocaleString('fr-FR')} F
              </td>
            </tr>
          </tfoot>
        </table>
        
        <div className="mt-12 flex justify-between items-end">
           <p className="text-[10px] italic text-gray-500 uppercase font-black">Document de synthèse commerciale - Gesticom Pro</p>
           <div className="text-center w-64 border-t-2 border-black pt-2">
              <p className="text-xs font-black uppercase">Visa Direction Commerciale</p>
              <div className="h-20"></div>
           </div>
        </div>
      </div>
    </div>
  )
}
