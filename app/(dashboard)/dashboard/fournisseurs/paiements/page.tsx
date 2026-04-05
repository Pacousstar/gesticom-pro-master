'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Loader2, Calendar, User, CreditCard, Hash, Coins, Download, Filter, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

interface PaiementFournisseur {
  id: number
  date: string
  fournisseurCode: string | null
  fournisseurNom: string
  modePaiement: string
  achatNumero: string
  montant: number
  observation: string | null
}

export default function PaiementsFournisseursPage() {
  const [data, setData] = useState<PaiementFournisseur[]>([])
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
    // Par défaut, derniers 30 jours (au lieu du calendrier fixe) pour assurer la visibilité le 1er du mois
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
      const res = await fetch(`/api/fournisseurs/paiements?dateDebut=${start}&dateFin=${end}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      } else {
        showError('Impossible de charger les paiements.')
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

  const filteredData = Array.isArray(data) ? data.filter(p => 
    (p.fournisseurNom || '').toLowerCase().includes(search.toLowerCase()) || 
    (p.achatNumero || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.fournisseurCode && p.fournisseurCode.toLowerCase().includes(search.toLowerCase()))
  ) : []

  const total = filteredData.reduce((acc, p) => acc + p.montant, 0)
  
  const paginatedData = Array.isArray(filteredData) ? filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : []
  const totalPages = Math.ceil((Array.isArray(filteredData) ? filteredData.length : 0) / itemsPerPage)
  
  const totalsByMode = useMemo(() => {
    const modes: Record<string, number> = {}
    filteredData.forEach(p => {
      modes[p.modePaiement] = (modes[p.modePaiement] || 0) + p.montant
    })
    return modes
  }, [filteredData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Décaissements Fournisseurs</h1>
          <p className="text-sm text-white/90 font-medium">Historique des paiements effectués par période</p>
        </div>
        <button 
          onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 500); }}
          disabled={isPrinting}
          className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-50 px-6 py-3 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />} 
          IMPRIMER LE JOURNAL
        </button>
      </div>

      {/* Zone d'impression des Décaissements Fournisseurs */}
      <div className="hidden print:block font-sans text-black bg-white p-4">
        <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">{entreprise?.nomEntreprise || 'GESTICOM PRO'}</h1>
            <p className="text-sm font-bold uppercase">{entreprise?.localisation || 'Localisation'}</p>
            <p className="text-xs font-medium text-gray-700">{entreprise?.contact || 'Contact'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-gray-800 uppercase italic">Journal des Décaissements</h2>
            <p className="text-sm font-bold">{new Date().toLocaleDateString('fr-FR')}</p>
            <p className="text-[10px] uppercase text-gray-500 font-bold italic">
              Période du {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        <table className="w-full text-xs border-collapse border-2 border-black">
          <thead>
            <tr className="bg-gray-200 uppercase font-black">
              <th className="border-2 border-black px-2 py-2 text-left">Date</th>
              <th className="border-2 border-black px-2 py-2 text-left">Fournisseur</th>
              <th className="border-2 border-black px-2 py-2 text-left">Mode</th>
              <th className="border-2 border-black px-2 py-2 text-left">Réf. Achat</th>
              <th className="border-2 border-black px-2 py-2 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((p, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="border-2 border-black px-2 py-1 text-[10px]">
                  {new Date(p.date).toLocaleString('fr-FR')}
                </td>
                <td className="border-2 border-black px-2 py-1 font-bold uppercase">{p.fournisseurNom}</td>
                <td className="border-2 border-black px-2 py-1">{p.modePaiement}</td>
                <td className="border-2 border-black px-2 py-1 font-mono">{p.achatNumero}</td>
                <td className="border-2 border-black px-2 py-1 text-right font-black">
                  {p.montant.toLocaleString('fr-FR')} F
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-bold">
            <tr className="bg-gray-900 text-white font-black uppercase italic">
              <td colSpan={4} className="border-2 border-black px-3 py-4 text-right text-sm tracking-widest">TOTAL DÉCAISSÉ (PÉRIODE)</td>
              <td className="border-2 border-black px-3 py-4 text-right text-2xl underline decoration-double tracking-tighter">
                {total.toLocaleString('fr-FR')} F
              </td>
            </tr>
          </tfoot>
        </table>
        
        <div className="mt-12 flex justify-between items-end">
           <p className="text-[10px] italic text-gray-500 uppercase font-black">Document de contrôle financier - Gesticom Pro</p>
           <div className="text-center w-64 border-t-2 border-black pt-2">
              <p className="text-xs font-black uppercase">Visa Direction Comptable</p>
              <div className="h-20"></div>
           </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-2 items-end bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Du</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-1">Au</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <button type="submit" className="bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700 flex items-center gap-2 h-[34px]">
            <Filter className="h-4 w-4" /> Filtrer
          </button>
        </form>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher (fournisseur, réf)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-purple-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Résumé par mode de paiement */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="rounded-lg bg-purple-100 px-4 py-3 border border-purple-200 md:col-span-2 shadow-sm">
          <p className="text-sm text-purple-800 font-bold uppercase">Total Décaissé (Période)</p>
          <p className="text-2xl font-black text-purple-900">{total.toLocaleString('fr-FR')} F</p>
        </div>
        {Object.entries(totalsByMode).map(([mode, sum]) => (
          <div key={mode} className="rounded-lg bg-white px-4 py-3 border border-gray-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs text-gray-500 font-bold uppercase truncate">{mode}</p>
            <p className="text-lg font-bold text-gray-900">{sum.toLocaleString('fr-FR')} F</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic">Aucun paiement fournisseur sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Date</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><User className="h-3 w-3" /> Fournisseur</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><CreditCard className="h-3 w-3" /> Mode</div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2"><Hash className="h-3 w-3" /> Réf. Achat</div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    <div className="flex items-center gap-2 justify-end"><Coins className="h-3 w-3" /> Montant</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paginatedData.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {new Date(p.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{p.fournisseurNom}</span>
                        <span className="text-xs text-gray-400 uppercase">{p.fournisseurCode || '—'}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {p.modePaiement}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                      {p.achatNumero}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-gray-900">
                      {p.montant.toLocaleString('fr-FR')} F
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
      {/* Styles Print */}
      <style jsx global>{`
        @media print {
          nav, aside, button, .no-print { display: none !important; }
          .print-document, body { background: white !important; padding: 10px !important; margin: 0 !important; }
          .rounded-xl { border: none !important; box-shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
          td, th { border: 1px solid #e5e7eb !important; padding: 8px !important; font-size: 10px !important; }
        }
      `}</style>
    </div>
  )
}
