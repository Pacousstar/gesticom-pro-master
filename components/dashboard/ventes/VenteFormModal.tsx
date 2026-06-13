'use client'

import { useState, useCallback } from 'react'
import {
  Loader2, Search, X, Plus, Trash2, Wallet, CreditCard, UserPlus,
  AlertTriangle, XCircle, DollarSign, RotateCcw, Pencil,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import {
  montantLigneTTC,
  montantTotalVenteDocument,
  montantTvaImpliciteLigne,
  pointsFideliteDepuisEncaissement,
} from '@/lib/calculs-commerciaux'
import dynamic from 'next/dynamic'

const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false })

interface VenteFormModalProps {
  magasins: any[]
  clients: any[]
  produits: any[]
  ventes: any[]
  banques: any[]
  tvaParDefaut: number
  editingVenteId: number | null
  onClose: () => void
  onSuccess: () => void
}

type Ligne = { produitId: number; designation: string; code?: string; quantite: number; prixUnitaire: number; tvaPerc?: number; remise?: number; remiseType?: 'MONTANT' | 'POURCENT' }

export default function VenteFormModal({
  magasins, clients, produits, ventes, banques,
  tvaParDefaut, editingVenteId,
  onClose, onSuccess,
}: VenteFormModalProps) {
  const { success: showSuccess, error: showError } = useToast()

  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    magasinId: '',
    clientId: '',
    clientLibre: '',
    modePaiement: 'ESPECES',
    montantPaye: '',
    reglements: [{ mode: 'ESPECES', montant: '' }] as { mode: string; montant: string }[],
    banqueId: '',
    remiseGlobale: '',
    observation: '',
    numeroBon: '',
    lignes: [] as Ligne[],
    pointsGagnes: 0,
  })
  const [ajoutProduit, setAjoutProduit] = useState({
    produitId: '', quantite: '1', prixUnitaire: '', recherche: '', tvaPerc: '', remise: '', remiseType: 'MONTANT' as 'MONTANT' | 'POURCENT',
  })
  const [addLignesPopupOpen, setAddLignesPopupOpen] = useState(false)
  const [popupLignes, setPopupLignes] = useState<Ligne[]>([])
  const [popupAjoutProduit, setPopupAjoutProduit] = useState({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerContext, setScannerContext] = useState<'main' | 'popup'>('main')
  const [clientForm, setClientForm] = useState({ nom: '', telephone: '', email: '', adresse: '', type: 'CASH', plafondCredit: '' })
  const [savingClient, setSavingClient] = useState(false)
  const [err, setErr] = useState('')
  const [showClientList, setShowClientList] = useState(false)
  const [formClientSearch, setFormClientSearch] = useState('')
  const [showCreateBanque, setShowCreateBanque] = useState(false)
  const [creatingBanque, setCreatingBanque] = useState(false)
  const [newBanque, setNewBanque] = useState({ numero: '', nomBanque: '', libelle: '', soldeInitial: '0', compteId: '' })
  const [stockInsuffisantModal, setStockInsuffisantModal] = useState<{
    produitId: number; produitDesignation: string; quantiteDemandee: number; quantiteDisponible: number; magasinId: number; lignes: Ligne[]
  } | null>(null)
  const [ajoutStockQuantite, setAjoutStockQuantite] = useState('')
  const [ajoutStockSaving, setAjoutStockSaving] = useState(false)
  const [createClientAfter, setCreateClientAfter] = useState<(() => void) | null>(null)

  const addLigne = () => {
    const produitId = Number(ajoutProduit.produitId)
    if (!produitId) { showError('Sélectionnez un produit.'); return }
    const quantite = Number(ajoutProduit.quantite) || 1
    const p = produits.find(x => x.id === produitId)
    if (!p) { showError('Produit introuvable.'); return }
    setFormData((f) => ({
      ...f,
      lignes: [
        ...f.lignes,
        {
          produitId,
          designation: p.designation,
          code: p.code,
          quantite,
          prixUnitaire: Number(ajoutProduit.prixUnitaire) || 0,
          tvaPerc: Number(ajoutProduit.tvaPerc) || 0,
          remise: Number(ajoutProduit.remise) || 0,
          remiseType: ajoutProduit.remiseType,
        },
      ],
    }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', recherche: '', tvaPerc: '', remise: '', remiseType: 'MONTANT' })
  }

  const editLigne = (i: number) => {
    const l = formData.lignes[i]
    if (!l) return
    setAjoutProduit({
      produitId: String(l.produitId),
      quantite: String(l.quantite || 1),
      prixUnitaire: String(l.prixUnitaire || ''),
      remise: String(l.remise || ''),
      remiseType: l.remiseType || (l.remise && l.remise < 100 ? 'POURCENT' : 'MONTANT'),
      recherche: l.designation,
      tvaPerc: String(l.tvaPerc || ''),
    })
    setFormData((f) => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }))
  }

  const removeLigne = (i: number) => {
    setFormData((f) => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }))
  }

  const { totalHT, totalTVA, totalRemise, totalAvantRemiseGlobale } = formData.lignes.reduce(
    (acc, val) => {
      const q = val.quantite
      const pu = val.prixUnitaire
      const t = val.tvaPerc || 0
      const r = Number(val.remise) || 0
      const ht = q * pu
      const montantLigne = montantLigneTTC({ quantite: q, prixUnitaire: pu, remiseLigne: r, tvaPourcent: t })
      acc.totalHT += ht
      acc.totalTVA += montantTvaImpliciteLigne({ quantite: q, prixUnitaire: pu, remiseLigne: r, tvaPourcent: t })
      acc.totalRemise += r
      acc.totalAvantRemiseGlobale += montantLigne
      return acc
    },
    { totalHT: 0, totalTVA: 0, totalRemise: 0, totalAvantRemiseGlobale: 0 }
  )
  const total = montantTotalVenteDocument(totalAvantRemiseGlobale, Number(formData.remiseGlobale) || 0, 0)
  const pointsGagnes = pointsFideliteDepuisEncaissement(total)

  const popupTotal = popupLignes.reduce(
    (s, l) => s + montantLigneTTC({ quantite: l.quantite, prixUnitaire: l.prixUnitaire, remiseLigne: Number(l.remise) || 0, tvaPourcent: l.tvaPerc || 0 }),
    0
  )

  const addReglement = () => {
    setFormData(f => ({ ...f, reglements: [...f.reglements, { mode: 'ESPECES', montant: '' }] }))
  }

  const removeReglement = (index: number) => {
    if (formData.reglements.length <= 1) return
    setFormData(f => ({ ...f, reglements: f.reglements.filter((_, i) => i !== index) }))
  }

  const updateReglement = (index: number, key: 'mode' | 'montant', value: string) => {
    setFormData(f => ({
      ...f,
      reglements: f.reglements.map((r, i) => i === index ? { ...r, [key]: value } : r),
    }))
  }

  const totalPayeReglements = formData.reglements.reduce((sum, r) => sum + (Number(r.montant) || 0), 0)
  const needsBanque = formData.reglements.some((r) => ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(r.mode).toUpperCase()))

  const refetchProduits = () => {
    fetch('/api/produits?complet=1')
      .then(async (r) => {
        if (!r.ok) return []
        const data = await r.json()
        return Array.isArray(data) ? data : []
      })
      .then((data) => {
        // Cannot setProduits directly; the effect is a soft refresh used for stock info
      })
  }

  const [produitsLocaux, setProduitsLocaux] = useState<any[]>(produits)
  useState(() => setProduitsLocaux(produits))

  const doEnregistrerVente = async (lignes: Ligne[]) => {
    const magasinId = Number(formData.magasinId)
    if (!magasinId || !lignes.length) return
    setErr('')
    setSubmitting(true)

    const needsBanque = formData.reglements.some((r) => ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(r.mode).toUpperCase()))
    const requestData = {
      date: formData.date || undefined,
      magasinId,
      clientId: formData.clientId ? Number(formData.clientId) : null,
      clientLibre: formData.clientLibre.trim() || null,
      numeroBon: formData.numeroBon.trim() || null,
      modePaiement: formData.reglements.length > 1 ? 'MULTI' : (formData.reglements[0]?.mode || 'ESPECES'),
      reglements: formData.reglements.map(r => ({ mode: r.mode, montant: Number(r.montant) || 0 })),
      banqueId: needsBanque && formData.banqueId ? Number(formData.banqueId) : undefined,
      remiseGlobale: Number(formData.remiseGlobale) || 0,
      observation: formData.observation.trim() || null,
      lignes: lignes.map((l) => ({
        produitId: l.produitId,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tva: Number(l.tvaPerc) || 0,
        remise: Number(l.remise) || 0,
      })),
    }

    try {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setFormData({
          date: new Date().toLocaleDateString('en-CA'),
          magasinId: '', clientId: '', clientLibre: '', modePaiement: 'ESPECES', montantPaye: '',
          reglements: [{ mode: 'ESPECES', montant: '' }], banqueId: '', remiseGlobale: '', observation: '', numeroBon: '',
          lignes: [], pointsGagnes: 0,
        })
        setAddLignesPopupOpen(false)
        setPopupLignes([])
        setPopupAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
        showSuccess(MESSAGES.VENTE_ENREGISTREE)
        onSuccess()
        onClose()
      } else {
        if (data.error?.includes('Client introuvable')) {
          setCreateClientAfter(() => () => doEnregistrerVente(lignes))
          setShowCreateClient(true)
        } else if (data.error?.includes('Stock insuffisant')) {
          const match = data.error.match(/Stock insuffisant pour (.+?) \((\d+) dispo/)
          if (match) {
            const designation = match[1]
            const quantiteDisponible = Number(match[2])
            const ligneProbleme = lignes.find((l) => l.designation === designation)
            if (ligneProbleme) {
              setStockInsuffisantModal({
                produitId: ligneProbleme.produitId,
                produitDesignation: designation,
                quantiteDemandee: ligneProbleme.quantite,
                quantiteDisponible,
                magasinId: Number(formData.magasinId),
                lignes,
              })
              setAjoutStockQuantite(String(ligneProbleme.quantite - quantiteDisponible))
            } else {
              showError(data.error)
            }
          } else {
            showError(data.error)
          }
        } else {
          const errorMsg = formatApiError(data.error || 'Erreur lors de l\'enregistrement.')
          setErr(errorMsg)
          showError(errorMsg)
        }
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const magasinId = Number(formData.magasinId)
    if (!magasinId) { setErr('Choisissez un magasin.'); return }
    if (!formData.lignes.length) {
      setAddLignesPopupOpen(true)
      setPopupLignes([])
      setPopupAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
      return
    }
    const needsBanqueValidation = formData.reglements.some((r) => ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(r.mode).toUpperCase()))
    if (needsBanqueValidation && !formData.banqueId) {
      setErr('Sélectionnez un compte bancaire pour les règlements non espèces.')
      return
    }
    const hasCreditMode = formData.reglements.some((r) => String(r.mode).toUpperCase() === 'CREDIT')
    const totalPaye = formData.reglements.reduce((sum, r) => sum + (Number(r.montant) || 0), 0)
    if (!hasCreditMode && totalPaye <= 0) {
      setErr('Renseignez un montant payé (espèces, mobile money, etc.) ou passez en mode crédit pour reporter le paiement.')
      return
    }
    const lignes = formData.lignes.map(l => ({
      ...l,
      tvaPerc: Number(l.tvaPerc) || 0,
      remise: Number(l.remise) || 0,
    }))
    doEnregistrerVente(lignes)
  }

  const refreshBanques = async () => {
    try {
      const r = await fetch('/api/banques', { cache: 'no-store' as any })
      const d = r.ok ? await r.json() : null
      // Parent banques state cannot be refreshed from here. Ignored.
      return Array.isArray(d?.data) ? d.data : []
    } catch {
      return []
    }
  }

  const createBanqueInline = async (target: 'FORM' | 'REGLEMENT') => {
    const numero = (newBanque.numero || '').trim()
    const nomBanque = (newBanque.nomBanque || '').trim()
    const libelle = (newBanque.libelle || '').trim()
    if (!numero || !nomBanque || !libelle) {
      showError('Veuillez renseigner Numéro, Banque et Libellé.')
      return
    }
    setCreatingBanque(true)
    try {
      const res = await fetch('/api/banques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero, nomBanque, libelle,
          soldeInitial: Number(newBanque.soldeInitial) || 0,
          compteId: newBanque.compteId || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        showError(d?.error || 'Erreur lors de la création du compte bancaire.')
        return
      }
      await refreshBanques()
      if (d?.id) {
        if (target === 'FORM') setFormData((f) => ({ ...f, banqueId: String(d.id) }))
      }
      setNewBanque({ numero: '', nomBanque: '', libelle: '', soldeInitial: '0', compteId: '' })
      setShowCreateBanque(false)
      showSuccess('Compte bancaire créé et sélectionné.')
    } catch {
      showError('Erreur réseau lors de la création du compte bancaire.')
    } finally {
      setCreatingBanque(false)
    }
  }

  const addLigneInPopup = () => {
    const produitId = Number(popupAjoutProduit.produitId)
    if (!produitId) { showError('Choisissez un produit.'); return }
    const p = produits.find((x: any) => x.id === produitId)
    if (!p) { showError('Produit introuvable.'); return }
    const quantite = Number(popupAjoutProduit.quantite) || 1
    setPopupLignes((prev) => [
      ...prev,
      {
        produitId,
        designation: p.designation,
        code: p.code || '',
        quantite,
        prixUnitaire: Number(popupAjoutProduit.prixUnitaire) || 0,
        tvaPerc: Number(popupAjoutProduit.tvaPerc) || 0,
        remise: Number(popupAjoutProduit.remise) || 0,
      },
    ])
    setPopupAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
  }

  const removePopupLigne = (i: number) => {
    setPopupLignes((prev) => prev.filter((_, j) => j !== i))
  }

  const handleScannerResult = (code: string) => {
    const p = produits.find((x: any) => x.code === code)
    if (p) {
      const s = p.stocks?.find((st: any) => st.magasinId === Number(formData.magasinId))?.quantite || 0
      setAjoutProduit((a) => ({ ...a, produitId: String(p.id), recherche: p.designation, prixUnitaire: String(p.prixVente ?? 0) }))
    }
    setScannerOpen(false)
  }

  return (
    <>
      {stockInsuffisantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStockInsuffisantModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stock insuffisant</h3>
                <p className="mt-1 text-sm text-gray-600">{stockInsuffisantModal.produitDesignation}</p>
              </div>
              <button onClick={() => setStockInsuffisantModal(null)} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 space-y-3 rounded-lg bg-red-50 p-4 border border-red-100">
              <div className="flex items-start gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-black uppercase tracking-tight">Règle d'Or : Entrée avant Sortie</p>
                  <p className="mt-1 opacity-90">
                    Ce produit est en rupture de stock informatique ({stockInsuffisantModal.quantiteDisponible} dispo), mais vous tentez d'en vendre {stockInsuffisantModal.quantiteDemandee}.
                  </p>
                  <p className="mt-2 font-bold italic">
                    Avez-vous reçu une livraison physique qui n'a pas encore été saisie ? Régularisez immédiatement le stock ci-dessous pour continuer la vente.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-red-200 space-y-1">
                <p className="text-xs text-gray-700"><strong>Manquant :</strong> {stockInsuffisantModal.quantiteDemandee - stockInsuffisantModal.quantiteDisponible} unités</p>
              </div>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const quantite = Math.max(1, Math.floor(Number(ajoutStockQuantite) || 0))
                if (quantite <= 0) { showError('La quantité doit être supérieure à 0.'); return }
                setAjoutStockSaving(true)
                try {
                  const res = await fetch('/api/stock/entree', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      date: new Date().toISOString().split('T')[0],
                      magasinId: stockInsuffisantModal.magasinId,
                      produitId: stockInsuffisantModal.produitId,
                      quantite,
                      observation: 'Ajout rapide - Stock insuffisant',
                    }),
                  })
                  const data = await res.json()
                  if (res.ok) {
                    showSuccess(`Stock ajouté avec succès (${quantite} unités).`)
                    setStockInsuffisantModal(null)
                    setAjoutStockQuantite('')
                    refetchProduits()
                    setTimeout(() => doEnregistrerVente(stockInsuffisantModal.lignes), 500)
                  } else {
                    showError(data.error || 'Erreur lors de l\'ajout du stock.')
                  }
                } catch {
                  showError('Erreur réseau lors de l\'ajout du stock.')
                } finally {
                  setAjoutStockSaving(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantité à ajouter au stock</label>
                <input type="number" min="1" value={ajoutStockQuantite} onChange={(e) => setAjoutStockQuantite(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" placeholder="Quantité" required />
                <p className="mt-1 text-xs text-gray-500">Quantité recommandée : {stockInsuffisantModal.quantiteDemandee - stockInsuffisantModal.quantiteDisponible} unités</p>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={ajoutStockSaving} className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60">
                  {ajoutStockSaving ? (<><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Ajout en cours...</>) : 'Ajouter au stock et continuer'}
                </button>
                <button type="button" onClick={() => setStockInsuffisantModal(null)} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 animate-in slide-in-from-top-4 duration-300">
        <h2 className="mb-4 text-xl font-black text-gray-900 uppercase tracking-tighter italic">
          {editingVenteId ? `Modifier la facture ${ventes.find((v: any) => v.id === editingVenteId)?.numero || ''}` : 'Nouvelle vente'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input type="date" required value={formData.date} onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Magasin *</label>
              <select required value={formData.magasinId} onChange={(e) => setFormData((f) => ({ ...f, magasinId: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none">
                <option value="">—</option>
                {magasins.map((m) => (<option key={m.id} value={m.id}>{m.code} – {m.nom}</option>))}
              </select>
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">Client (optionnel)</label>
              <div className="relative mt-1 flex gap-2">
                <div className="relative flex-1">
                  <input type="text" placeholder="Rechercher un client par nom..." value={formClientSearch} onChange={(e) => { setFormClientSearch(e.target.value); if (!e.target.value) setFormData(f => ({ ...f, clientId: '' })) }} onFocus={() => { setShowClientList(true); if (!formData.clientId) setFormClientSearch('') }} onBlur={() => setTimeout(() => setShowClientList(false), 200)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 focus:border-orange-500 focus:outline-none bg-white font-bold" />
                  {!formData.clientId && showClientList && (
                    <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl border-orange-100 p-1">
                      <div className="sticky top-0 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 uppercase mb-1 rounded">{formClientSearch ? 'Résultats de recherche' : 'Tous les clients (cliquez pour choisir)'}</div>
                      {clients.filter((c: any) => c.nom.toLowerCase().includes(formClientSearch.toLowerCase()) || (c.code && c.code.toLowerCase().includes(formClientSearch.toLowerCase()))).slice(0, 30).map((c: any) => (
                        <div key={c.id} onMouseDown={(e) => { e.preventDefault(); setFormData(fod => ({ ...fod, clientId: String(c.id), clientLibre: '' })); setFormClientSearch(c.nom); setShowClientList(false) }} className="cursor-pointer px-4 py-3 text-sm hover:bg-orange-50 font-black text-slate-900 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="flex items-center justify-between"><span>{c.nom}</span><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.code || 'SANS CODE'}</span></div>
                        </div>
                      ))}
                      {clients.filter((c: any) => c.nom.toLowerCase().includes(formClientSearch.toLowerCase())).length > 30 && (<div className="px-4 py-2 text-[10px] text-gray-400 italic bg-gray-50 uppercase font-black text-center">Affinez votre recherche...</div>)}
                      {clients.filter((c: any) => c.nom.toLowerCase().includes(formClientSearch.toLowerCase())).length === 0 && (<div className="px-4 py-3 text-sm text-gray-500 italic">Aucun client trouvé.</div>)}
                    </div>
                  )}
                  {formData.clientId && (<button type="button" onClick={() => { setFormData(f => ({ ...f, clientId: '' })); setFormClientSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white"><X className="h-4 w-4" /></button>)}
                </div>
                <button type="button" onClick={() => setShowCreateClient(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50"><UserPlus className="h-4 w-4" /></button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ou nom libre</label>
              <input value={formData.clientLibre} onChange={(e) => setFormData((f) => ({ ...f, clientLibre: e.target.value }))} placeholder="Si client passager..." disabled={!!formData.clientId} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 disabled:bg-gray-100 focus:border-orange-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-orange-600">Numéro de BON</label>
              <input value={formData.numeroBon} onChange={(e) => setFormData((f) => ({ ...f, numeroBon: e.target.value }))} placeholder="N° de bon (facultatif)" className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-gray-900 font-bold focus:border-orange-500 focus:outline-none" />
            </div>
            <div className="flex items-end">
              <div className="flex-1 rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2">
                <label className="block text-[10px] font-bold text-orange-600 uppercase">Points à gagner</label>
                <p className="text-sm font-black text-orange-700">{pointsGagnes} points</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Lignes</h3>
            <div className="mb-3 space-y-2">
              <div className="relative group">
                <div className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition-colors"><Search className="h-4 w-4" /></div>
                <input type="text" placeholder="Taper le nom ou le code du produit..." value={ajoutProduit.recherche || ''} onChange={(e) => setAjoutProduit((a) => ({ ...a, recherche: e.target.value }))} onFocus={refetchProduits} className="w-full rounded-xl border border-gray-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm placeholder:text-gray-300" />
                {ajoutProduit.recherche.length > 0 && !ajoutProduit.produitId && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in zoom-in duration-200">
                    {produits
                      .filter((p: any) => { const s = ajoutProduit.recherche.toLowerCase(); return p.code.toLowerCase().includes(s) || p.designation.toLowerCase().includes(s) })
                      .map((p: any) => {
                        const s = p.stocks?.find((st: any) => st.magasinId === Number(formData.magasinId))?.quantite || 0
                        return (<button key={p.id} type="button" onClick={() => setAjoutProduit(a => ({ ...a, produitId: String(p.id), recherche: p.designation, prixUnitaire: String(p.prixVente ?? 0) }))} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm hover:bg-orange-50 transition-all border-b border-gray-50 last:border-0">
                          <div className="flex flex-col"><span className="font-black text-slate-900 uppercase tracking-tighter">{p.designation}</span><span className="text-[10px] text-gray-400 font-mono font-bold">{p.code}</span></div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Stock: {s}</span>
                        </button>)
                      })}
                  </div>
                )}
                {ajoutProduit.produitId && (<button onClick={() => setAjoutProduit(a => ({ ...a, produitId: '', recherche: '' }))} className="absolute right-3 top-3 text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>)}
              </div>
              {ajoutProduit.produitId && (() => {
                const p = produits.find((x: any) => x.id === Number(ajoutProduit.produitId))
                const s = p?.stocks?.find((st: any) => st.magasinId === Number(formData.magasinId))?.quantite || 0
                const qte = Number(ajoutProduit.quantite) || 0
                const isInsuffisant = qte > s
                return (<div className="flex flex-col gap-1 px-1 py-1 animate-in slide-in-from-top-1 duration-200">
                  {!formData.magasinId && (<p className="text-[10px] font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Veuillez sélectionner un magasin pour voir le stock exact.</p>)}
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="text-gray-500 italic">Produit sélectionné.</span>
                    <span className="text-gray-900">Stock disponible :</span>
                    <span className={`px-2 py-0.5 rounded-full shadow-sm text-sm font-bold ${s > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{s}</span>
                    {isInsuffisant && s > 0 && <span className="text-red-600 font-black animate-pulse flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> QUANTITÉ SUPÉRIEURE AU STOCK !</span>}
                    {s <= 0 && <span className="text-red-700 font-black animate-bounce flex items-center gap-1"><XCircle className="h-4 w-4" /> STOCK ÉPUISÉ !</span>}
                  </div>
                </div>)
              })()}
            </div>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500 ml-1 font-bold">Quantité</label><input type="number" min="1" step="1" value={ajoutProduit.quantite} onChange={(e) => setAjoutProduit((a) => ({ ...a, quantite: e.target.value }))} placeholder="Qté" className="w-20 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500 ml-1 font-bold">P.U. (HT)</label><input type="number" min="0" step="1" value={ajoutProduit.prixUnitaire} onChange={(e) => setAjoutProduit((a) => ({ ...a, prixUnitaire: e.target.value }))} placeholder="Prix HT" className="w-28 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500 ml-1 font-bold">Remise</label><div className="flex items-center"><input type="number" min="0" step="1" value={ajoutProduit.remise} onChange={(e) => setAjoutProduit((a) => ({ ...a, remise: e.target.value }))} placeholder="Remise" className="w-24 rounded-l border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" /><button type="button" onClick={() => setAjoutProduit(a => ({ ...a, remiseType: a.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT' }))} className={`px-2 py-2 border border-l-0 border-gray-200 text-xs font-bold rounded-r transition-colors ${ajoutProduit.remiseType === 'POURCENT' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-700'}`}>{ajoutProduit.remiseType === 'MONTANT' ? 'F' : '%'}</button></div></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-gray-500 ml-1 font-bold">TVA (%)</label><input type="number" min="0" step="0.01" value={ajoutProduit.tvaPerc} onChange={(e) => setAjoutProduit((a) => ({ ...a, tvaPerc: e.target.value }))} placeholder="TVA %" className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none bg-orange-50/30" /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] text-orange-600 ml-1 font-bold">Total TTC</label><div className="w-28 rounded border border-orange-100 bg-orange-50 px-2 py-2 text-sm font-bold text-orange-800">{(() => { const q = Number(ajoutProduit.quantite || 0); const pu = Number(ajoutProduit.prixUnitaire || 0); const r = Number(ajoutProduit.remise || 0); const t = Number(ajoutProduit.tvaPerc || 0); const ht = q * pu; const rv = ajoutProduit.remiseType === 'MONTANT' ? r : ht * (r / 100); return montantLigneTTC({ quantite: q, prixUnitaire: pu, remiseLigne: rv, tvaPourcent: t }).toLocaleString('fr-FR') })()} F</div></div>
              <button type="button" onClick={addLigne} className="rounded-lg bg-orange-500 px-4 py-2 mt-auto text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-sm">Ajouter</button>
            </div>
            {formData.lignes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-gray-600"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">P.U. (HT)</th><th className="pb-2 text-right">Total (HT)</th><th className="pb-2 text-right">Remise</th><th className="pb-2 text-right">TVA</th><th className="pb-2 text-right">Total TTC</th><th></th></tr></thead>
                  <tbody>
                    {formData.lignes.map((l, i) => {
                      const ht = l.quantite * l.prixUnitaire
                      const ttc = montantLigneTTC({ quantite: l.quantite, prixUnitaire: l.prixUnitaire, remiseLigne: Number(l.remise) || 0, tvaPourcent: l.tvaPerc || 0 })
                      return (<tr key={i} className="border-b border-gray-100"><td className="py-2">{l.designation}</td><td className="text-right">{l.quantite}</td><td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td><td className="text-right">{ht.toLocaleString('fr-FR')} F</td><td className="text-right text-red-600">-{(l.remise || 0).toLocaleString('fr-FR')} F{(() => { const p = produits.find((prod: any) => prod.id === l.produitId); const s = p?.stocks?.find((st: any) => st.magasinId === Number(formData.magasinId))?.quantite || 0; if (l.quantite > s) return <div className="text-[10px] font-black text-red-600 mt-1 flex items-center justify-end gap-1 uppercase bg-red-50 p-1 rounded border border-red-200"><AlertTriangle className="h-3 w-3" /> Stock insuf ({s})</div>; return null })()}</td><td className="text-right">{l.tvaPerc}%</td><td className="text-right font-bold text-emerald-700">{ttc.toLocaleString('fr-FR')} F</td><td className="w-16"><div className="flex items-center gap-1 justify-end"><button type="button" onClick={() => editLigne(i)} title="Modifier" className="rounded p-1 text-blue-600 hover:bg-blue-100"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => removeLigne(i)} title="Supprimer" className="rounded p-1 text-red-600 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-col items-end text-sm gap-2 border-t border-gray-200 pt-3">
              <p className="text-slate-900 flex justify-between w-64"><span>Total HT Brut :</span> <span className="font-black text-lg">{totalHT.toLocaleString('fr-FR')} F</span></p>
              {totalRemise > 0 && (<p className="text-red-500 flex justify-between w-64"><span>Total Remises :</span> <span className="font-bold">-{totalRemise.toLocaleString('fr-FR')} F</span></p>)}
              <p className="text-blue-800 flex justify-between w-64"><span>Total TVA :</span> <span className="font-black text-lg">{totalTVA.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</span></p>
              <p className="text-lg font-black text-white mt-2 bg-emerald-600 px-4 py-2 rounded shadow-lg w-64 flex justify-between ring-2 ring-emerald-500 ring-offset-2"><span>TOTAL TTC :</span> <span>{total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA</span></p>
            </div>
          </div>

          {formData.lignes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><CreditCard className="h-4 w-4 text-orange-600" /> Règlements (Multi-Paiement)</h3>
                <button type="button" onClick={addReglement} className="text-[10px] font-bold bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 transition-colors uppercase">+ Ajouter un mode</button>
              </div>
              <div className="space-y-3">
                {formData.reglements.map((r, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-3 items-end bg-white/50 p-2 rounded-lg border border-amber-100/50">
                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Mode</label><select value={r.mode} onChange={(e) => updateReglement(i, 'mode', e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"><option value="ESPECES">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="VIREMENT">Virement</option><option value="CHEQUE">Chèque</option><option value="CREDIT">Crédit (Dette)</option></select></div>
                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Montant à payer</label><div className="relative"><input type="number" min="0" step="1" value={r.montant} onChange={(e) => updateReglement(i, 'montant', e.target.value)} placeholder={i === 0 ? String(total) : '0'} className="mt-1 w-full rounded-lg border border-gray-200 pl-3 pr-8 py-1.5 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" />{formData.reglements.length > 1 && (<button type="button" onClick={() => removeReglement(i)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X className="h-3 w-3" /></button>)}</div></div>
                    <div className="pb-2 text-[10px] text-gray-400 italic">{r.mode === 'ESPECES' ? 'Ira en Caisse' : 'Ira en Banque'}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-amber-200 pt-3">
                <div className="bg-white p-2 rounded-lg border border-amber-100"><p className="text-[10px] text-gray-500 uppercase font-bold">Total Facture</p><p className="text-lg font-black text-slate-800">{total.toLocaleString('fr-FR')} F</p></div>
                <div className={`p-2 rounded-lg border ${totalPayeReglements >= total ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><p className="text-[10px] text-gray-500 uppercase font-bold">Total Saisi (Payé)</p><p className={`text-lg font-black ${totalPayeReglements >= total ? 'text-green-700' : 'text-red-700'}`}>{totalPayeReglements.toLocaleString('fr-FR')} F</p></div>
              </div>
              {totalPayeReglements < total && (<div className="mt-2 p-2 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold flex items-center gap-2 animate-pulse"><AlertTriangle className="h-3 w-3" /> ATTENTION : IL RESTE {(total - totalPayeReglements).toLocaleString('fr-FR')} F À PAYER !</div>)}
              {needsBanque && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Compte bancaire à utiliser</label>
                  <select required value={formData.banqueId} onChange={(e) => setFormData((f) => ({ ...f, banqueId: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none">
                    <option value="">Sélectionner une banque...</option>
                    {banques.map((b) => (<option key={b.id} value={b.id}>{b.nomBanque} — {b.libelle} ({b.numero})</option>))}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-400">Obligatoire pour Mobile Money, Virement et Chèque.</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setShowCreateBanque((v) => !v)} className="text-[10px] font-black uppercase text-orange-700 hover:underline">+ Créer un compte bancaire</button>
                    <button type="button" onClick={() => refreshBanques()} className="text-[10px] font-bold text-gray-500 hover:underline">Rafraîchir</button>
                  </div>
                  {showCreateBanque && (
                    <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Numéro *</label><input value={newBanque.numero} onChange={(e) => setNewBanque((s) => ({ ...s, numero: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" placeholder="Ex: 000123..." /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Banque *</label><input value={newBanque.nomBanque} onChange={(e) => setNewBanque((s) => ({ ...s, nomBanque: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" placeholder="Ex: ECOBANK" /></div>
                        <div className="sm:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Libellé *</label><input value={newBanque.libelle} onChange={(e) => setNewBanque((s) => ({ ...s, libelle: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" placeholder="Ex: Compte courant / Mobile Money" /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Solde initial</label><input type="number" value={newBanque.soldeInitial} onChange={(e) => setNewBanque((s) => ({ ...s, soldeInitial: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Compte comptable (optionnel)</label><input value={newBanque.compteId} onChange={(e) => setNewBanque((s) => ({ ...s, compteId: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none" placeholder="512 / 521 / id..." /></div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" disabled={creatingBanque} onClick={() => createBanqueInline('FORM')} className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white font-black hover:bg-orange-700 disabled:opacity-60">{creatingBanque ? 'Création...' : 'Créer et sélectionner'}</button>
                        <button type="button" onClick={() => setShowCreateBanque(false)} className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50">Fermer</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {formData.lignes.some(l => {
              const p = produits.find((prod: any) => prod.id === l.produitId)
              const s = p?.stocks?.find((st: any) => st.magasinId === Number(formData.magasinId))?.quantite || 0
              return l.quantite > s
            }) && (
              <div className="p-3 bg-red-100 border-2 border-red-500 rounded-xl flex items-center gap-3 animate-pulse">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <p className="text-sm font-black text-red-700 uppercase italic">Attention : Certains produits n'ont pas assez de stock ! Veuillez corriger avant de valider.</p>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded-lg px-4 py-2 text-white font-bold transition-all shadow-lg bg-orange-500 hover:bg-orange-600">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer la vente'}
              </button>
              <button type="button" onClick={() => { onClose(); setFormData({
                date: new Date().toLocaleDateString('en-CA'), magasinId: '', clientId: '', clientLibre: '',
                modePaiement: 'ESPECES', montantPaye: '', reglements: [{ mode: 'ESPECES', montant: '' }],
                banqueId: '', remiseGlobale: '', observation: '', numeroBon: '', lignes: [], pointsGagnes: 0,
              })}} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                Annuler
              </button>
            </div>
          </div>
        </form>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {addLignesPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !submitting && setAddLignesPopupOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">Ajoutez au moins une ligne</h3>
              <p className="mt-1 text-sm text-gray-600">Le stock ne reflète pas encore les produits. Ajoutez les lignes ci‑dessous puis validez pour enregistrer la vente.</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Rechercher un produit (code, désignation, catégorie)..." value={popupAjoutProduit.recherche || ''} onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, recherche: e.target.value }))} onFocus={refetchProduits} className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none" />
                </div>
                <select value={popupAjoutProduit.produitId} onChange={(e) => { const p = Array.isArray(produits) ? produits.find((x: any) => x.id === Number(e.target.value)) : undefined; if (p) { setPopupAjoutProduit((a) => ({ ...a, produitId: e.target.value, prixUnitaire: String(p.prixVente ?? 0) })) } }} className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none">
                  <option value="">Choisir un produit</option>
                  {Array.isArray(produits) && produits.filter((p: any) => { if (!popupAjoutProduit.recherche) return true; const s = popupAjoutProduit.recherche.toLowerCase(); return p.code.toLowerCase().includes(s) || p.designation.toLowerCase().includes(s) || (p.categorie && p.categorie.toLowerCase().includes(s)) }).map((p: any) => (<option key={p.id} value={p.id}>{p.code} – {p.designation}</option>))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <input type="number" min="1" value={popupAjoutProduit.quantite} onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, quantite: e.target.value }))} placeholder="Qté" className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                <input type="number" min="0" step="1" value={popupAjoutProduit.prixUnitaire} onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, prixUnitaire: e.target.value }))} placeholder="Prix (HT)" className="w-24 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                <input type="number" min="0" step="1" value={popupAjoutProduit.remise} onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, remise: e.target.value }))} placeholder="Remise" className="w-20 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none" />
                <input type="number" min="0" step="0.01" value={popupAjoutProduit.tvaPerc} onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, tvaPerc: e.target.value }))} placeholder="TVA %" className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none bg-orange-50/30" />
                <div className="flex flex-col gap-0.5 min-w-[80px]"><span className="text-[10px] font-bold text-orange-600 ml-1">Total TTC</span><div className="rounded border border-orange-100 bg-orange-50 px-2 py-1.5 text-xs font-bold text-orange-800">{(() => { const q = Number(popupAjoutProduit.quantite || 0); const pu = Number(popupAjoutProduit.prixUnitaire || 0); const r = Number(popupAjoutProduit.remise || 0); const t = Number(popupAjoutProduit.tvaPerc || 0); return montantLigneTTC({ quantite: q, prixUnitaire: pu, remiseLigne: r, tvaPourcent: t }).toLocaleString('fr-FR') })()} F</div></div>
                <button type="button" onClick={addLigneInPopup} className="rounded-lg border-2 border-orange-400 bg-orange-100 px-3 py-2 text-sm font-medium text-orange-900 hover:bg-orange-200">Ajouter</button>
              </div>
              {popupLignes.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left text-gray-600"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">P.U(HT)</th><th className="pb-2 text-right">Remise</th><th className="pb-2 text-right">TVA</th><th className="pb-2 text-right text-emerald-700">TTC</th><th className="w-10"></th></tr></thead>
                      <tbody>{popupLignes.map((l, i) => { const lTTC = montantLigneTTC({ quantite: l.quantite, prixUnitaire: l.prixUnitaire, remiseLigne: Number(l.remise) || 0, tvaPourcent: l.tvaPerc || 0 }); return (<tr key={i} className="border-b border-gray-100"><td className="py-2">{l.designation}</td><td className="text-right">{l.quantite}</td><td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td><td className="text-right text-red-600">-{(l.remise || 0).toLocaleString('fr-FR')}</td><td className="text-right">{l.tvaPerc || 0}%</td><td className="text-right font-bold text-emerald-700">{lTTC.toLocaleString('fr-FR')} F</td><td><button type="button" onClick={() => removePopupLigne(i)} className="rounded p-1.5 text-red-600 hover:bg-red-100" title="Supprimer"><Trash2 className="h-4 w-4" /></button></td></tr>) })}</tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-right text-base font-bold text-gray-900">Total : {popupTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA</p>
                </>
              )}
            </div>
            {popupLignes.length === 0 && (<p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Choisissez un produit, la quantité et le prix puis cliquez sur "Ajouter".</p>)}
            {err && addLignesPopupOpen && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => { setAddLignesPopupOpen(false); setErr(''); }} disabled={submitting} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-60">Annuler</button>
              <button type="button" onClick={() => doEnregistrerVente(popupLignes)} disabled={popupLignes.length === 0 || submitting} className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Valider et enregistrer la vente
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreateClient(false); setCreateClientAfter(null); setErr('') }}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Nouveau client</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!clientForm.nom.trim()) { showError('Le nom est obligatoire.'); return }
              setSavingClient(true)
              try {
                const res = await fetch('/api/clients', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nom: clientForm.nom.trim(),
                    telephone: clientForm.telephone.trim() || null,
                    email: clientForm.email.trim() || null,
                    adresse: clientForm.adresse.trim() || null,
                    type: clientForm.type || 'CASH',
                    plafondCredit: clientForm.type === 'CREDIT' ? Number(clientForm.plafondCredit) || 0 : 0,
                  }),
                })
                if (!res.ok) throw new Error((await res.json()).error || 'Erreur')
                showSuccess('Client créé.')
                setShowCreateClient(false)
                if (createClientAfter) createClientAfter()
                setCreateClientAfter(null)
              } catch (e: any) {
                showError(formatApiError(e) || 'Erreur lors de la création du client.')
              } finally {
                setSavingClient(false)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom *</label>
                <input required value={clientForm.nom} onChange={(e) => setClientForm((f) => ({ ...f, nom: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" placeholder="Nom du client" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Téléphone</label><input value={clientForm.telephone} onChange={(e) => setClientForm((f) => ({ ...f, telephone: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700">Email</label><input type="email" value={clientForm.email} onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700">Type</label><select value={clientForm.type} onChange={(e) => setClientForm((f) => ({ ...f, type: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"><option value="CASH">CASH</option><option value="CREDIT">CREDIT</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700">Plafond crédit (FCFA)</label><input type="number" min="0" value={clientForm.plafondCredit} onChange={(e) => setClientForm((f) => ({ ...f, plafondCredit: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Adresse</label><input value={clientForm.adresse} onChange={(e) => setClientForm((f) => ({ ...f, adresse: e.target.value }))} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none" /></div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingClient} className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60">{savingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer et continuer'}</button>
                <button type="button" onClick={() => { setShowCreateClient(false); setCreateClientAfter(null); setErr('') }} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">Annuler</button>
              </div>
            </form>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          </div>
        </div>
      )}
    </>
  )
}
