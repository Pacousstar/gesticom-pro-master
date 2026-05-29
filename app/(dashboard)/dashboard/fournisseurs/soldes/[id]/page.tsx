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
  const [data, setData] = useState<{ fournisseur: any, operations: Operation[], totalDebitGlobal?: number, totalCreditGlobal?: number, globalSolde?: number } | null>(null)
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
  const [editingReglement, setEditingReglement] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLettrageModal, setShowLettrageModal] = useState(false)
  const [selectedReglement, setSelectedReglement] = useState<Operation | null>(null)
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [lettrageError, setLettrageError] = useState('')
  const [params, setParams] = useState<any>(null)

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
      const [res, pRes] = await Promise.all([
        fetch(`/api/fournisseurs/${id}/compte-courant`),
        fetch('/api/parametres')
      ])
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setSoldeTotal(json.globalSolde ?? 0)
      } else {
        showError("Erreur lors du chargement du compte courant.")
      }
      if (pRes.ok) {
        setParams(await pRes.json())
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
        setPayMode('ESPECES')
        setSelectedMagasinId('')
        setSelectedBanqueId('')
        setPayDate(new Date().toISOString().split('T')[0])
        fetchData()
      } else {
        const err = await res.json()
        showError(err.error || 'Erreur lors du paiement.')
        setIsPaying(false)
      }
    } catch {
      showError('Erreur réseau.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleDeleteReglement = async (reglementId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce règlement ? Cette action est irréversible et annulera l'impact sur le solde fournisseur et la caisse.")) return
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

  const handleEditReglement = (op: any) => {
    setEditingReglement(op)
    setPayAmount(String(op.credit))
    setPayMode(op.mode || 'ESPECES')
    setPayDate(new Date(op.date).toISOString().split('T')[0])
    setShowEditModal(true)
  }

  const submitEditReglement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReglement) return
    setIsPaying(true)
    try {
      const res = await fetch(`/api/reglements/achats/${editingReglement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant: Number(payAmount),
          modePaiement: payMode,
          date: payDate,
          observation: `Mise à jour règlement - ${editingReglement.libelle}`
        })
      })
      if (res.ok) {
        showSuccess("Règlement modifié avec succès.")
        setShowEditModal(false)
        fetchData()
      } else {
        const err = await res.json()
        showError(err.error || "Erreur lors de la modification.")
      }
    } catch (e) {
      showError("Erreur réseau.")
    } finally {
      setIsPaying(false)
    }
  }

  const handleLettrage = async (reglement: Operation) => {
    setSelectedReglement(reglement)
    setShowLettrageModal(true)
    setLoadingInvoices(true)
    setLettrageError('')
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
    setLettrageError('')
    try {
      const res = await fetch(`/api/reglements/achats/${selectedReglement.id}/lettrage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achatId })
      })
      if (res.ok) {
        showSuccess("Lettrage effectué avec succès !")
        setShowLettrageModal(false)
        setSelectedReglement(null)
        fetchData()
      } else {
        const error = await res.json()
        setLettrageError(error.error || "Erreur lors du lettrage.")
      }
    } catch (e) {
      setLettrageError("Erreur réseau.")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="text-sm font-black uppercase tracking-widest italic text-gray-500 animate-pulse">
           Analyse du compte courant en cours...
        </p>
      </div>
    )
  }

  if (!data) return <p className="text-center py-24 text-gray-500 italic">Fournisseur introuvable.</p>

  const ops = Array.isArray(data?.operations) ? data.operations : []
  let currentSolde = 0
  const operationsWithSolde = ops.map(op => {
    currentSolde += (op.debit - op.credit)
    return { ...op, soldeProgressif: currentSolde }
  })

  const totalDebit = data?.totalDebitGlobal ?? ops.reduce((acc: number, op: Operation) => acc + (op.debit || 0), 0)
  const totalCredit = data?.totalCreditGlobal ?? ops.reduce((acc: number, op: Operation) => acc + (op.credit || 0), 0)

  return (
    <div className="space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .shadow-2xl, .shadow-xl { box-shadow: none !important; }
          .rounded-\\[2\\.5rem\\], .rounded-\\[2rem\\] { border-radius: 0 !important; }
          .bg-gradient-to-br { background: #f3f4f6 !important; color: black !important; border-bottom: 2px solid #000 !important; }
          .text-white { color: black !important; }
          .bg-orange-600, .bg-emerald-600 { border: 1px solid #ccc !important; color: black !important; }
          .text-orange-500, .text-emerald-600 { color: black !important; font-weight: bold !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #eee !important; padding: 8px !important; }
          .bg-gray-50/50, .bg-gray-100/50 { background: transparent !important; }
          .print-header { display: flex !important; justify-content: space-between; align-items: start; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .print-logo { max-height: 80px; max-width: 200px; object-fit: contain; }
          .print-only { display: block !important; }
          .print-summary { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
          .print-card { border: 1px solid #000; padding: 10px; text-align: center; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ENTÊTE IMPRESSION */}
      <div className="print-only">
        <div className="print-header">
          <div className="flex items-start gap-4">
             {params?.logo && <img src={params.logo} alt="Logo" className="print-logo" />}
             <div>
                <h1 className="text-2xl font-black uppercase leading-tight">{params?.nomEntreprise || 'GESTICOM PRO'}</h1>
                <p className="text-xs font-bold uppercase">{params?.slogan}</p>
                <p className="text-[10px] mt-1 italic">{params?.localisation} — {params?.contact}</p>
             </div>
          </div>
          <div className="text-right">
             <h2 className="text-xl font-black uppercase italic tracking-tighter">Relevé de Compte Fournisseur</h2>
             <p className="text-[10px] font-bold mt-1">Date d'impression : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>

        <div className="mb-6 border-l-4 border-black pl-4">
           <h3 className="text-sm font-black uppercase">Fournisseur : {data.fournisseur.nom}</h3>
           <p className="text-[10px]">Code : {data.fournisseur.code || 'N/A'}</p>
           <p className="text-[10px]">Période : Du début à ce jour</p>
        </div>

        <div className="print-summary">
           <div className="print-card">
               <p className="text-[11px] font-black uppercase">Total Achats (Débit)</p>
                <p className="text-lg font-black">{totalDebit.toLocaleString('fr-FR')} F</p>
           </div>
           <div className="print-card">
               <p className="text-[11px] font-black uppercase">Total Payé (Crédit)</p>
                <p className="text-lg font-black text-emerald-800">{totalCredit.toLocaleString('fr-FR')} F</p>
           </div>
           <div className="print-card bg-gray-100">
               <p className="text-[11px] font-black uppercase">Solde Net à Payer</p>
               <p className="text-xl font-black text-orange-800">{soldeTotal.toLocaleString('fr-FR')} F</p>
           </div>
        </div>
      </div>

      <div className="no-print">
      {/* HEADER PREMIUM */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-orange-700 to-orange-950 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl opacity-50" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
             <button 
               onClick={() => router.back()}
               className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg"
             >
               <ArrowLeft className="h-6 w-6" />
             </button>
             <div>
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Compte Courant</h1>
                <p className="mt-1 text-orange-300 font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2">
                   <Truck className="h-4 w-4" /> {data.fournisseur.nom} ({data.fournisseur.code || 'SANS CODE'})
                </p>
             </div>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={() => setShowPayModal(true)}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-600 transition-all shadow-lg hover:-translate-y-1 uppercase tracking-widest no-print"
              >
                <DollarSign className="h-4 w-4" /> Nouveau Paiement
             </button>
             <button 
               onClick={() => window.print()}
               className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/20 transition-all uppercase tracking-widest no-print"
             >
               <Printer className="h-4 w-4" /> Relevé
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
              {totalDebit.toLocaleString('fr-FR')} F
            </h3>
          </div>
          <TrendingUp className="h-10 w-10 text-orange-500/20 group-hover:scale-110 transition-transform" />
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex items-center justify-between group overflow-hidden">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Payé (Crédit)</p>
            <h3 className="text-2xl font-black text-emerald-600 tabular-nums">
              {totalCredit.toLocaleString('fr-FR')} F
            </h3>
          </div>
          <Wallet className="h-10 w-10 text-emerald-500/20 group-hover:scale-110 transition-transform" />
        </div>

        <div className={`rounded-[2rem] p-6 shadow-xl border flex items-center justify-between group overflow-hidden ${soldeTotal > 0 ? 'bg-orange-600 border-orange-500' : 'bg-emerald-600 border-emerald-500'}`}>
          <div className="text-white">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Solde Net Final</p>
            <h3 className="text-3xl font-black tabular-nums">
              {Math.abs(soldeTotal).toLocaleString('fr-FR')} F
            </h3>
            <p className="text-[9px] font-bold uppercase mt-1">
              {soldeTotal > 0 ? "Vous devez au fournisseur" : soldeTotal < 0 ? "Le fournisseur vous doit (avoir)" : "Le compte est soldé"}
            </p>
          </div>
          <DollarSign className="h-12 w-12 text-white/20 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* TABLEAU CHRONOLOGIQUE */}
      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
        <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
            <History className="h-5 w-5 text-orange-500" />
            Détail chronologique des opérations
          </h2>
          <div className="flex gap-2">
            <span className="bg-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              {ops.length} Événements
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Libellé / Réf</th>
                <th className="px-8 py-5 text-center">Type</th>
                <th className="px-8 py-5 text-right bg-red-50/30">Dû (Débit +)</th>
                <th className="px-8 py-5 text-right bg-emerald-50/30">Payé (Crédit -)</th>
                <th className="px-8 py-5 text-right bg-orange-50/30">Solde Progressif</th>
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
                      {op.mode && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">{op.mode}</span>}
                      {op.observation && <span className="text-[9px] text-gray-400 italic">"{op.observation}"</span>}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                      op.type === 'ACHAT' ? 'bg-red-100 text-red-700' :
                      op.type === 'REGLEMENT' ? 'bg-emerald-100 text-emerald-700' :
                      op.type === 'AVOIR_INITIAL' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {op.type === 'ACHAT' ? 'Achat' :
                       op.type === 'REGLEMENT' ? 'Règlement' :
                       op.type === 'AVOIR_INITIAL' ? 'Avoir Initial' :
                       op.type === 'SOLDE_INITIAL' ? 'Solde Initial' : op.type}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right bg-red-50/10">
                    <p className={`text-sm font-black tabular-nums ${op.debit > 0 ? 'text-red-600' : 'text-gray-200'}`}>
                      {op.debit > 0 ? op.debit.toLocaleString('fr-FR') + ' F' : '—'}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right bg-emerald-50/10">
                    <p className={`text-sm font-black tabular-nums ${op.credit > 0 ? 'text-emerald-600' : 'text-gray-200'}`}>
                      {op.credit > 0 ? op.credit.toLocaleString('fr-FR') + ' F' : '—'}
                    </p>
                  </td>
                  <td className="px-8 py-6 text-right font-black tabular-nums bg-orange-50/10 group-hover:bg-orange-50/20 transition-all">
                    <p className={`text-sm ${op.soldeProgressif > 0 ? 'text-red-500' : op.soldeProgressif < 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {Math.abs(op.soldeProgressif).toLocaleString('fr-FR')} F 
                      <span className="text-[10px] ml-1 opacity-50">
                        {op.soldeProgressif > 0 ? 'D' : op.soldeProgressif < 0 ? 'C' : ''}
                      </span>
                    </p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {op.type === 'REGLEMENT' && op.reference === '-' && (
                        <button 
                          onClick={() => handleLettrage(op)}
                          className="rounded-lg bg-orange-100 px-3 py-1.5 text-[10px] font-black text-orange-600 hover:bg-orange-500 hover:text-white transition-all uppercase tracking-widest flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle className="h-3 w-3" /> Lettrer
                        </button>
                      )}
                      {op.type === 'REGLEMENT' && (
                        <>
                          <button 
                            onClick={() => handleEditReglement(op)}
                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            title="Modifier ce règlement"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteReglement(op.id!)}
                            disabled={isDeleting === op.id}
                            className={`p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm ${isDeleting === op.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Supprimer ce règlement"
                          >
                            {isDeleting === op.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-100/50 p-8 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800 uppercase tracking-tighter italic">Comportement du solde</p>
            <p className="text-xs text-gray-500 font-medium max-w-2xl">
              Tous les achats validés augmentent le Débit (ce que vous devez). Les règlements augmentent le Crédit (ce qui a été payé).
              Le résultat positif (D) indique une dette restante, le négatif (C) indique un avoir fournisseur.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL PAIEMENT */}
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

      {/* MODAL ÉDITION PAIEMENT */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
            <div className="bg-blue-50 px-8 py-6 border-b border-blue-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-blue-900 uppercase tracking-tighter italic flex items-center gap-2">
                  <Pencil className="h-5 w-5" /> Modifier Règlement
                </h2>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-0.5">Correction d'une erreur de saisie</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-blue-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitEditReglement} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Date</label>
                <input 
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Montant (F)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full rounded-2xl bg-gray-50 border-2 border-gray-100 px-6 py-5 text-3xl font-black tabular-nums text-gray-900 focus:border-blue-500 focus:outline-none transition-all"
                  />
                  <DollarSign className="absolute right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-blue-200" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mode de Paiement</label>
                <select 
                  value={payMode}
                  onChange={e => setPayMode(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none transition-all"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 rounded-2xl border border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isPaying}
                  className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Mettre à jour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LETTRAGE */}
      {showLettrageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
            <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
                  <History className="h-5 w-5 text-orange-500" />
                  Lettrer un règlement
                </h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Associer le versement de {(selectedReglement as any)?.credit?.toLocaleString('fr-FR') || 0} F à une facture</p>
              </div>
              <button 
                onClick={() => { setShowLettrageModal(false); setLettrageError(''); }}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8">
              {loadingInvoices ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recherche des factures impayées...</p>
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Info className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-black text-gray-400 uppercase tracking-tighter italic">Aucune facture impayée trouvée pour ce fournisseur.</p>
                  <button 
                    onClick={() => setShowLettrageModal(false)}
                    className="mt-4 text-[10px] font-black text-orange-600 uppercase tracking-widest hover:underline"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 text-center">Sélectionnez la facture à régler avec ce montant</p>
                  {lettrageError && (
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-center">
                      <p className="text-xs font-bold text-red-700">{lettrageError}</p>
                    </div>
                  )}
                  {unpaidInvoices.map((v) => (
                    <button 
                      key={v.id}
                      onClick={() => confirmLettrage(v.id)}
                      className="group flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                    >
                      <div>
                        <p className="text-xs font-black text-gray-800 uppercase tracking-tighter">Achat N° {v.numero}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{new Date(v.date).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900 tabular-nums">{v.montantTotal.toLocaleString('fr-FR')} F</p>
                        <p className="text-[10px] text-orange-600 font-black uppercase tracking-tighter italic bg-orange-100 px-2 rounded-full inline-block mt-0.5">
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
      </div>

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
                  runningSolde += (op.debit || 0) - (op.credit || 0)
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
                      <td className="border-2 border-black px-3 py-2 text-right font-black tabular-nums">{Math.abs(runningSolde).toLocaleString()} F <span className="text-[10px]">{runningSolde > 0 ? 'D' : runningSolde < 0 ? 'C' : ''}</span></td>
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
                <td className="border-2 border-black px-3 py-4 text-right tabular-nums font-mono">{Math.abs(soldeTotal).toLocaleString()} F <span className="text-[10px]">{soldeTotal > 0 ? 'D' : soldeTotal < 0 ? 'C' : ''}</span></td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-6 flex justify-between text-sm text-gray-500 border-t border-gray-300 pt-4">
            <p className="italic">Signature & cachet fournisseur</p>
            <p className="italic">Signature & cachet entreprise</p>
          </div>
        </div>
      </div>
    </div>
   )
  }
