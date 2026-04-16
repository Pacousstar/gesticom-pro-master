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
  CreditCard,
  Pencil,
  Trash2,
  MessageCircle
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

export default function CompteCourantClientPage() {
  const { id } = useParams()
  const router = useRouter()
  const { error: showError } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ client: any, operations: Operation[] } | null>(null)
  const [soldeTotal, setSoldeTotal] = useState(0)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMode, setPayMode] = useState('ESPECES')
  const [magasins, setMagasins] = useState<{ id: number; nom: string }[]>([])
  const [selectedMagasinId, setSelectedMagasinId] = useState<string>('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  
  // MODIF POINT 7 : États pour l'édition/suppression
  const [editingReglement, setEditingReglement] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [showLettrageModal, setShowLettrageModal] = useState(false)
  const [selectedReglement, setSelectedReglement] = useState<Operation | null>(null)
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [allVentesDetail, setAllVentesDetail] = useState<any[]>([])
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [isRelancing, setIsRelancing] = useState(false)
  const { success: showSuccess } = useToast()

  const handleLettrage = async (reglement: Operation) => {
    setSelectedReglement(reglement)
    setShowLettrageModal(true)
    setLoadingInvoices(true)
    try {
      const res = await fetch(`/api/clients/${id}/factures-impayer`)
      if (res.ok) setUnpaidInvoices(await res.json())
    } catch (e) {
      showError("Erreur lors de la récupération des factures.")
    } finally {
      setLoadingInvoices(false)
    }
  }

  const confirmLettrage = async (venteId: number) => {
    if (!selectedReglement) return
    try {
      const res = await fetch(`/api/reglements/ventes/${selectedReglement.id}/lettrage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venteId })
      })
      if (res.ok) {
        showSuccess("Lettrage effectué avec succès !")
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

  const handleRelanceWhatsApp = async () => {
    setIsRelancing(true)
    try {
      const res = await fetch(`/api/clients/${id}/relance`)
      if (res.ok) {
        const json = await res.json()
        if (json.whatsappUrl) {
          window.open(json.whatsappUrl, '_blank')
        } else {
          showError("Ce client n'a pas de numéro de téléphone enregistré ou n'a pas de dette.")
        }
      } else {
        showError("Impossible de générer la relance.")
      }
    } catch (e) {
      showError("Erreur réseau.")
    } finally {
      setIsRelancing(false)
    }
  }

  const handleQuickPay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payAmount || Number(payAmount) <= 0) return
    setIsPaying(true)
    try {
      const res = await fetch('/api/reglements/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(id),
          montant: Number(payAmount),
          modePaiement: payMode,
          magasinId: selectedMagasinId ? Number(selectedMagasinId) : null,
          date: payDate,
          observation: 'Règlement rapide depuis Compte Courant'
        })
      })
      if (res.ok) {
        showSuccess("Règlement enregistré !")
        setShowPayModal(false)
        setPayAmount('')
        fetchData()
      } else {
        showError("Erreur lors du règlement.")
      }
    } catch (e) {
      showError("Erreur réseau.")
    } finally {
      setIsPaying(false)
    }
  }

  const handleDeleteReglement = async (regId: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce règlement ? Cette action est irréversible et annulera l'impact sur le solde client et la caisse.")) return
    
    setIsDeleting(regId)
    try {
      const res = await fetch(`/api/reglements/ventes/${regId}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess("Règlement supprimé avec succès.")
        fetchData()
      } else {
        const err = await res.json()
        showError(err.error || "Erreur lors de la suppression.")
      }
    } catch (e) {
      showError("Erreur réseau.")
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
      const res = await fetch(`/api/reglements/ventes/${editingReglement.id}`, {
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

  useEffect(() => {
    fetchData()
    fetch('/api/magasins').then(r => r.ok ? r.json() : []).then(setMagasins)
  }, [id])

  const [params, setParams] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [res, pRes] = await Promise.all([
        fetch(`/api/clients/${id}/compte-courant`),
        fetch('/api/parametres')
      ])
      
      if (res.ok) {
        const json = await res.json()
        setData(json)
        
        // Calcul du solde total final
        const total = json.operations.reduce((acc: number, op: Operation) => acc + op.debit - op.credit, 0)
        setSoldeTotal(total)
      } else {
        showError("Impossible de charger le compte courant.")
      }

      if (pRes.ok) {
        setParams(await pRes.json())
      }
    } catch (err) {
      showError("Erreur de connexion.")
    } finally {
      setLoading(false)
    }
  }

  const handlePrintAllInvoices = async () => {
    setIsPreparingPrint(true)
    try {
      const res = await fetch(`/api/clients/${id}/factures-detaillees`)
      if (!res.ok) { showError("Impossible de charger les détails des factures."); return }
      const json = await res.json()
      if (!json || json.length === 0) { showError("Aucune facture à imprimer."); return }

      const { getDefaultA4Template, replaceTemplateVariables, generateLignesHTML, getPrintStyles } = await import('@/lib/print-templates')
      const logoPath = params?.logoLocal || params?.logo
      const logoHTML = logoPath ? `<img src="${logoPath}" alt="Logo" style="max-width:150px;height:auto;display:block"/>` : ''

      // Génère le HTML de chaque facture
      const allPagesHTML = json.map((vente: any, idx: number) => {
        const lignesHTML = generateLignesHTML((vente.lignes || []).map((l: any) => ({
          designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire, montant: l.montant
        })))
        const template = getDefaultA4Template('VENTE')
        const html = replaceTemplateVariables(template, {
          ENTREPRISE_NOM: params?.nomEntreprise || '', ENTREPRISE_CONTACT: params?.contact || '',
          ENTREPRISE_LOCALISATION: params?.localisation || '', ENTREPRISE_NCC: params?.numNCC || '',
          ENTREPRISE_RC: params?.registreCommerce || '', ENTREPRISE_LOGO: logoHTML,
          ENTREPRISE_PIED_DE_PAGE: params?.piedDePage || '',
          ENTREPRISE_MENTION_SPECIALE: params?.mentionSpeciale || 'Merci pour votre confiance.',
          NUMERO: vente.numero, DATE: new Date(vente.date).toLocaleDateString('fr-FR'),
          HEURE: new Date(vente.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          CLIENT_NOM: data?.client?.nom || '', CLIENT_CODE: data?.client?.code || '',
          LIGNES: lignesHTML,
          TOTAL: `${vente.montantTotal.toLocaleString()} FCFA`,
          MONTANT_PAYE: `${(vente.montantPaye || 0).toLocaleString()} FCFA`,
          RESTE: `${Math.max(0, vente.montantTotal - (vente.montantPaye || 0)).toLocaleString()} FCFA`,
          MODE_PAIEMENT: vente.modePaiement || 'ESPECES', OBSERVATION: vente.observation || ''
        })
        const pageBreak = idx < json.length - 1 ? '<div style="page-break-after:always"></div>' : ''
        return `<div class="print-document">${html}</div>${pageBreak}`
      }).join('')

      const pw = window.open('', '_blank')
      if (!pw) { alert('Autorisez les popups dans votre navigateur.'); return }
      pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Factures - ${data?.client?.nom}</title><style>${getPrintStyles('A4')}</style></head><body>${allPagesHTML}</body></html>`)
      pw.document.close()
      pw.onload = () => { setTimeout(() => { pw.print(); pw.close() }, 300) }
    } catch (e) {
      showError("Erreur lors de la préparation de l'impression.")
    } finally {
      setIsPreparingPrint(false)
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

  if (!data) return <p className="text-center py-24 text-gray-500 italic">Client introuvable.</p>

  // Calcul du solde progressif
  let currentSolde = 0
  const operationsWithSolde = data.operations.map(op => {
    currentSolde += (op.debit - op.credit)
    return { ...op, soldeProgressif: currentSolde }
  })

  return (
    <div className="space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .shadow-2xl, .shadow-xl { box-shadow: none !important; }
          .rounded-[2.5rem], .rounded-[2rem] { border-radius: 0 !important; }
          .bg-gradient-to-br { background: #f3f4f6 !important; color: black !important; border-bottom: 2px solid #000 !important; }
          .text-white { color: black !important; }
          .bg-orange-600, .bg-emerald-600 { border: 1px solid #ccc !important; color: black !important; }
          .text-orange-500, .text-emerald-600 { color: black !important; font-weight: bold !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #eee !important; padding: 8px !important; }
          .bg-gray-50\/50, .bg-gray-100\/50 { background: transparent !important; }
          .print-header { display: flex !important; justify-content: space-between; align-items: start; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
          .print-logo { max-height: 80px; max-width: 200px; object-contain: contain; }
          .print-only { display: block !important; }
          .print-summary { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
          .print-card { border: 1px solid #000; padding: 10px; text-align: center; }
          .page-break { page-break-after: always; break-after: page; }
          .invoice-box { border: 1px solid #eee; margin-bottom: 20px; padding: 15px; }
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
             <h2 className="text-xl font-black uppercase italic tracking-tighter">Relevé de Compte Client</h2>
             <p className="text-[10px] font-bold mt-1">Date d'impression : {new Date().toLocaleDateString('fr-FR')} {new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
        </div>

        <div className="mb-6 border-l-4 border-black pl-4">
           <h3 className="text-sm font-black uppercase">Client : {data.client.nom}</h3>
           <p className="text-[10px]">Code Client : {data.client.code || 'N/A'}</p>
           <p className="text-[10px]">Période : Du début à ce jour</p>
        </div>

        <div className="print-summary">
           <div className="print-card">
              <p className="text-[8px] font-black uppercase">Total Facturé (Débit)</p>
              <p className="text-lg font-black">{data.operations.reduce((acc, op) => acc + op.debit, 0).toLocaleString('fr-FR')} F</p>
           </div>
           <div className="print-card">
              <p className="text-[8px] font-black uppercase">Total Encaissé (Crédit)</p>
              <p className="text-lg font-black text-emerald-800">{data.operations.reduce((acc, op) => acc + op.credit, 0).toLocaleString('fr-FR')} F</p>
           </div>
           <div className="print-card bg-gray-100">
              <p className="text-[8px] font-black uppercase">Solde Net à Payer</p>
              <p className="text-xl font-black text-orange-800">{soldeTotal.toLocaleString('fr-FR')} F</p>
           </div>
        </div>
      </div>
      {/* HEADER PREMIUM */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-gray-800 to-gray-950 p-8 shadow-2xl">
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
                <p className="mt-1 text-orange-500 font-bold uppercase text-xs tracking-[0.3em] flex items-center gap-2">
                   <User className="h-4 w-4" /> {data.client.nom} ({data.client.code || 'SANS CODE'})
                </p>
             </div>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={() => setShowPayModal(true)}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white hover:bg-orange-600 transition-all shadow-lg hover:-translate-y-1 uppercase tracking-widest no-print"
              >
                <DollarSign className="h-4 w-4" /> Nouveau Règlement
             </button>
             <button 
                onClick={handleRelanceWhatsApp}
                disabled={isRelancing}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white hover:bg-green-700 transition-all shadow-lg hover:-translate-y-1 uppercase tracking-widest no-print"
              >
                {isRelancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                WhatsApp
             </button>
             <button 
               onClick={() => window.print()}
               className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3 text-sm font-black text-white hover:bg-white/20 transition-all uppercase tracking-widest no-print"
             >
               <Printer className="h-4 w-4" /> Relevé
             </button>
             <button 
               onClick={handlePrintAllInvoices}
               disabled={isPreparingPrint}
               className="flex items-center gap-2 rounded-xl bg-emerald-500/80 backdrop-blur-md border border-emerald-400/20 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 transition-all uppercase tracking-widest no-print shadow-lg"
             >
               {isPreparingPrint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
               Détail Factures
             </button>
             <button 
               onClick={() => router.push('/dashboard/clients')}
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
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Débit (Achats)</p>
               <h3 className="text-2xl font-black text-gray-900 tabular-nums">
                  {data.operations.reduce((acc, op) => acc + op.debit, 0).toLocaleString('fr-FR')} F
               </h3>
            </div>
            <TrendingUp className="h-10 w-10 text-orange-500/20 group-hover:scale-110 transition-transform" />
         </div>

         <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex items-center justify-between group overflow-hidden">
            <div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Crédit (Règlements)</p>
               <h3 className="text-2xl font-black text-emerald-600 tabular-nums">
                  {data.operations.reduce((acc, op) => acc + op.credit, 0).toLocaleString('fr-FR')} F
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
                  {soldeTotal > 0 ? "Le client vous doit" : soldeTotal < 0 ? "Le client est en crédit (avoir)" : "Le compte est soldé"}
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
                  {data.operations.length} Événements
               </span>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Libellé / Réf</th>
                <th className="px-8 py-5 text-right">Débit (+)</th>
                <th className="px-8 py-5 text-right">Crédit (-)</th>
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
                  <td className={`px-8 py-6 text-right font-black tabular-nums bg-orange-50/10 group-hover:bg-orange-50/20 transition-all`}>
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
                Toutes les ventes validées augmentent le Débit (ce que le client doit). Les règlements et acomptes augmentent le Crédit (ce qu'il a payé).
                Le résultat positif (D) indique une dette restante, le négatif (C) indique un avoir client.
              </p>
           </div>
        </div>
      </div>

      {/* MODAL DE RÈGLEMENT RAPIDE (LIBRE) */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-lg rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
              <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic">Nouveau Règlement</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Crédit direct sur compte client</p>
                 </div>
                 <button 
                   onClick={() => setShowPayModal(false)}
                   className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
                 >
                    <X className="h-5 w-5" />
                 </button>
              </div>

              <form onSubmit={handleQuickPay} className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Date du règlement</label>
                        <input 
                            type="date"
                            value={payDate}
                            onChange={e => setPayDate(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Montant à verser (F)</label>
                        <div className="relative group">
                        <input 
                            type="number" 
                            autoFocus
                            required
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-2xl bg-gray-50 border-2 border-gray-100 px-6 py-5 text-3xl font-black tabular-nums text-gray-900 focus:border-orange-500 focus:bg-white focus:outline-none transition-all group-hover:border-gray-200"
                        />
                        <DollarSign className="absolute right-6 top-1/2 -translate-y-1/2 h-8 w-8 text-orange-200 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Mode</label>
                       <select 
                         value={payMode}
                         onChange={e => setPayMode(e.target.value)}
                         className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all"
                       >
                          <option value="ESPECES">Espèces</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="VIREMENT">Virement</option>
                          <option value="CHEQUE">Chèque</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Point de Vente (Caisse)</label>
                       <select 
                         value={selectedMagasinId}
                         onChange={e => setSelectedMagasinId(e.target.value)}
                         required
                         className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/5 transition-all"
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
                      className="flex-[2] py-4 rounded-2xl bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 shadow-xl shadow-orange-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                       {isPaying ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <CheckCircle className="h-4 w-4" />
                       )}
                       Confirmer le versement
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL D'ÉDITION DE RÈGLEMENT (Point 7) */}
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

      {/* MODAL DE LETTRAGE */}
      {showLettrageModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-2xl rounded-[2.5rem] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-100">
              <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                 <div>
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
                      <History className="h-5 w-5 text-orange-500" />
                      Lettrer un règlement
                    </h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Associer le versement de {(selectedReglement as any)?.montant?.toLocaleString('fr-FR') || 0} F à une facture</p>
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
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recherche des factures impayées...</p>
                   </div>
                ) : unpaidInvoices.length === 0 ? (
                   <div className="text-center py-12">
                      <Info className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-black text-gray-400 uppercase tracking-tighter italic">Aucune facture impayée trouvée pour ce client.</p>
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
                    {unpaidInvoices.map((v) => (
                      <button 
                        key={v.id}
                        onClick={() => confirmLettrage(v.id)}
                        className="group flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-orange-500 hover:bg-orange-50 transition-all text-left"
                      >
                         <div>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tighter">Vente N° {v.numero}</p>
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
  )
}
