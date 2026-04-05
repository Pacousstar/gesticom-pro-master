'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Users, Search, Calendar, FileText, Download, Printer, 
  ArrowLeft, Loader2, DollarSign, CreditCard, ChevronRight,
  TrendingDown, TrendingUp, Wallet
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format-date'

type Client = {
  id: number
  nom: string
  code: string | null
  telephone: string | null
  dette: number
}

type Vente = {
  id: number
  numero: string
  date: string
  montantTotal: number
  montantPaye: number
  modePaiement: string
  statut: string
  statutPaiement: string
  lignes: Array<{
    designation: string
    quantite: number
    prixUnitaire: number
  }>
}

export default function ClientRelevesPage() {
  const searchParams = useSearchParams()
  const initialClientId = searchParams.get('id')
  const { error: showError } = useToast()

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '')
  const [dateDebut, setDateDebut] = useState<string>(() => {
    const d = new Date()
    d.setDate(1) // Premier du mois
    return d.toISOString().split('T')[0]
  })
  const [dateFin, setDateFin] = useState<string>(new Date().toISOString().split('T')[0])
  
  const [data, setData] = useState<Vente[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)

  // Chargement des clients pour le selecteur
  useEffect(() => {
    fetch('/api/clients?limit=1000')
      .then(r => r.ok ? r.json() : { data: [] })
      .then(res => {
        setClients(res.data || [])
        setLoadingClients(false)
      })
      .catch(() => setLoadingClients(false))
  }, [])

  const fetchReleve = async () => {
    if (!selectedClientId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: dateDebut,
        end: dateFin
      })
      const res = await fetch(`/api/rapports/ventes/clients/${selectedClientId}/history?${params.toString()}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        showError("Impossible de charger le relevé.")
      }
    } catch (e) {
      showError("Erreur réseau lors du chargement du relevé.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClientId) fetchReleve()
  }, [selectedClientId, dateDebut, dateFin])

  const selectedClient = clients.find(c => c.id === Number(selectedClientId))

  const totals = useMemo(() => {
    return data.reduce((acc, v) => {
      acc.du += v.montantTotal
      acc.paye += v.montantPaye
      return acc
    }, { du: 0, paye: 0 })
  }, [data])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header & Filtres */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Relevés de Comptes</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Analyse détaillée de la dette client</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={!selectedClientId || data.length === 0}
            className="flex items-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer Relevé
          </button>
        </div>
      </div>

      {/* Barre de Filtres */}
      <div className="grid gap-4 sm:grid-cols-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 no-print">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Client</label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nom} {c.code ? `(${c.code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Date Début</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-white/60 uppercase tracking-widest ml-1">Date Fin</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="w-full rounded-xl bg-white border-2 border-transparent px-4 py-3 text-sm font-bold text-gray-900 focus:border-orange-500 outline-none"
          />
        </div>
      </div>

      {selectedClientId ? (
        <>
          {/* Compteurs Professionnels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><TrendingUp className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Facturé (Période)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totals.du.toLocaleString()} F</p>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-emerald-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><TrendingDown className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payé (Période)</span>
              </div>
              <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totals.paye.toLocaleString()} F</p>
            </div>

            <div className={`bg-white rounded-[2rem] p-6 shadow-xl border-b-8 ${(totals.du - totals.paye) > 0 ? 'border-amber-500' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><CreditCard className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Période</span>
              </div>
              <p className={`text-3xl font-black tracking-tighter italic ${(totals.du - totals.paye) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {(totals.du - totals.paye).toLocaleString()} F
              </p>
            </div>

            <div className="bg-gray-900 rounded-[2rem] p-6 shadow-xl border-b-8 border-red-500">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><Wallet className="h-6 w-6" /></div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Global Client</span>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter italic">
                {(selectedClient?.dette || 0).toLocaleString()} F
              </p>
            </div>
          </div>

          {/* Tableau de transactions */}
          <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Détail des opérations
              </h3>
              <p className="text-[10px] text-gray-400 font-bold italic uppercase tracking-tighter">
                Du {formatDate(dateDebut)} au {formatDate(dateFin)}
              </p>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Génération du relevé en cours...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-gray-400 italic">Aucune transaction trouvée sur cette période.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Dû (Facturé)</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Réglé (Payé)</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Reste</th>
                      <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest no-print">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-700">{formatDate(v.date)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-gray-900 italic tracking-tight">{v.numero}</p>
                          <p className="text-[10px] text-gray-400 font-medium uppercase">{v.modePaiement}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-gray-900">{v.montantTotal.toLocaleString()} F</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-emerald-600">{v.montantPaye.toLocaleString()} F</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`text-sm font-black ${(v.montantTotal - v.montantPaye) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                            {(v.montantTotal - v.montantPaye).toLocaleString()} F
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center no-print">
                          <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${v.statutPaiement === 'PAYE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                            {v.statutPaiement === 'PAYE' ? 'SÉCURISÉ' : 'À RECOUVRER'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-900 text-white">
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest opacity-60">Totaux Période :</td>
                      <td className="px-6 py-4 text-right font-black text-lg italic tracking-tighter">{totals.du.toLocaleString()} F</td>
                      <td className="px-6 py-4 text-right font-black text-lg text-emerald-400 italic tracking-tighter">{totals.paye.toLocaleString()} F</td>
                      <td className="px-6 py-4 text-right font-black text-lg text-red-400 italic tracking-tighter">{(totals.du - totals.paye).toLocaleString()} F</td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Zone Impression Invisible (Sauf Impression) */}
          <div className="hidden print:block p-10 mt-10 border-t-4 border-gray-900 bg-white min-h-screen">
             <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-gray-100">
                <div>
                   <h1 className="text-4xl font-black uppercase tracking-tighter italic">RELEVÉ DE COMPTE</h1>
                   <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">GestiCom Pro - Gestion Financière</p>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black uppercase italic">{selectedClient?.nom}</p>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Édité le {new Date().toLocaleDateString('fr-FR')}</p>
                </div>
             </div>

             <div className="grid grid-cols-3 gap-10 mb-10">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Facturé</p>
                   <p className="text-2xl font-black italic tracking-tighter">{totals.du.toLocaleString()} F</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                   <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Total Réglé</p>
                   <p className="text-2xl font-black text-emerald-700 italic tracking-tighter">{totals.paye.toLocaleString()} F</p>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
                   <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Solde à Payer</p>
                   <p className="text-2xl font-black text-red-700 italic tracking-tighter">{(totals.du - totals.paye).toLocaleString()} F</p>
                </div>
             </div>

             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 italic">Note : Ce document ne constitue pas une facture légale mais un état de synthèse de vos opérations sur la période du {formatDate(dateDebut)} au {formatDate(dateFin)}.</p>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[2rem] p-20 shadow-xl border border-white/20 flex flex-col items-center justify-center text-center">
          <div className="p-8 bg-orange-50 rounded-full text-orange-500 mb-6 group-hover:scale-110 transition-transform">
            <Users className="h-16 w-16" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Aucun client sélectionné</h2>
          <p className="mt-2 text-gray-500 font-medium max-w-sm">Choisissez un client dans la liste ci-dessus pour générer son relevé de compte détaillé et son évolution de dette.</p>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: portrait; margin: 1.5cm; }
          .no-print { display: none !important; }
          body { background: white !important; font-family: 'Segoe UI', serif !important; padding: 0 !important; color: black !important; }
          table { width: 100% !important; border-collapse: collapse !important; margin-top: 20px; border: 1px solid #000 !important; }
          th { background: #f0f0f0 !important; border: 1px solid #000 !important; color: black !important; font-size: 10px !important; text-transform: uppercase; padding: 10px 5px !important; }
          td { border: 1px dotted #ccc !important; padding: 8px 5px !important; font-size: 10px !important; color: black !important; }
          .bg-gray-900 { background: #000 !important; color: white !important; }
          tfoot td { border-top: 2px solid #000 !important; font-weight: 800 !important; font-size: 12px !important; background: #000 !important; color: white !important; }
          h1, h2, h3 { color: black !important; }
        }
      `}</style>
    </div>
  )
}
