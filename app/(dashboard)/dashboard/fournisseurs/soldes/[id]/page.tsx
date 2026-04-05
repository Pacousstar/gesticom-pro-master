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
  User,
  DollarSign,
  X,
  CheckCircle,
  ShoppingBag
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

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
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('')
  const [isPaying, setIsPaying] = useState(false)
  const [showLettrageModal, setShowLettrageModal] = useState(false)
  const [selectedReglement, setSelectedReglement] = useState<Operation | null>(null)
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const handleLettrage = async (reglement: Operation) => {
    setSelectedReglement(reglement)
    setShowLettrageModal(true)
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}/factures-impayer`)
      if (res.ok) setUnpaidInvoices(await res.json())
    } catch (e) {
      showError("Erreur lors de la récupération des factures.")
    } finally {
      setLoadingInvoices(false)
    }
  }

  const confirmLettrage = async (achatId: number) => {
    if (!selectedReglement) return
    try {
      const res = await fetch(`/api/reglements/achats/${selectedReglement.id}/lettrage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achatId })
      })
      if (res.ok) {
        showSuccess("Lettrage fournisseur effectué !")
        setShowLettrageModal(false)
        fetchData()
      } else {
        const error = await res.json()
        showError(error.error || "Erreur lors du lettrage.")
      }
    } catch (e) {
      showError("Erreur réseau.")
    }
  }

  const handleQuickPay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAmount || Number(payAmount) <= 0) return
    setIsPaying(true)
    try {
      const res = await fetch('/api/reglements/achats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fournisseurId: Number(id),
          montant: Number(payAmount),
          modePaiement: payMode,
          magasinId: selectedMagasinId ? Number(selectedMagasinId) : null,
          observation: 'Règlement rapide depuis Compte Courant'
        })
      })
      if (res.ok) {
        showSuccess("Règlement fournisseur enregistré !")
        setShowPayModal(false)
        setPayAmount('')
        fetchData()
      } else {
        const errData = await res.json()
        showError(errData.error || "Erreur lors du règlement.")
      }
    } catch (e) {
      showError("Erreur réseau.")
    } finally {
      setIsPaying(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetch('/api/magasins').then(r => r.ok ? r.json() : []).then(setMagasins)
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/fournisseurs/${id}/compte-courant`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        
        // Calcul du solde total final
        const total = json.operations.reduce((acc: number, op: Operation) => acc + op.debit - op.credit, 0)
        setSoldeTotal(total)
      } else {
        showError("Impossible de charger le compte courant fournisseur.")
      }
    } catch (err) {
      showError("Erreur de connexion.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
        <p className="text-sm font-black uppercase tracking-widest italic text-gray-500 animate-pulse">
           Analyse du compte fournisseur en cours...
        </p>
      </div>
    )
  }

  if (!data) return <p className="text-center py-24 text-gray-500 italic">Fournisseur introuvable.</p>

  // Calcul du solde progressif
  let currentSolde = 0
  const operationsWithSolde = data.operations.map(op => {
    currentSolde += (op.debit - op.credit)
    return { ...op, soldeProgressif: currentSolde }
  })

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER PREMIUM (Thème Violet) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-900 to-gray-950 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
             <button 
               onClick={() => router.back()}
               className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg"
             >
               <ArrowLeft className="h-6 w-6" />
             </button>
             <div>
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic text-purple-200">Compte Fournisseur</h1>
                <p className="mt-1 text-purple-400 font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2">
                   <User className="h-4 w-4" /> {data.fournisseur.nom} ({data.fournisseur.code || 'SANS CODE'})
                </p>
             </div>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={() => setShowPayModal(true)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white hover:bg-purple-700 transition-all shadow-lg hover:-translate-y-1 uppercase tracking-widest no-print"
              >
                <DollarSign className="h-4 w-4" /> Régler Fournisseur
             </button>
             <button 
               onClick={() => window.print()}
               className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/20 transition-all uppercase tracking-widest no-print"
             >
               <Printer className="h-4 w-4" /> Imprimer Relevé
             </button>
             <button 
               onClick={() => router.push('/dashboard/fournisseurs')}
               className="flex items-center gap-2 rounded-xl bg-red-500/80 backdrop-blur-md border border-red-400/20 px-5 py-3 text-sm font-black text-white hover:bg-red-600 transition-all uppercase tracking-widest no-print"
             >
               <X className="h-4 w-4" /> Fermer
             </button>
          </div>
        </div>
      </div>

      {/* BILAN RAPIDE */}
      <div className="grid gap-4 sm:grid-cols-3">
         <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex items-center justify-between group overflow-hidden">
            <div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Achats (Débit)</p>
               <h3 className="text-2xl font-black text-gray-900 tabular-nums">
                  {data.operations.reduce((acc, op) => acc + op.debit, 0).toLocaleString('fr-FR')} F
               </h3>
            </div>
            <ShoppingBag className="h-10 w-10 text-purple-500/20 group-hover:scale-110 transition-transform" />
         </div>

         <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex items-center justify-between group overflow-hidden">
            <div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Payé (Crédit)</p>
               <h3 className="text-2xl font-black text-emerald-600 tabular-nums">
                  {data.operations.reduce((acc, op) => acc + op.credit, 0).toLocaleString('fr-FR')} F
               </h3>
            </div>
            <Wallet className="h-10 w-10 text-emerald-500/20 group-hover:scale-110 transition-transform" />
         </div>

         <div className={`rounded-[2rem] p-6 shadow-xl border flex items-center justify-between group overflow-hidden ${soldeTotal > 0 ? 'bg-red-600 border-red-500' : 'bg-emerald-600 border-emerald-500'}`}>
            <div className="text-white">
               <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Reste à Payer (Net)</p>
               <h3 className="text-3xl font-black tabular-nums">
                  {Math.abs(soldeTotal).toLocaleString('fr-FR')} F
               </h3>
               <p className="text-[9px] font-bold uppercase mt-1">
                  {soldeTotal > 0 ? "Nous devons au fournisseur" : soldeTotal < 0 ? "Nous avons un avoir (trop perçu)" : "Compte fournisseur apuré"}
               </p>
            </div>
            <DollarSign className="h-12 w-12 text-white/20 group-hover:scale-110 transition-transform" />
         </div>
      </div>

      {/* TABLEAU CHRONOLOGIQUE */}
      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
        <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
              <History className="h-5 w-5 text-purple-500" />
              Historique des transactions fournisseur
            </h2>
            <div className="flex gap-2">
               <span className="bg-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {data.operations.length} Opérations
               </span>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Libellé / Facture</th>
                <th className="px-8 py-5 text-right">Achat (+)</th>
                <th className="px-8 py-5 text-right">Règlement (-)</th>
                <th className="px-8 py-5 text-right bg-purple-50/30 text-purple-900">Solde dû</th>
                <th className="px-8 py-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operationsWithSolde.map((op, i) => (
                <tr key={i} className="group hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
                         {op.date === '1970-01-01T00:00:00.000Z' ? '—' : new Date(op.date).toLocaleDateString('fr-FR')}
                      </p>
                      {op.date !== '1970-01-01T00:00:00.000Z' && (
                        <p className="text-[10px] font-medium text-gray-400">
                          {new Date(op.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">{op.libelle}</p>
                     <div className="flex items-center gap-2 mt-1">
                        {op.mode && <span className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">{op.mode}</span>}
                        {op.observation && <span className="text-[9px] text-gray-400 italic">"{op.observation}"</span>}
                     </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <p className={`text-sm font-black tabular-nums ${op.debit > 0 ? 'text-gray-900' : 'text-gray-200'}`}>
                        {op.debit > 0 ? op.debit.toLocaleString('fr-FR') + ' F' : '—'}
                     </p>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <p className={`text-sm font-black tabular-nums ${op.credit > 0 ? 'text-emerald-600' : 'text-gray-200'}`}>
                        {op.credit > 0 ? op.credit.toLocaleString('fr-FR') + ' F' : '—'}
                     </p>
                  </td>
                  <td className={`px-8 py-6 text-right font-black tabular-nums bg-purple-50/10 group-hover:bg-purple-50/20 transition-all`}>
                     <p className={`text-sm ${op.soldeProgressif > 0 ? 'text-red-500' : op.soldeProgressif < 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {Math.abs(op.soldeProgressif).toLocaleString('fr-FR')} F 
                        <span className="text-[10px] ml-1 opacity-50">
                          {op.soldeProgressif > 0 ? 'D' : op.soldeProgressif < 0 ? 'C' : ''}
                        </span>
                     </p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {op.type === 'REGLEMENT' && op.reference === '-' && (
                      <button 
                        onClick={() => handleLettrage(op)}
                        className="rounded-lg bg-indigo-100 px-3 py-1.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-widest flex items-center gap-1 mx-auto shadow-sm"
                      >
                         <CheckCircle className="h-3 w-3" /> Lettrer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-100/50 p-8 flex items-center gap-4">
           <div className="h-10 w-10 rounded-full bg-purple-600 flex items-center justify-center text-white">
              <Info className="h-6 w-6" />
           </div>
           <div>
              <p className="text-sm font-black text-gray-800 uppercase tracking-tighter italic">Compréhension des soldes fournisseurs</p>
              <p className="text-xs text-gray-500 font-medium max-w-2xl">
                Les achats validés augmentent notre dette envers le fournisseur (Débit). Les règlements et avances diminuent cette dette (Crédit).
                Un solde (D) indique que nous devons cette somme au fournisseur. Un solde (C) indique un trop-perçu ou un avoir à notre faveur.
              </p>
           </div>
        </div>
      </div>

      {/* MODAL DE RÈGLEMENT RAPIDE (FOURNISSEUR) */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
              <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic">Nouveau Règlement F.</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Sortie de caisse pour fournisseur</p>
                 </div>
                 <button 
                   onClick={() => setShowPayModal(false)}
                   className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
                 >
                    <X className="h-5 w-5" />
                 </button>
              </div>

              <form onSubmit={handleQuickPay} className="p-8 space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Montant versé (F)</label>
                    <div className="relative group">
                       <input 
                         type="number" 
                         autoFocus
                         required
                         value={payAmount}
                         onChange={e => setPayAmount(e.target.value)}
                         placeholder="0.00"
                         className="w-full rounded-2xl bg-gray-50 border-2 border-gray-100 px-6 py-5 text-3xl font-black tabular-nums text-gray-900 focus:border-purple-500 focus:bg-white focus:outline-none transition-all group-hover:border-gray-200"
                       />
                       <DollarSign className="absolute right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-purple-200 group-focus-within:text-purple-500 transition-colors" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mode</label>
                       <select 
                         value={payMode}
                         onChange={e => setPayMode(e.target.value)}
                         className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all"
                       >
                          <option value="ESPECES">Espèces</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="VIREMENT">Virement</option>
                          <option value="CHEQUE">Chèque</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Provenance (Caisse)</label>
                       <select 
                         value={selectedMagasinId}
                         onChange={e => setSelectedMagasinId(e.target.value)}
                         required
                         className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all"
                       >
                          <option value="">Sélectionnez...</option>
                          {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowPayModal(false)}
                      className="flex-1 py-4 rounded-2xl border border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95"
                    >
                       Annuler
                    </button>
                    <button 
                      type="submit"
                      disabled={isPaying}
                      className="flex-[2] py-4 rounded-2xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 shadow-xl shadow-purple-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                       {isPaying ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <CheckCircle className="h-4 w-4" />
                       )}
                       Confirmer le règlement
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL DE LETTRAGE FOURNISSEUR */}
      {showLettrageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
              <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
                      <History className="h-5 w-5 text-indigo-500" />
                      Lettrer un règlement fournisseur
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Associer le versement de {(selectedReglement as any)?.montant?.toLocaleString('fr-FR') || 0} F à une facture d'achat</p>
                 </div>
                 <button 
                   onClick={() => setShowLettrageModal(false)}
                   className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
                 >
                    <X className="h-5 w-5" />
                 </button>
              </div>

              <div className="p-8">
                {loadingInvoices ? (
                   <div className="flex flex-col items-center py-12 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recherche des achats impayés...</p>
                   </div>
                ) : unpaidInvoices.length === 0 ? (
                   <div className="text-center py-12">
                      <Info className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-black text-gray-400 uppercase tracking-tighter italic">Aucun achat impayé trouvé pour ce fournisseur.</p>
                      <button 
                        onClick={() => setShowLettrageModal(false)}
                        className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                         Fermer
                      </button>
                   </div>
                ) : (
                  <div className="grid gap-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 text-center">Sélectionnez la facture d'achat à régler avec ce montant</p>
                    {unpaidInvoices.map((v) => (
                      <button 
                        key={v.id}
                        onClick={() => confirmLettrage(v.id)}
                        className="group flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                      >
                         <div>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tighter">Achat N° {v.numero}</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{new Date(v.date).toLocaleDateString('fr-FR')}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-gray-900 tabular-nums">{v.montantTotal.toLocaleString('fr-FR')} F</p>
                            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-tighter italic bg-indigo-100 px-2 rounded-full inline-block mt-0.5">
                               Reste : {(v.montantTotal - (v.montantPaye || 0)).toLocaleString('fr-FR')} F
                            </p>
                         </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
           </div>
        </div>
      )}
      
      <style jsx global>{`
        @media print {
          nav, aside, header, footer, button, .no-print, form, .flex-1.flex.items-end { display: none !important; }
          body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          .rounded-[2.5rem], .rounded-[2rem] { border-radius: 0 !important; border: none !important; box-shadow: none !important; }
          .bg-gradient-to-br { background: white !important; color: black !important; border-bottom: 2pt solid black !important; }
          .text-white, .text-purple-200, .text-purple-400 { color: black !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1pt solid #ddd !important; padding: 8pt 4pt !important; font-size: 9pt !important; }
          .bg-purple-50\/10 { background: transparent !important; }
          .text-red-500, .text-emerald-700 { color: black !important; font-weight: bold !important; }
        }
      `}</style>
    </div>
  )
}
