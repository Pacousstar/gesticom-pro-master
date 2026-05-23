'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Loader2, 
  Printer, 
  Download,
  Calendar,
  Wallet,
  TrendingUp,
  History,
  Info,
  ChevronRight,
  Truck,
  DollarSign,
  X,
  CheckCircle,
  CreditCard,
  Pencil,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

interface Operation {
  type: string
  id?: number
  libelle: string
  reference?: string
  date: string
  debit: number
  credit: number
  mode?: string
  observation?: string
}

export default function CompteCourantFournisseurPage() {
  const { id } = useParams()
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ fournisseur: any, operations: Operation[] } | null>(null)
  const [soldeTotal, setSoldeTotal] = useState(0)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('ESPECES')
  const [magasins, setMagasins] = useState<{ id: number; nom: string }[]>([])
  const [banques, setBanques] = useState<{ id: number; libelle: string; nomBanque: string }[]>([])
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('')
  const [selectedBanqueId, setSelectedBanqueId] = useState<string>('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [isPaying, setIsPaying] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [printDate, setPrintDate] = useState('')

  useEffect(() => {
    const d = new Date()
    setPrintDate(d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
  }, [])

  useEffect(() => {
    fetchData()
    fetchMagasins()
    fetchBanques()
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}/compte-courant`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
        const tot = (d.operations || []).reduce((acc: number, op: Operation) => acc + (op.credit || 0) - (op.debit || 0), 0)
        setSoldeTotal(tot)
      } else {
        showError("Erreur lors du chargement du compte courant.")
      }
    } catch (e) {
      showError("Erreur de connexion.")
    } finally {
      setLoading(false)
    }
  }

  const fetchMagasins = async () => {
    try {
      const r = await fetch('/api/magasins')
      if (r.ok) {
        const d = await r.json()
        setMagasins(Array.isArray(d) ? d : (d.data || []))
        if (Array.isArray(d) && d.length > 0) setSelectedMagasinId(String(d[0].id))
      }
    } catch {}
  }

  const fetchBanques = async () => {
    try {
      const r = await fetch('/api/banques')
      if (r.ok) {
        const d = await r.json()
        setBanques(Array.isArray(d) ? d : (d.data || []))
      }
    } catch {}
  }

  const handlePay = async () => {
    if (!payAmount || Number(payAmount) <= 0) {
      showError('Montant invalide.')
      return
    }
    if (!selectedMagasinId) {
      showError('Sélectionnez un magasin.')
      return
    }
    setIsPaying(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}/compte-courant/paiement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant: Number(payAmount),
          modePaiement: payMode,
          magasinId: Number(selectedMagasinId),
          banqueId: selectedBanqueId ? Number(selectedBanqueId) : undefined,
          date: payDate,
        })
      })
      if (res.ok) {
        showSuccess('Paiement enregistré avec succès !')
        setShowPayModal(false)
        setPayAmount('')
        // Reset other form fields
        setPayMode('ESPECES')
        setSelectedMagasinId('')
        setSelectedBanqueId('')
        setPayDate(new Date().toISOString().split('T')[0])
        fetchData()
      } else {
        const err = await res.json()
        showError(err.error || 'Erreur lors du paiement.')
        setIsPaying(false) // Make sure to stop loading on error too
      }
    } catch {
      showError('Erreur réseau.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleDeleteReglement = async (reglementId: number) => {
    if (!confirm('Supprimer ce règlement ?')) return
    setIsDeleting(reglementId)
    try {
      const res = await fetch(`/api/reglements/achats/${reglementId}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess('Règlement supprimé.')
        fetchData()
      } else {
        const err = await res.json()
        showError(err.error || 'Erreur.')
      }
    } catch {
      showError('Erreur réseau.')
    } finally {
      setIsDeleting(null)
    }
  }

  const totalDebit = (data?.operations || []).reduce((acc: number, op: Operation) => acc + (op.debit || 0), 0)
  const totalCredit = (data?.operations || []).reduce((acc: number, op: Operation) => acc + (op.credit || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 shadow transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">
              Compte Courant — {data?.fournisseur?.nom || 'Fournisseur'}
            </h1>
            <p className="text-xs text-white/50 font-bold uppercase tracking-widest">
              {data?.fournisseur?.code || '---'} · Historique des achats et paiements
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100 shadow transition-all"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-xl transition-all"
          >
            <DollarSign className="h-4 w-4" />
            Enregistrer un paiement
          </button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-2xl text-red-600"><TrendingUp className="h-6 w-6" /></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Achats</span>
          </div>
          <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totalDebit.toLocaleString()} F</p>
        </div>
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-emerald-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600"><Wallet className="h-6 w-6" /></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Payé</span>
          </div>
          <p className="text-3xl font-black text-gray-900 tracking-tighter italic">{totalCredit.toLocaleString()} F</p>
        </div>
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border-b-8 border-amber-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600"><History className="h-6 w-6" /></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dette nette</span>
          </div>
          <p className={`text-3xl font-black tracking-tighter italic ${soldeTotal > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {soldeTotal.toLocaleString()} F
          </p>
        </div>
        <div className="bg-gray-900 rounded-[2rem] p-6 shadow-xl border-b-8 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400"><CreditCard className="h-6 w-6" /></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Final</span>
          </div>
          <p className="text-3xl font-black text-white tracking-tighter italic">
            {soldeTotal.toLocaleString()} F
          </p>
        </div>
      </div>

      {/* Tableau des opérations */}
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 no-print">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
            <History className="h-4 w-4 text-gray-400" />
            Historique complet
          </h3>
        </div>
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Chargement...</p>
          </div>
        ) : !data || data.operations.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 italic">Aucune opération trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Libellé</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-red-500 uppercase tracking-widest">Dû (Achats)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Payé (Réglé)</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  let runningSolde = 0
                  return (data.operations || []).map((op, idx) => {
                    runningSolde += (op.credit || 0) - (op.debit || 0)
                    return (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-700">{formatDate(op.date)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-gray-900 italic tracking-tight">{op.reference || '—'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-700">{op.libelle}</p>
                          {op.observation && <p className="text-[10px] text-gray-400 italic">{op.observation}</p>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                            op.type === 'ACHAT' ? 'bg-red-100 text-red-700 border border-red-200' :
                            op.type === 'REGLEMENT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            op.type === 'AVOIR_INITIAL' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {op.type === 'ACHAT' ? 'Achat' :
                             op.type === 'REGLEMENT' ? 'Règlement' :
                             op.type === 'AVOIR_INITIAL' ? 'Avoir Initial' :
                             op.type === 'SOLDE_INITIAL' ? 'Solde Initial' : op.type}
                          </span>
                          {op.mode && <p className="text-[10px] text-gray-400 mt-1 uppercase">{op.mode}</p>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-red-600">{op.debit > 0 ? `${op.debit.toLocaleString()} F` : '—'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-emerald-600">{op.credit > 0 ? `${op.credit.toLocaleString()} F` : '—'}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`text-sm font-black ${runningSolde > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {runningSolde.toLocaleString()} F
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {op.type === 'REGLEMENT' && op.id ? (
                            <button
                              onClick={() => handleDeleteReglement(op.id!)}
                              disabled={isDeleting === op.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              {isDeleting === op.id ? '...' : 'Suppr.'}
                            </button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest opacity-60">Totaux :</td>
                  <td className="px-6 py-4 text-right font-black text-lg italic tracking-tighter text-red-400">{totalDebit.toLocaleString()} F</td>
                  <td className="px-6 py-4 text-right font-black text-lg italic tracking-tighter text-emerald-400">{totalCredit.toLocaleString()} F</td>
                  <td className="px-6 py-4 text-right font-black text-lg italic tracking-tighter text-white">{soldeTotal.toLocaleString()} F</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MODALE PAIEMENT */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter">
                Nouveau Paiement Fournisseur
              </h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Montant (FCFA) *</label>
                <input
                  type="number"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-lg font-bold focus:border-emerald-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date du paiement</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Mode de paiement *</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Magasin *</label>
                <select
                  value={selectedMagasinId}
                  onChange={(e) => setSelectedMagasinId(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                >
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              {['MOBILE_MONEY', 'VIREMENT', 'CHEQUE'].includes(payMode) && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Banque</label>
                  <select
                    value={selectedBanqueId}
                    onChange={(e) => setSelectedBanqueId(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">— Sélectionner —</option>
                    {banques.map(b => <option key={b.id} value={b.id}>{b.nomBanque} — {b.libelle}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handlePay}
                disabled={isPaying}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-xl transition-all disabled:opacity-50"
              >
                {isPaying ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Enregistrer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENDU IMPRESSION */}
      <div className="hidden print:block absolute inset-0 bg-white">
        <div className="p-8">
          <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase italic tracking-tight">Compte Courant Fournisseur</h1>
            <h2 className="text-lg font-bold mt-1">{data?.fournisseur?.nom} {data?.fournisseur?.code ? `(${data.fournisseur.code})` : ''}</h2>
            <p className="text-sm text-gray-600 italic">{printDate ? `Édité le ${printDate}` : ''}</p>
          </div>
          <table className="w-full text-sm border-collapse border-2 border-black">
            <thead>
              <tr className="bg-gray-100 uppercase font-black text-[11px] border-b-2 border-black">
                <th className="border-2 border-black px-3 py-3 text-left">Date</th>
                <th className="border-2 border-black px-3 py-3 text-left">Référence</th>
                <th className="border-2 border-black px-3 py-3 text-left">Libellé</th>
                <th className="border-2 border-black px-3 py-3 text-right">Dû (Achats)</th>
                <th className="border-2 border-black px-3 py-3 text-right">Payé (Réglé)</th>
                <th className="border-2 border-black px-3 py-3 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let runningSolde = 0
                return (data?.operations || []).map((op, idx) => {
                  runningSolde += (op.credit || 0) - (op.debit || 0)
                  return (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-2 border-black px-3 py-2 font-medium italic">{formatDate(op.date)}</td>
                      <td className="border-2 border-black px-3 py-2 font-black uppercase tracking-tight">{op.reference || '—'}</td>
                      <td className="border-2 border-black px-3 py-2">
                        <div className="font-medium">{op.libelle}</div>
                        {op.observation && <div className="text-[10px] text-gray-500 italic">{op.observation}</div>}
                      </td>
                      <td className="border-2 border-black px-3 py-2 text-right font-black text-red-700 tabular-nums">{op.debit > 0 ? `${op.debit.toLocaleString()} F` : '—'}</td>
                      <td className="border-2 border-black px-3 py-2 text-right font-black text-emerald-800 tabular-nums">{op.credit > 0 ? `${op.credit.toLocaleString()} F` : '—'}</td>
                      <td className="border-2 border-black px-3 py-2 text-right font-black tabular-nums">{runningSolde.toLocaleString()} F</td>
                    </tr>
                  )
                })
              })()}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 font-black text-sm border-2 border-black">
                <td colSpan={3} className="border-2 border-black px-3 py-4 text-right tracking-widest uppercase italic">ARRÊTÉ</td>
                <td className="border-2 border-black px-3 py-4 text-right tabular-nums">{totalDebit.toLocaleString()} F</td>
                <td className="border-2 border-black px-3 py-4 text-right tabular-nums">{totalCredit.toLocaleString()} F</td>
                <td className="border-2 border-black px-3 py-4 text-right tabular-nums font-mono">{soldeTotal.toLocaleString()} F</td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-8 p-4 border-2 border-black bg-gray-50 rounded-lg">
            <p className="text-sm font-black uppercase italic text-gray-900">Solde net dû au {new Date().toLocaleDateString('fr-FR')} :</p>
            <p className={`text-4xl font-black tracking-tighter mt-1 ${soldeTotal > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{soldeTotal.toLocaleString()} FCFA</p>
          </div>
          <div className="mt-6 flex justify-between text-sm text-gray-500 border-t border-gray-300 pt-4">
            <p className="italic">Signature & cachet fournisseur</p>
            <p className="italic">Signature & cachet entreprise</p>
          </div>
        </div>
      </div>
    </div>
  )
}