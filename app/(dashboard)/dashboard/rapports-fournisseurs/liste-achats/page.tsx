'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2, Download, Filter, ShoppingBag, Truck, Calendar, CreditCard, Warehouse, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

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
}

export default function ListeAchatsPage() {
  const [data, setData] = useState<AchatListe[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [search, setSearch] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)
  const { error: showError } = useToast()

  useEffect(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setStartDate(start)
    setEndDate(end)
    fetchData(start, end)
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

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchData(startDate, endDate)
  }

  const filteredData = data.filter(a => 
    a.numero.toLowerCase().includes(search.toLowerCase()) || 
    a.fournisseur.toLowerCase().includes(search.toLowerCase())
  )

  const totalAchats = filteredData.reduce((acc, a) => acc + a.montantTotal, 0)
  const totalPaye = filteredData.reduce((acc, a) => acc + a.montantPaye, 0)
  const totalReste = totalAchats - totalPaye

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Journal des Achats</h1>
          <p className="text-sm text-white/90 font-medium">Récapitulatif de tous les approvisionnements et règlements fournisseurs</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 1000); }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-indigo-500 bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-800 hover:bg-indigo-100 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            Imprimer Journal
          </button>
          <button 
            onClick={() => {/* Logique Excel */}}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all no-print"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* Cartes de Totaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Achats du Journal</span>
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-indigo-900">{totalAchats.toLocaleString('fr-FR')} F</p>
        </div>
        
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Règlements Effectués</span>
            <CreditCard className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-emerald-900">{totalPaye.toLocaleString('fr-FR')} F</p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-black uppercase tracking-widest">Reste à Payer</span>
            <Filter className="h-5 w-5" />
          </div>
          <p className="text-3xl font-black text-rose-900">{totalReste.toLocaleString('fr-FR')} F</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end flex-1">
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 underline decoration-indigo-200">Date Début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-xs font-black text-gray-500 uppercase mb-1 underline decoration-indigo-200">Date Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 h-[41px]">
            <Filter className="h-4 w-4" /> Filtrer Achats
          </button>
        </form>

        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Référence ou Fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-[9px] pl-10 pr-4 focus:border-indigo-500 focus:outline-none shadow-sm text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : filteredData.length === 0 ? (
          <p className="py-12 text-center text-gray-500 italic font-medium underline decoration-indigo-50">Aucun achat enregistré sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Référence / Date</th>
                  <th className="px-6 py-4 text-left text-xs font-black uppercase text-gray-500">Fournisseur / Magasin</th>
                  <th className="px-6 py-4 text-center text-xs font-black uppercase text-gray-500">Paiement</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Total Achat</th>
                  <th className="px-6 py-4 text-right text-xs font-black uppercase text-gray-500">Réglé / Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredData.map((a) => (
                  <tr key={a.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-gray-900 group-hover:text-indigo-600">{a.numero}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" /> {new Date(a.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">{a.fournisseur}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Warehouse className="h-3 w-3" /> {a.magasin}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                          {a.modePaiement}
                        </span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${a.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {a.statutPaiement}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-black text-indigo-900 bg-indigo-50/10">
                      {a.montantTotal.toLocaleString('fr-FR')} F
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-600">{a.montantPaye.toLocaleString('fr-FR')} F</span>
                          <span className={`text-[10px] font-bold ${a.montantTotal - a.montantPaye > 0 ? 'text-rose-500' : 'text-gray-300'}`}>
                            {(a.montantTotal - a.montantPaye).toLocaleString('fr-FR')} F
                          </span>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Zone d'impression professionnelle standardisée */}
      <ListPrintWrapper
        title="Journal des Achats"
        subtitle="Rapport consolidé des approvisionnements"
        dateRange={{ start: startDate, end: endDate }}
      >
        <table className="w-full text-[10px] border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 uppercase font-black text-gray-700">
              <th className="border border-gray-300 px-3 py-3 text-left">Référence / Date</th>
              <th className="border border-gray-300 px-3 py-3 text-left">Fournisseur / Magasin</th>
              <th className="border border-gray-300 px-3 py-3 text-center">Paiement</th>
              <th className="border border-gray-300 px-3 py-3 text-right">Montant Total</th>
              <th className="border border-gray-300 px-3 py-3 text-right">Montant Réglé</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((a, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="border border-gray-300 px-3 py-2">
                  <span className="font-bold">{a.numero}</span><br/>
                  <small className="italic text-gray-500">{new Date(a.date).toLocaleDateString('fr-FR')}</small>
                </td>
                <td className="border border-gray-300 px-3 py-2 uppercase">
                   {a.fournisseur}<br/>
                   <small className="font-normal italic text-gray-500">{a.magasin}</small>
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-[9px] uppercase font-bold">
                  {a.modePaiement} / {a.statutPaiement}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right font-black italic">
                   {a.montantTotal.toLocaleString('fr-FR')} F
                </td>
                <td className={`border border-gray-300 px-3 py-2 text-right font-bold ${a.statutPaiement === 'PAYE' ? 'text-emerald-700' : 'text-rose-700'}`}>
                   {a.montantPaye.toLocaleString('fr-FR')} F
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
             <tr className="bg-gray-50 font-black text-sm">
                <td colSpan={3} className="border border-gray-300 px-3 py-4 text-right uppercase italic">Totaux du Journal</td>
                <td className="border border-gray-300 px-3 py-4 text-right text-indigo-700">
                   {totalAchats.toLocaleString('fr-FR')} F
                </td>
                <td className="border border-gray-300 px-3 py-4 text-right text-emerald-700">
                   {totalPaye.toLocaleString('fr-FR')} F
                </td>
             </tr>
          </tfoot>
        </table>
      </ListPrintWrapper>

      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print, button, form { display: none !important; }
          body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
