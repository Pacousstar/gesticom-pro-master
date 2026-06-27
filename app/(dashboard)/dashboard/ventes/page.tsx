'use client'

import { useState, useEffect, useCallback } from 'react'
import SuppressionConfirmModal from '@/components/SuppressionConfirmModal'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { VenteTableRow } from '@/components/dashboard/ventes/VenteTableRow'
import VenteFormModal from '@/components/dashboard/ventes/VenteFormModal'
import ModificationVenteModal from '@/components/dashboard/ventes/ModificationVenteModal'
import {
  ShoppingBag, Plus, Loader2, Trash2, Eye, FileSpreadsheet, Printer, X, 
  Search, Edit2, Wallet, AlertTriangle, XCircle, RotateCcw, CreditCard, Truck
} from 'lucide-react'
import { generateLignesHTML, type TemplateData } from '@/lib/print-templates'
import PrintPreview from '@/components/print/PrintPreview'
import { extractList } from '@/lib/api-client'
import Pagination from '@/components/ui/Pagination'
import { formatDate } from '@/lib/format-date'
import { montantLigneTTC, montantTvaImpliciteLigne } from '@/lib/calculs-commerciaux'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import { useToast } from '@/hooks/useToast'
import { getStatutPaiementLabel, getStatutPaiementColors } from '@/lib/enums-commerce'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateForPrint } from '@/lib/print-helpers'

type Magasin = { id: number; code: string; nom: string }
type Client = { id: number; nom: string; type: string; code?: string }
type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  categorie?: string; 
  prixVente: number | null;
  prixMinimum?: number | null;
  stocks: Array<{ magasinId: number; quantite: number }>; prixAchat?: number | null 
}
type VenteLigne = { quantite: number; prixUnitaire: number; designation: string; tvaPerc?: number; remise?: number | string; montant?: number; tva?: number }
export default function VentesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openIdParam = searchParams.get('open')
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [ventes, setVentes] = useState<Array<{
    id: number
    numero: string
    date: string
    montantTotal: number
    montantRetourne?: number
    montantNet?: number
    montantPaye?: number
    statutPaiement?: string
    modePaiement: string
    statut: string
    magasin: { id: number; code: string; nom: string }
    lignes: Array<{ quantite: number; prixUnitaire: number; designation: string; tvaPerc?: number }>
  }>>([])
  const [annulant, setAnnulant] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [livrant, setLivrant] = useState<number | null>(null)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: number; numero: string; lignesCount: number; reglementsCount: number } | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [detailVente, setDetailVente] = useState<{
    id: number
    numero: string
    date: string
    montantTotal: number
    montantRetourne?: number
    montantNet?: number
    remiseGlobale: number
    montantPaye?: number
    statutPaiement?: string
    modePaiement: string
    statut: string
    clientLibre: string | null
    observation: string | null
    numeroBon: string | null
    magasinId: number
    clientId: number | null
    magasin: { id: number; code: string; nom: string }
    client: { id: number; code?: string; nom: string; telephone?: string | null; adresse?: string | null; ncc?: string | null } | null
    lignes: Array<{ designation: string; quantite: number; prixUnitaire: number; tvaPerc?: number; remise?: number | string; montant: number }>
    reglements: Array<{ mode: string; montant: number; date?: string; reference?: string | null }>
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [detailRetours, setDetailRetours] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [totals, setTotals] = useState<{ montantTotal: number; montantPaye: number; resteAPayer: number } | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterClientSearch, setFilterClientSearch] = useState('')
  const [searchNumero, setSearchNumero] = useState('')
  const [searchNumeroBon, setSearchNumeroBon] = useState('')
  const [searchClient, setSearchClient] = useState('')
  const [typeVenteFilter, setTypeVenteFilter] = useState('')
  const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<TemplateData | null>(null)
  const [tvaParDefaut, setTvaParDefaut] = useState(0)
  const [editingVente, setEditingVente] = useState<any>(null)
  const [editingVenteId, setEditingVenteId] = useState<number | null>(null)
  const [editingVenteModalId, setEditingVenteModalId] = useState<number | null>(null)
  const [entreprise, setEntreprise] = useState<any>(null)
  const [allVentesForPrint, setAllVentesForPrint] = useState<any[]>([])
  const [isPrinting, setIsPrinting] = useState(false)
  const [banques, setBanques] = useState<any[]>([])

  const { success: showSuccess, error: showError } = useToast()
  const [err, setErr] = useState('')

  const [showReglement, setShowReglement] = useState<{ id: number; numero: string; reste: number } | null>(null)
  const [reglementData, setReglementData] = useState({ montant: '', modePaiement: 'ESPECES', banqueId: '', date: new Date().toISOString().split('T')[0] })
  const [savingReglement, setSavingReglement] = useState(false)
  const [showCreateBanque, setShowCreateBanque] = useState(false)
  const [creatingBanque, setCreatingBanque] = useState(false)
  const [newBanque, setNewBanque] = useState({
    numero: '',
    nomBanque: '',
    libelle: '',
    soldeInitial: '0',
    compteId: '',
  })

  const [retourModalVente, setRetourModalVente] = useState<any>(null)
  const [retourLignes, setRetourLignes] = useState<any[]>([])
  const [retourRemboursement, setRetourRemboursement] = useState(true)
  const [retourMode, setRetourMode] = useState('ESPECES')
  const [retourObservation, setRetourObservation] = useState('')
  const [retourBanqueId, setRetourBanqueId] = useState('')
  const [savingRetour, setSavingRetour] = useState(false)
  const [deletingRetourId, setDeletingRetourId] = useState<number | null>(null)

  const [deliverVente, setDeliverVente] = useState<{ id: number; numero: string; lignes: Array<{ produitId: number; designation: string; quantite: number; quantiteLivree: number; prixUnitaire: number; montant: number }> } | null>(null)
  const [deliverQtys, setDeliverQtys] = useState<Record<number, number>>({})
  const [savingDeliver, setSavingDeliver] = useState(false)

  useEffect(() => {
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { 
      if (d) {
        setTvaParDefaut(Number(d.tvaParDefaut) || 0)
        setEntreprise(d)
      }
    }).catch(() => { })
    fetch('/api/banques')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBanques(extractList(d)))
      .catch(() => setBanques([]))
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => { })
  }, [])

  useEffect(() => {
    fetch('/api/print-templates?type=VENTE&actif=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((templates: Array<{ id: number; actif: boolean }>) => {
        const activeTemplate = templates.find((t) => t.actif)
        if (activeTemplate) {
          setDefaultTemplateId(activeTemplate.id)
        }
      })
      .catch(() => { })
  }, [])

  const imprimerVente = async () => {
    if (!detailVente) return
    try {
      const d = detailVente
      const dateDoc = new Date(d.date)
      // Toutes les lignes (articles) de la vente sont affichées sur une même facture
      const lignes = Array.isArray(d.lignes) ? d.lignes : []
      // Calculs conformes (TTC = HT Net + TVA sur Net)
      const totalCalc = lignes.reduce((acc, l: VenteLigne) => {
        const q = l.quantite
        const pu = l.prixUnitaire
        const r = Number(l.remise) || 0
        const t = Number(l.tvaPerc) || Number(l.tva) || 0
        const ht = q * pu
        acc.ht += ht
        acc.remise += r
        acc.tva += montantTvaImpliciteLigne({
          quantite: q,
          prixUnitaire: pu,
          remiseLigne: r,
          tvaPourcent: t,
        })
        return acc
      }, { ht: 0, remise: 0, tva: 0 })
      
      const lignesHtml = generateLignesHTML(lignes.map((l: { designation: string; quantite: number; prixUnitaire: number; remise?: number | string; montant: number }) => ({
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        remise: l.remise,
        montant: l.montant || (l.prixUnitaire * l.quantite),
      })))

      // Construction des données du template
      const templateData: TemplateData = {
        NUMERO: d.numero,
        DATE: formatDate(d.date),
        HEURE: dateDoc.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        MAGASIN_CODE: d.magasin.code,
        MAGASIN_NOM: d.magasin.nom,
        CLIENT_NOM: d.client?.nom || d.clientLibre || undefined,
        CLIENT_CODE: (d.client as any)?.code || undefined,
        CLIENT_CONTACT: d.client?.telephone || undefined,
        CLIENT_LOCALISATION: d.client?.adresse || undefined,
        CLIENT_NCC: d.client?.ncc || undefined,
        LIGNES: lignesHtml,
        TOTAL_HT: `${totalCalc.ht.toLocaleString('fr-FR')} FCFA`,
        TOTAL_REMISE: totalCalc.remise > 0 ? `${totalCalc.remise.toLocaleString('fr-FR')} FCFA` : undefined,
        REMISE_GLOBALE: d.remiseGlobale > 0 ? `${Number(d.remiseGlobale).toLocaleString('fr-FR')} FCFA` : undefined,
        TOTAL_HT_NET: `${(totalCalc.ht - totalCalc.remise - (Number(d.remiseGlobale) || 0)).toLocaleString('fr-FR')} FCFA`,
        TOTAL_TVA: totalCalc.tva > 0 ? `${Math.round(totalCalc.tva).toLocaleString('fr-FR')} FCFA` : undefined,
        TOTAL: `${Number(d.montantTotal).toLocaleString('fr-FR')} FCFA`,
        MONTANT_PAYE: d.montantPaye ? `${Number(d.montantPaye).toLocaleString('fr-FR')} FCFA` : undefined,
        RESTE: d.statutPaiement !== 'PAYE' ? `${Math.max(0, (Number(d.montantNet ?? d.montantTotal) || 0) - (Number(d.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA` : undefined,
        MODE_PAIEMENT: d.modePaiement,
        NUMERO_BON: d.numeroBon || undefined,
        OBSERVATION: d.observation || undefined,
      }

      setPrintData(templateData)
      setPrintPreviewOpen(true)
    } catch (e) {
      console.error("Erreur impression:", e)
      showError("Impossible d'ouvrir l'aperçu avant impression. Une erreur est survenue lors de la préparation du document.")
    }
  }

  const refetchProduits = () => {
    fetch('/api/produits?complet=1')
      .then(async (r) => {
        if (!r.ok) return []
        const data = await r.json()
        // Mode complet retourne directement un tableau
        return Array.isArray(data) ? data : []
      })
      .then(setProduits)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/magasins').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/clients?limit=1000').then(async (r) => {
        if (!r.ok) return []
        const data = await r.json()
        if (data.data && Array.isArray(data.data)) {
          return data.data
        }
        return Array.isArray(data) ? data : []
      }),
      fetch('/api/produits?complet=1').then(async (r) => {
        if (!r.ok) return []
        const data = await r.json()
        // Mode complet retourne directement un tableau
        return Array.isArray(data) ? data : []
      }),
    ]).then(([m, c, p]) => {
      setMagasins(Array.isArray(m) ? m : [])
      setClients(Array.isArray(c) ? c : [])
      setProduits(Array.isArray(p) ? p : [])
    })
  }, [])

  // Rafraîchir la liste des produits à chaque ouverture du formulaire « Nouvelle vente »
  useEffect(() => {
    if (form) refetchProduits()
  }, [form])

  // Écouter les événements de création de produit depuis d'autres pages
  useEffect(() => {
    const handleProduitCreated = () => {
      refetchProduits()
    }
    window.addEventListener('produit-created', handleProduitCreated)
    return () => window.removeEventListener('produit-created', handleProduitCreated)
  }, [])

  const fetchVentes = (overrideDeb?: string, overrideFin?: string, page?: number) => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page ?? currentPage),
      limit: '20'
    })
    const deb = overrideDeb ?? dateDebut
    const fin = overrideFin ?? dateFin
    if (deb) params.set('dateDebut', deb)
    if (fin) params.set('dateFin', fin)
    if (filterClientId) params.set('clientId', filterClientId)
    // Filtres de recherche avancée
    if (searchNumero) params.set('numero', searchNumero)
    if (searchNumeroBon) params.set('numeroBon', searchNumeroBon)
    if (searchClient) params.set('clientSearch', searchClient)
    if (typeVenteFilter) params.set('typeVente', typeVenteFilter)
    fetch('/api/ventes?' + params.toString())
      .then((r) => (r.ok ? r.json() : { data: [], pagination: null, totals: null }))
      .then((response) => {
        if (response && response.data) {
          setVentes(response.data)
          setPagination(response.pagination || { page: 1, limit: 20, total: response.data.length, totalPages: 1 })
          setTotals(response.totals)
        } else {
          const arr = extractList(response) as typeof ventes
          setVentes(arr)
          setPagination({ page: 1, limit: 20, total: arr.length, totalPages: 1 })
          setTotals(null)
        }
      })
      .finally(() => setLoading(false))
  }

  const handlePrintAll = async () => {
    setIsPrinting(true)
    try {
      const params = new URLSearchParams({ limit: '10000', page: '1' })
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (filterClientId) params.set('clientId', filterClientId)
      if (searchNumero) params.set('numero', searchNumero)
      if (searchNumeroBon) params.set('numeroBon', searchNumeroBon)
      if (searchClient) params.set('clientSearch', searchClient)
      if (typeVenteFilter) params.set('typeVente', typeVenteFilter)
      const res = await fetch('/api/ventes?' + params.toString())
      if (res.ok) {
        const response = await res.json()
        setAllVentesForPrint(extractList(response))
        setTimeout(() => { window.print(); setIsPrinting(false) }, 0)
      } else {
        setIsPrinting(false)
      }
    } catch (e) {
      console.error(e)
      setIsPrinting(false)
    }
  }

  useEffect(() => {
    fetchVentes()
  }, [currentPage])

  const handleEditVente = useCallback((v: { id: number }) => {
    setEditingVente(v)
    setEditingVenteId(v.id)
    setForm(true)
  }, [])

  const handleEditVenteModal = useCallback((v: { id: number }) => {
    setEditingVenteModalId(v.id)
  }, [])


  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N ou Cmd+N : Nouvelle vente
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !form) {
        e.preventDefault()
        setForm(true)
      }
      // Échap : Fermer les modals
      if (e.key === 'Escape') {
        if (form) {
          setForm(false)
        } else if (detailVente) {
          setDetailVente(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [form, detailVente])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchVentes(undefined, undefined, page)
  }

  const handleVoirDetail = useCallback(async (id: number) => {
    setDetailVente(null)
    setDetailRetours([])
    setLoadingDetail(id)
    try {
      const res = await fetch(`/api/ventes/${id}`)
      if (res.ok) {
        const vente = await res.json()
        setDetailVente(vente)
        const r = await fetch(`/api/ventes/${id}/retour`)
        if (r.ok) setDetailRetours(await r.json())
      }
    } finally {
      setLoadingDetail(null)
    }
  }, [])

  // Ouvrir le détail d'une vente si ?open=id dans l'URL (ex. depuis la recherche)
  useEffect(() => {
    const id = openIdParam ? Number(openIdParam) : NaN
    if (Number.isInteger(id) && id > 0) {
      handleVoirDetail(id)
    }
  }, [openIdParam, handleVoirDetail])

  const handleAnnuler = async (v: { id: number; numero: string; statut: string }) => {
    if (v.statut === 'ANNULEE') return
    if (!confirm(`Annuler la vente ${v.numero} ? Le stock sera recrédité.`)) return
    setAnnulant(v.id)
    setErr('')
    try {
      const res = await fetch(`/api/ventes/${v.id}/annuler`, { method: 'POST' })
      if (res.ok) {
        setVentes((list) => list.map((x) => (x.id === v.id ? { ...x, statut: 'ANNULEE' } : x)))
        showSuccess(MESSAGES.VENTE_ANNULEE)
      } else {
        const d = await res.json()
        showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : formatApiError(d.error || 'Erreur lors de l\'annulation.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setAnnulant(null)
    }
  }

  const handleSupprimer = (v: { id: number; numero: string; lignes?: unknown[]; reglements?: unknown[] }) => {
    setDeleteConfirmTarget({
      id: v.id,
      numero: v.numero,
      lignesCount: v.lignes?.length ?? 0,
      reglementsCount: v.reglements?.length ?? 0,
    })
  }

  const handleConfirmSuppression = async () => {
    const target = deleteConfirmTarget
    if (!target) return
    setSupprimant(target.id)
    setDeleteConfirmTarget(null)
    setErr('')
    try {
      const res = await fetch(`/api/ventes/${target.id}`, { method: 'DELETE' })
      if (res.ok) {
        setVentes((list) => list.filter((x) => x.id !== target.id))
        if (detailVente?.id === target.id) setDetailVente(null)
        showSuccess(MESSAGES.VENTE_SUPPRIMEE)
      } else {
        const d = await res.json()
        showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : formatApiError(d.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setSupprimant(null)
    }
  }

  const handleLivrer = (v: { id: number; numero: string; lignes: Array<{ produitId: number; designation: string; quantite: number; quantiteLivree: number; prixUnitaire: number; montant: number }> }) => {
    if (!v.lignes) return
    const initial: Record<number, number> = {}
    v.lignes.forEach((l: { produitId: number; quantite: number; quantiteLivree: number }) => {
      const reste = l.quantite - (l.quantiteLivree || 0)
      if (reste > 0) initial[l.produitId] = reste
    })
    setDeliverQtys(initial)
    setDeliverVente(v)
  }

  const confirmDeliver = async () => {
    if (!deliverVente) return
    setSavingDeliver(true)
    setLivrant(deliverVente.id)
    try {
      const lignesLivrees = Object.entries(deliverQtys)
        .filter(([, q]) => Number(q) > 0)
        .map(([produitId, quantite]) => ({ produitId: Number(produitId), quantite: Number(quantite) }))
      const res = await fetch(`/api/ventes/${deliverVente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LIVRER', lignes: lignesLivrees }),
      })
      if (res.ok) {
        setDeliverVente(null)
        showSuccess('Livraison effectuée avec succès.')
        fetchVentes()
        if (detailVente?.id === deliverVente.id) handleVoirDetail(deliverVente.id)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la livraison.')
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setLivrant(null)
      setSavingDeliver(false)
    }
  }

  const handleRetrait = async (v: { id: number; numero: string }) => {
    router.push(`/dashboard/ventes/retraits?venteId=${v.id}`)
  }

  const refreshBanques = async () => {
    try {
      const r = await fetch('/api/banques', { cache: 'no-store' as any })
      const d = r.ok ? await r.json() : null
      setBanques(Array.isArray(d?.data) ? d.data : [])
      return Array.isArray(d?.data) ? d.data : []
    } catch {
      setBanques([])
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
          numero,
          nomBanque,
          libelle,
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
        if (target === 'REGLEMENT') setReglementData((prev) => ({ ...prev, banqueId: String(d.id) }))
      }
      setNewBanque({ numero: '', nomBanque: '', libelle: '', soldeInitial: '0', compteId: '' })
      setShowCreateBanque(false)
      showSuccess('Compte bancaire créé et sélectionné.')
    } catch (e) {
      showError('Erreur réseau lors de la création du compte bancaire.')
    } finally {
      setCreatingBanque(false)
    }
  }

  const openRetourModal = (v: { id: number; numero: string; lignes?: Array<{ produitId: number; designation: string; quantite: number; prixUnitaire: number; montant: number }>; magasinId?: number; magasin?: { id: number }; date: string; client?: { nom?: string }; clientLibre?: string | null }) => {
    setRetourModalVente(v)
    setRetourLignes((v.lignes || []).map((l: { produitId: number; designation: string; quantite: number; prixUnitaire: number; montant: number }) => {
      const p = produits.find(x => x.id === l.produitId)
      const st = p?.stocks?.find((s: { magasinId: number; quantite: number }) => s.magasinId === (v.magasinId || v.magasin?.id))
      const q = Number(l.quantite) || 1
      return {
        produitId: l.produitId,
        designation: l.designation,
        code: p?.code || '',
        quantite: 0,
        maxQuantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        unitaireTTC: (Number(l.montant) || 0) / q,
        stockActuel: st?.quantite ?? 0,
      }
    }))
    setRetourRemboursement(true)
    setRetourMode('ESPECES')
    setRetourBanqueId('')
    setRetourObservation('')
  }

  const handleRetour = async () => {
    if (!retourModalVente) return
    const lignes = retourLignes.filter((l: { quantite: number }) => l.quantite > 0)
    if (!lignes.length) { showError('Sélectionnez au moins un produit.'); return }
    setSavingRetour(true)
    try {
      const r = await fetch(`/api/ventes/${retourModalVente.id}/retour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lignes: lignes.map((l: { produitId: number; quantite: number }) => ({ produitId: l.produitId, quantite: l.quantite })),
          remboursement: retourRemboursement,
          modeRemboursement: retourMode,
          banqueId: retourMode !== 'ESPECES' ? retourBanqueId : null,
          observation: retourObservation || null,
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'Erreur réseau')
      showSuccess('Retour effectué avec succès.')
      setRetourModalVente(null)
      fetchVentes()
    } catch (e: unknown) {
      showError(formatApiError(e) || 'Erreur lors du retour.')
    } finally {
      setSavingRetour(false)
    }
  }

  const handleDeleteRetour = async (retourId: number) => {
    if (!confirm('Supprimer définitivement ce retour ? Cette action est irréversible.')) return
    setDeletingRetourId(retourId)
    try {
      const res = await fetch(`/api/retours/${retourId}`, { method: 'DELETE' })
      if (res.ok) {
        setDetailRetours((prev) => prev.filter((r) => r.id !== retourId))
        showSuccess('Retour supprimé avec succès.')
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la suppression du retour.')
      }
    } catch {
      showError('Erreur réseau lors de la suppression.')
    } finally {
      setDeletingRetourId(null)
    }
  }

  const handleReglement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showReglement || savingReglement) return

    const montant = Number(reglementData.montant)
    if (isNaN(montant) || montant <= 0) {
      showError("Montant invalide.")
      return
    }

    if (montant > showReglement.reste) {
      showError(`Le montant ne peut pas dépasser le reste à payer (${showReglement.reste.toLocaleString('fr-FR')} F).`)
      return
    }

    setSavingReglement(true)
    try {
      const res = await fetch(`/api/ventes/${showReglement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant,
          modePaiement: reglementData.modePaiement,
          banqueId: ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(reglementData.modePaiement).toUpperCase()) && reglementData.banqueId
            ? Number(reglementData.banqueId)
            : undefined,
          date: reglementData.date || new Date().toISOString().split('T')[0]
        }),
      })
      
      if (res.ok) {
        showSuccess('Règlement enregistré avec succès.')
        setShowReglement(null)
        setReglementData({ montant: '', modePaiement: 'ESPECES', banqueId: '', date: new Date().toISOString().split('T')[0] })
        
        // Rafraîchir les données immédiatement
        fetchVentes()
        if (detailVente?.id === showReglement.id) {
          handleVoirDetail(showReglement.id)
        }
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors du règlement.')
      }
    } catch (e) {
      showError('Erreur réseau.')
    } finally {
      setSavingReglement(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration d'impression globale pour la page */}
      <style jsx global>{`
        @media print {
          @page { 
            size: landscape; 
            margin: 8mm; 
          }
          nav, aside, header, footer, .no-print, button, form, .flex-wrap, .Pagination, [role="pagination"], .fixed, .hide-on-print, .screen-only { 
            display: none !important; 
          }
          .screen-only {
            display: none !important;
          }
          .print-section { 
            display: block !important; 
          }
          .print-only { 
            display: block !important; 
          }
          body, main, .min-h-screen { 
            background: white !important; 
            color: black !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            overflow: visible !important;
          }
          .lg\\:pl-72 { padding-left: 0 !important; }
          main { width: 100% !important; display: block !important; }
          
          /* Afficher les KPIs à l'impression */
          .print-kpi { 
            display: grid !important; 
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 20px !important;
          }
          .print-kpi-item {
            border: 1px solid #ddd !important;
            padding: 10px !important;
            text-align: center !important;
            border-radius: 4px !important;
            background: #f9f9f9 !important;
          }
          .print-kpi-label {
            font-size: 10px !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
            color: #666 !important;
          }
          .print-kpi-value {
            font-size: 16px !important;
            font-weight: bold !important;
            color: #000 !important;
          }
          .print-kpi-sub {
            font-size: 8px !important;
            color: #888 !important;
          }
          
          /* Tableau d'impression */
          .print-table-container {
            page-break-after: auto !important;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9px !important;
          }
          .print-table th {
            background: #f0f0f0 !important;
            border: 1px solid #000 !important;
            padding: 6px !important;
            font-weight: bold !important;
            text-align: center !important;
          }
          .print-table td {
            border: 1px solid #000 !important;
            padding: 4px !important;
            text-align: center !important;
          }
          .print-table .text-left { text-align: left !important; }
          .print-table .text-right { text-align: right !important; }
          .print-total-row {
            background: #e0e0e0 !important;
            font-weight: bold !important;
          }
          
          /* En-tête et pied de page */
          .print-header {
            display: block !important;
            margin-bottom: 15px !important;
            text-align: center !important;
          }
          .print-header h1 {
            font-size: 18px !important;
            font-weight: bold !important;
            margin: 0 !important;
          }
          .print-header p {
            font-size: 12px !important;
            color: #666 !important;
            margin: 5px 0 0 0 !important;
          }
          .print-footer {
            display: block !important;
            margin-top: 15px !important;
            text-align: right !important;
            font-size: 10px !important;
            color: #666 !important;
          }
          
          /* Pagination */
          .print-pagination {
            display: block !important;
          }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Ventes</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Flux de ventes et encaissements clients</p>
        </div>
        <button
          onClick={() => setForm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          title="Nouvelle vente (Ctrl+N)"
        >
          <Plus className="h-4 w-4" />
          Nouvelle vente
          <span className="hidden sm:inline text-xs opacity-75 ml-1">(Ctrl+N)</span>
        </button>
        <button
          type="button"
          onClick={handlePrintAll}
          disabled={isPrinting}
          className="no-print flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 disabled:opacity-50"
          title="Imprimer la liste des ventes (selon filtres)"
        >
          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          {isPrinting ? 'Préparation...' : 'Imprimer'}
        </button>
        <a
          href="/dashboard/ventes/rapide"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-md transition-all"
          title="Ouvrir l'interface Vente Rapide (PRO)"
        >
          <CreditCard className="h-4 w-4" />
          Vente Rapide (PRO)
        </a>
      </div>

      {/* KPIs Professionnels - Ventes (Style Achats) */}
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 no-print">
          {[
            { label: "Chiffre d'Affaires", val: (totals?.montantTotal || 0).toLocaleString('fr-FR') + ' F', sub: "Volume de ventes période", icon: ShoppingBag, color: "bg-indigo-600" },
            { label: "Total Encaissé", val: (totals?.montantPaye || 0).toLocaleString('fr-FR') + ' F', sub: "Encaissements réels", icon: Wallet, color: "bg-emerald-600" },
            { label: "Reste à Recouvrer", val: (totals?.resteAPayer || 0).toLocaleString('fr-FR') + ' F', sub: "Créances clients en cours", icon: AlertTriangle, color: "bg-amber-600" },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl hover:scale-[1.02] transition-transform group shadow-indigo-900/10`}>
              <div className="relative z-10 text-white flex flex-col justify-between h-full">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                <div>
                  <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
                  <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                </div>
              </div>
              <c.icon className="absolute right-4 bottom-4 h-12 w-12 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>
      </div>

      {/* Sous-navigation ventes */}
      <div className="flex flex-wrap gap-1 no-print">
        {[
          { href: '/dashboard/ventes', label: 'Ventes' },
          { href: '/dashboard/ventes/toute', label: 'Toutes' },
          { href: '/dashboard/ventes/rapide', label: 'Rapide' },
          { href: '/dashboard/ventes/commandes', label: 'Commandes' },
          { href: '/dashboard/ventes/retours', label: 'Retours' },
          { href: '/dashboard/ventes/retraits', label: 'Retraits' },
          { href: '/dashboard/ventes/suivi', label: 'Suivi' },
          { href: '/dashboard/ventes/historiques', label: 'Historiques' },
        ].map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                active
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div>
          <label className="block text-xs font-medium text-gray-800">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-800">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="relative">
          <label className="block text-xs font-medium text-gray-800">Client (Filtrer)</label>
          <div className="relative mt-1">
            <input
              type="text"
              placeholder="Rechercher client..."
              value={filterClientSearch}
              onChange={(e) => {
                setFilterClientSearch(e.target.value)
                if (!e.target.value) setFilterClientId('')
              }}
              className="w-full min-w-[200px] rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm placeholder:text-gray-300"
            />
            {filterClientSearch && !filterClientId && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                <div 
                  className="cursor-pointer px-4 py-3 text-xs hover:bg-orange-50 font-black text-slate-900 border-b border-gray-100 uppercase tracking-tighter"
                  onMouseDown={(e) => { 
                    e.preventDefault(); // Empêche le focus de sortir de l'input
                    setFilterClientId(''); 
                    setFilterClientSearch('');
                  }}
                >
                  Tous les clients
                </div>
                {clients
                  .filter(c => c.nom.toLowerCase().includes(filterClientSearch.toLowerCase()) || (c.code && c.code.toLowerCase().includes(filterClientSearch.toLowerCase())))
                  .slice(0, 30) // Limiter pour la performance
                  .map(c => (
                    <div
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Empêche le focus de sortir de l'input
                        setFilterClientId(String(c.id));
                        setFilterClientSearch(c.nom);
                      }}
                      className="cursor-pointer px-4 py-3 text-sm hover:bg-orange-50 font-bold text-slate-900 border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span>{c.nom}</span>
                        <span className="text-[10px] text-gray-400 font-mono">#{c.code || c.id}</span>
                      </div>
                    </div>
                  ))
                }
                {clients.filter(c => c.nom.toLowerCase().includes(filterClientSearch.toLowerCase()) || (c.code && c.code.toLowerCase().includes(filterClientSearch.toLowerCase()))).length > 30 && (
                  <div className="px-4 py-2 text-[10px] text-gray-400 italic bg-gray-50 uppercase font-black text-center border-t border-gray-200">Affiner votre recherche...</div>
                )}
              </div>
            )}
            {filterClientId && (
               <button 
                 onClick={() => { setFilterClientId(''); setFilterClientSearch('') }}
                 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 <X className="h-3 w-3" />
               </button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-800">N° Facture</label>
          <input
            type="text"
            placeholder="Recherche..."
            value={searchNumero}
            onChange={(e) => setSearchNumero(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-32"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-800">N° Bon cmd</label>
          <input
            type="text"
            placeholder="Recherche..."
            value={searchNumeroBon}
            onChange={(e) => setSearchNumeroBon(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-32"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-800">Client (nom/code)</label>
          <input
            type="text"
            placeholder="Nom ou code client..."
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-800">Type</label>
          <select value={typeVenteFilter} onChange={(e) => setTypeVenteFilter(e.target.value)} className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm w-36 bg-white">
            <option value="">Tous</option>
            <option value="LIVRAISON_IMMEDIATE">Directe</option>
            <option value="COMMANDE">Commande</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setCurrentPage(1); fetchVentes(undefined, undefined, 1); }}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          Filtrer
        </button>
        <button
          type="button"
          onClick={() => { 
            setDateDebut(''); 
            setDateFin(''); 
            setFilterClientId(''); 
            setFilterClientSearch('');
            setSearchNumero('');
            setSearchNumeroBon('');
            setSearchClient('');
            setTypeVenteFilter('');
            setCurrentPage(1); 
            fetchVentes('', '', 1); 
          }}
          className="rounded-lg border-2 border-orange-400 bg-orange-100 px-3 py-1.5 text-sm font-medium text-orange-900 hover:bg-orange-200"
        >
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams()
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            params.set('statut', 'VALIDEE')
            window.location.href = `/api/ventes/export?${params.toString()}`
          }}
          className="rounded-lg border-2 border-green-500 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100 flex items-center gap-1.5"
          title="Exporter la liste des ventes en Excel"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exporter Excel
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams()
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            params.set('statut', 'VALIDEE')
            window.location.href = `/api/ventes/export-pdf?${params.toString()}`
          }}
          className="rounded-lg border-2 border-red-500 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 flex items-center gap-1.5"
          title="Exporter la liste des ventes en PDF"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exporter PDF
        </button>
      </div>

      {form && (
        <VenteFormModal
          magasins={magasins as any}
          clients={clients as any}
          produits={produits as any}
          ventes={ventes as any}
          banques={banques}
          tvaParDefaut={tvaParDefaut}
          editingVenteId={editingVenteId}
          onClose={() => { setForm(false); setEditingVenteId(null); setEditingVente(null) }}
          onSuccess={() => { setForm(false); setEditingVenteId(null); setEditingVente(null); setCurrentPage(1); fetchVentes() }}
        />
      )}

      <ModificationVenteModal
        isOpen={editingVenteModalId !== null}
        venteId={editingVenteModalId || 0}
        onClose={() => setEditingVenteModalId(null)}
        onSuccess={() => { setEditingVenteModalId(null); setCurrentPage(1); fetchVentes() }}
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : ventes.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Aucune vente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-orange-600">Bon N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 text-blue-600">Code Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Magasin</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Montant</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-amber-600">Retourné</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Net</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut paiement</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Reste à payer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ventes.map((v) => (
                  <VenteTableRow
                    key={v.id}
                    v={v}
                    userRole={userRole}
                    annulant={annulant}
                    supprimant={supprimant}
                    livrant={livrant}
                    loadingDetail={loadingDetail}
                    onEdit={handleEditVente}
                    onEditModal={handleEditVenteModal}
                    onPay={setShowReglement}
                    onView={handleVoirDetail}
                    onReturn={openRetourModal}
                    onCancel={handleAnnuler}
                    onDelete={handleSupprimer}
                    onDeliver={handleLivrer}
                    onRetrait={handleRetrait}
                  />
                ))}
              </tbody>
              {totals && (
                <tfoot className="bg-orange-50 font-bold text-gray-900 border-t-2 border-orange-200">
                  <tr>
                    <td colSpan={6} className="px-4 py-3 uppercase text-[10px] tracking-wider text-orange-800 font-black italic">Total de la Période</td>
                    <td className="px-4 py-3 text-right text-orange-700 bg-orange-100/50">
                      {totals.montantTotal.toLocaleString('fr-FR')} F
                    </td>
                    <td colSpan={2} className="px-4 py-3 bg-gray-50/30"></td>
                    <td colSpan={3} className="px-4 py-3 bg-gray-50/30"></td>
                    <td className="px-4 py-3 text-right text-red-700 bg-red-50/50">
                      {totals.resteAPayer.toLocaleString('fr-FR')} F
                    </td>
                    <td colSpan={2} className="px-4 py-3 bg-gray-50/30"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {pagination && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {detailVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailVente(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Détail vente {detailVente.numero}</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={imprimerVente} className="rounded-lg border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1.5" title="Imprimer le reçu">
                  <Printer className="h-4 w-4" />
                  Imprimer
                </button>
                {detailVente.statut !== 'ANNULEE' && (
                  <button
                    onClick={() => {
                      setEditingVenteModalId(detailVente.id)
                      setDetailVente(null)
                    }}
                    className="rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 flex items-center gap-1.5"
                    title="Modifier cette facture"
                  >
                    <Edit2 className="h-4 w-4" />
                    Modifier
                  </button>
                )}
                {detailVente.statutPaiement !== 'PAYE' && detailVente.statut !== 'ANNULEE' && (
                  <button
                    onClick={() => {
                      setShowReglement({ id: detailVente.id, numero: detailVente.numero, reste: Number(detailVente.montantTotal) - (Number(detailVente.montantPaye) || 0) })
                    }}
                    className="rounded-lg border-2 border-orange-300 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 flex items-center gap-1.5"
                    title="Enregistrer un nouveau règlement"
                  >
                    <Wallet className="h-4 w-4" />
                    Régler
                  </button>
                )}
                <button onClick={() => setDetailVente(null)} className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700">×</button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div><span className="font-medium text-gray-700">Date :</span> <span className="text-gray-900">{new Date(detailVente.date).toLocaleString('fr-FR')}</span></div>
                <div><span className="font-medium text-gray-700">Magasin :</span> <span className="text-gray-900">{detailVente.magasin.code} – {detailVente.magasin.nom}</span></div>
                <div><span className="font-medium text-gray-700">Client :</span> <span className="text-gray-900">{detailVente.client?.nom || detailVente.clientLibre || '—'}</span></div>
                <div><span className="font-medium text-gray-700">Paiement :</span> <span className="text-gray-900">{detailVente.modePaiement}</span></div>
                <div><span className="font-medium text-gray-700">Statut paiement :</span>
                  <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${(() => { const c = getStatutPaiementColors(detailVente.statutPaiement || ''); return `${c.bg} ${c.text} ${c.border}` })()}`}>
                    {getStatutPaiementLabel(detailVente.statutPaiement || '')}
                  </span>
                </div>
                <div><span className="font-medium text-gray-700">Montant total :</span> <span className="text-gray-900">{(Number(detailVente.montantTotal) || 0).toLocaleString('fr-FR')} FCFA</span></div>
                <div><span className="font-medium text-gray-700">Montant retourné :</span> <span className="text-amber-600">{(Number(detailVente.montantRetourne) || 0).toLocaleString('fr-FR')} FCFA</span></div>
                <div><span className="font-medium text-gray-700">Net :</span> <strong className="text-gray-900">{(Number(detailVente.montantNet ?? detailVente.montantTotal) || 0).toLocaleString('fr-FR')} FCFA</strong></div>
                <div><span className="font-medium text-gray-700">Montant payé (avance) :</span> <span className="text-gray-900">{(Number(detailVente.montantPaye) || 0).toLocaleString('fr-FR')} FCFA</span></div>
                <div><span className="font-medium text-gray-700">Reste à payer :</span> <strong className="text-amber-800">{Math.max(0, (Number(detailVente.montantNet ?? detailVente.montantTotal) || 0) - (Number(detailVente.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA</strong></div>
                <div><span className="font-medium text-gray-700">Statut :</span>
                  <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${
                    detailVente.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' :
                      'bg-green-100 text-green-800'
                  }`}>
                    {detailVente.statut === 'ANNULEE' ? 'Annulée' :
                      'Validée'}
                  </span>
                </div>
                {detailVente.numeroBon && (
                  <div><span className="font-medium text-orange-600">Numéro de BON :</span> <span className="text-gray-900 font-bold">{detailVente.numeroBon}</span></div>
                )}
              </div>
              {detailVente.observation && <p className="text-sm"><span className="font-medium text-gray-700">Observation :</span> <span className="text-gray-900">{detailVente.observation}</span></p>}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b bg-gray-50 text-left text-gray-800"><th className="px-4 py-2">Désignation</th><th className="px-4 py-2 text-right">Qté</th><th className="px-4 py-2 text-right">P.U.</th><th className="px-4 py-2 text-right">Remise</th><th className="px-4 py-2 text-right">TVA</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailVente.lignes.map((l, i) => (
                      <tr key={i}><td className="px-4 py-2 text-gray-900">{l.designation}</td><td className="px-4 py-2 text-right text-gray-900">{l.quantite}</td><td className="px-4 py-2 text-right text-gray-900">{(l.prixUnitaire).toLocaleString('fr-FR')} F</td><td className="px-4 py-2 text-right text-red-600">{(l.remise ? `-${l.remise}` : '0')} F</td><td className="px-4 py-2 text-right text-gray-900">{Number((l as any).tvaPerc ?? (l as any).tva ?? 0) || 0}%</td><td className="px-4 py-2 text-right font-medium text-emerald-700">{(l.montant).toLocaleString('fr-FR')} F</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right font-semibold text-gray-900">Montant total : {Number(detailVente.montantTotal).toLocaleString('fr-FR')} FCFA</p>
              {Number(detailVente.remiseGlobale) > 0 && (
                <p className="text-right text-sm text-red-600 font-medium">Remise globale : -{Number(detailVente.remiseGlobale).toLocaleString('fr-FR')} FCFA</p>
              )}

              {detailRetours.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Retours de marchandise ({detailRetours.length})
                  </h3>
                  {detailRetours.map((retour) => (
                    <div key={retour.id} className="mb-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium text-amber-800">{retour.numero}</span>
                        <div className="flex items-center gap-2">
                          {retour.estRembourse ? (
                            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Remboursé</span>
                          ) : (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">Non remboursé</span>
                          )}
                          <span>{new Date(retour.createdAt).toLocaleString('fr-FR')}</span>
                        </div>
                      </div>
                      <table className="min-w-full text-xs">
                        <thead><tr className="border-b border-amber-200 text-left text-gray-600"><th className="pb-1 pr-3">Produit</th><th className="pb-1 pr-3 text-right">Qté</th><th className="pb-1 pr-3 text-right">P.U.</th><th className="pb-1 pr-3 text-right text-red-500">Remise</th><th className="pb-1 pr-3 text-right text-blue-500">TVA</th><th className="pb-1 text-right">Total</th></tr></thead>
                        <tbody>
                          {retour.lignes.map((l: { designation: string; quantite: number; prixUnitaire: number; remise: number; tva: number; montant: number }, i: number) => (
                            <tr key={i} className="border-b border-amber-100">
                              <td className="py-1 pr-3 text-gray-900">{l.designation}</td>
                              <td className="py-1 pr-3 text-right text-gray-900">{l.quantite}</td>
                              <td className="py-1 pr-3 text-right text-gray-900">{l.prixUnitaire.toLocaleString('fr-FR')} F</td>
                              <td className="py-1 pr-3 text-right text-red-600">{l.remise ? `-${l.remise}` : '0'} F</td>
                              <td className="py-1 pr-3 text-right text-blue-600">{l.tva || 0}%</td>
                              <td className="py-1 text-right font-medium text-amber-700">{l.montant.toLocaleString('fr-FR')} F</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
                        <span>Par : {retour.utilisateur?.nom || '—'}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-amber-800">Total retourné : {retour.montantTotal.toLocaleString('fr-FR')} F</span>
                          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                            <button
                              onClick={() => handleDeleteRetour(retour.id)}
                              disabled={deletingRetourId === retour.id}
                              className="rounded p-1 text-red-500 hover:bg-red-100 disabled:opacity-50"
                              title="Supprimer ce retour"
                            >
                              {deletingRetourId === retour.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      {retour.observation && <p className="mt-1 text-xs text-gray-500 italic">{retour.observation}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintPreview
          isOpen={printPreviewOpen}
          onClose={() => setPrintPreviewOpen(false)}
          type="VENTE"
          data={printData}
          defaultTemplateId={defaultTemplateId}
        />
      )}

      {showReglement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Règlement Client {showReglement.numero}</h2>
              <button onClick={() => setShowReglement(null)} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleReglement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Reste à payer</label>
                <div className="mt-1 text-lg font-bold text-orange-600">{showReglement.reste.toLocaleString('fr-FR')} FCFA</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant du règlement *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  max={showReglement.reste}
                  value={reglementData.montant}
                  onChange={(e) => setReglementData(prev => ({ ...prev, montant: e.target.value }))}
                  placeholder={`Max ${showReglement.reste}`}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 bg-white focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
                <select
                  value={reglementData.modePaiement}
                  onChange={(e) => setReglementData(prev => ({ ...prev, modePaiement: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                </select>
              </div>
              {['MOBILE_MONEY', 'VIREMENT', 'CHEQUE'].includes(String(reglementData.modePaiement).toUpperCase()) && (
                <div className="rounded-lg border border-orange-100 bg-orange-50/30 p-3">
                  <label className="block text-sm font-medium text-gray-700">Compte bancaire *</label>
                  <select
                    required
                    value={reglementData.banqueId}
                    onChange={(e) => setReglementData(prev => ({ ...prev, banqueId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Sélectionner une banque...</option>
                    {banques.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nomBanque} — {b.libelle} ({b.numero})
                      </option>
                    ))}
                  </select>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateBanque((v) => !v)}
                      className="text-xs font-bold text-orange-700 hover:underline"
                    >
                      + Créer un compte
                    </button>
                    <button
                      type="button"
                      onClick={() => refreshBanques()}
                      className="text-xs font-bold text-gray-500 hover:underline"
                    >
                      Rafraîchir
                    </button>
                  </div>

                  {showCreateBanque && (
                    <div className="mt-3 rounded-lg border border-orange-200 bg-white p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Numéro *</label>
                          <input
                            value={newBanque.numero}
                            onChange={(e) => setNewBanque((s) => ({ ...s, numero: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Banque *</label>
                          <input
                            value={newBanque.nomBanque}
                            onChange={(e) => setNewBanque((s) => ({ ...s, nomBanque: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Libellé *</label>
                          <input
                            value={newBanque.libelle}
                            onChange={(e) => setNewBanque((s) => ({ ...s, libelle: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Solde initial</label>
                          <input
                            type="number"
                            value={newBanque.soldeInitial}
                            onChange={(e) => setNewBanque((s) => ({ ...s, soldeInitial: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Compte comptable (optionnel)</label>
                          <input
                            value={newBanque.compteId}
                            onChange={(e) => setNewBanque((s) => ({ ...s, compteId: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={creatingBanque}
                          onClick={() => createBanqueInline('REGLEMENT')}
                          className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white font-black hover:bg-orange-700 disabled:opacity-60"
                        >
                          {creatingBanque ? 'Création...' : 'Créer et sélectionner'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateBanque(false)}
                          className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date du règlement (si différente)</label>
                <input
                  type="date"
                  value={reglementData.date || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setReglementData(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingReglement}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {savingReglement ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enregistrer le règlement'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReglement(null)}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression détaillée */}
      <SuppressionConfirmModal
        isOpen={deleteConfirmTarget !== null}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={handleConfirmSuppression}
        titre={`Supprimer la vente ${deleteConfirmTarget?.numero ?? ''} ?`}
        message="Vous êtes sur le point de supprimer définitivement cette vente. Toutes les données associées seront effacées irréversiblement."
        details={[
          { label: 'Lignes de vente', count: deleteConfirmTarget?.lignesCount, description: 'produits et quantités vendus' },
          { label: 'Règlements', count: deleteConfirmTarget?.reglementsCount, description: 'paiements enregistrés' },
          { label: 'Écritures comptables', description: 'Grand Livre (VE, CA, OD) — TVA, créances, trésorerie' },
          { label: 'Mouvements caisse', description: 'entrées/sorties de caisse liées' },
          { label: 'Opérations bancaires', description: 'dépôts, virements avec inversion du solde' },
          { label: 'Mouvements de stock', description: 'sorties de stock annulées, quantité remise à niveau' },
          { label: 'Points fidélité', description: 'points clients déduits de l\'encaissement' },
        ]}
      />

      {/* Modal Retour de marchandise */}
      {retourModalVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              Retour de marchandise — {retourModalVente.numero}
            </h2>
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Client : <strong className="text-gray-700">{retourModalVente.client?.nom || retourModalVente.clientLibre || '—'}</strong></span>
              <span>Date : <strong className="text-gray-700">{new Date(retourModalVente.date).toLocaleString('fr-FR')}</strong></span>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Sélectionnez les produits à retourner, leur quantité et le mode de remboursement.
            </p>
            <div className="mb-4 max-h-[35vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs uppercase text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="pb-2 pr-2 text-left">Produit</th>
                    <th className="pb-2 pr-2 text-right">Max</th>
                    <th className="pb-2 pr-2 text-right">Stock</th>
                    <th className="pb-2 pr-2 text-right">Qté</th>
                    <th className="pb-2 pr-2 text-right">P.U.</th>
                    <th className="pb-2 text-right">Sous-total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {retourLignes.map((l, i) => {
                    const sousTotal = l.quantite * l.unitaireTTC
                    return (
                      <tr key={l.produitId}>
                        <td className="py-2 pr-2">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{l.designation}</p>
                          {l.code && <p className="text-[10px] text-gray-400">{l.code}</p>}
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-500">{l.maxQuantite}</td>
                        <td className="py-2 pr-2 text-right text-gray-500">{l.stockActuel}</td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            min={0}
                            max={l.maxQuantite}
                            value={l.quantite}
                            onChange={(e) => {
                              const v = Math.min(l.maxQuantite, Math.max(0, Number(e.target.value) || 0))
                              setRetourLignes(prev => prev.map((r, j) => j === i ? { ...r, quantite: v } : r))
                            }}
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-center text-sm"
                          />
                        </td>
                        <td className="py-2 pr-2 text-right text-gray-900">{l.prixUnitaire.toLocaleString('fr-FR')}</td>
                        <td className="py-2 text-right font-medium text-emerald-700">{sousTotal.toLocaleString('fr-FR')} F</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              <span>Total du retour</span>
              <span>{retourLignes.reduce((s, l) => s + l.quantite * l.unitaireTTC, 0).toLocaleString('fr-FR')} F</span>
            </div>
            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={retourRemboursement} onChange={(e) => setRetourRemboursement(e.target.checked)} className="rounded" />
                Effectuer un remboursement
              </label>
              {retourRemboursement && (
                <>
                  <select value={retourMode} onChange={(e) => setRetourMode(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="VIREMENT">Virement</option>
                  </select>
                  {retourMode !== 'ESPECES' && (
                    <select value={retourBanqueId} onChange={(e) => setRetourBanqueId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="">Sélectionnez un compte bancaire</option>
                      {banques.map((b: { id: number; nom: string; numeroCompte: string }) => (
                        <option key={b.id} value={b.id}>{b.nom} — {b.numeroCompte}</option>
                      ))}
                    </select>
                  )}
                </>
              )}
              <textarea
                placeholder="Observation (optionnelle)"
                value={retourObservation}
                onChange={(e) => setRetourObservation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRetourModalVente(null)}
                disabled={savingRetour}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRetour}
                disabled={savingRetour}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {savingRetour ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Valider le retour
              </button>
            </div>
          </div>
        </div>
      )}

      {deliverVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              Livraison — {deliverVente.numero}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Ajustez les quantités à livrer par produit.
            </p>
            <div className="mb-4 max-h-[50vh] overflow-y-auto space-y-3">
              {deliverVente.lignes
                .filter((l: { quantite: number; quantiteLivree?: number }) => l.quantite - (l.quantiteLivree || 0) > 0)
                .map((l: { produitId: number; designation: string; quantite: number; quantiteLivree?: number }) => {
                  const reste = l.quantite - (l.quantiteLivree || 0)
                  return (
                    <div key={l.produitId} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{l.designation}</p>
                        <p className="text-xs text-gray-400">Commandé: {l.quantite} / Reste: {reste}</p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.max(0, (prev[l.produitId] || reste) - 1) }))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        >−</button>
                        <input
                          type="number"
                          min={0}
                          max={reste}
                          value={deliverQtys[l.produitId] ?? reste}
                          onChange={(e) => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.min(reste, Math.max(0, Number(e.target.value) || 0)) }))}
                          className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-center text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setDeliverQtys(prev => ({ ...prev, [l.produitId]: Math.min(reste, (prev[l.produitId] || reste) + 1) }))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                        >+</button>
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              <span>Total à livrer</span>
              <span>{Object.values(deliverQtys).reduce((s: number, q: number) => s + q, 0)} article(s)</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeliverVente(null)}
                disabled={savingDeliver}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >Annuler</button>
              <button
                onClick={confirmDeliver}
                disabled={savingDeliver || Object.values(deliverQtys).every((q: number) => q <= 0)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingDeliver ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Livrer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        {(() => {
          if (!allVentesForPrint.length) return null
          const entite = entreprise
            ? (entreprise.nom || entreprise.raisonSociale || 'GestiCom')
            : 'GestiCom'
          const today = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric'
          })
          const periode = (dateDebut || dateFin)
            ? 'Période: ' + (dateDebut ? new Date(dateDebut).toLocaleDateString('fr-FR') : '...') + ' au ' + (dateFin ? new Date(dateFin).toLocaleDateString('fr-FR') : '...')
            : 'Toutes périodes'
          const pages = paginateForPrint(allVentesForPrint, { otherPagesSize: 20 })
          return pages.map((pageData, pageIdx) => (
            <div key={pageIdx} className="print-page">
              <ListPrintWrapper
                title="Flux de ventes et encaissements clients"
                subtitle={`${entite} • ${today} • ${periode}`}
                pageNumber={pageIdx + 1}
                totalPages={pages.length}
              >
                <div className="flex gap-4 mb-4">
                  <div className="flex-1 border rounded p-2 text-center bg-gray-50">
                    <div className="text-xs font-bold uppercase text-gray-500">Chiffre d'Affaires</div>
                    <div className="text-lg font-bold">{(allVentesForPrint.reduce((s, v) => s + Number(v.montantTotal), 0)).toLocaleString('fr-FR')} F</div>
                    <div className="text-xs text-gray-400">Volume de ventes période</div>
                  </div>
                  <div className="flex-1 border rounded p-2 text-center bg-gray-50">
                    <div className="text-xs font-bold uppercase text-gray-500">Total Encaissé</div>
                    <div className="text-lg font-bold">{(allVentesForPrint.reduce((s, v) => s + (Number(v.montantPaye) || 0), 0)).toLocaleString('fr-FR')} F</div>
                    <div className="text-xs text-gray-400">Encaissements réels</div>
                  </div>
                  <div className="flex-1 border rounded p-2 text-center bg-gray-50">
                    <div className="text-xs font-bold uppercase text-gray-500">Reste à Recouvrer</div>
                    <div className="text-lg font-bold">{(allVentesForPrint.reduce((s, v) => s + Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0)), 0)).toLocaleString('fr-FR')} F</div>
                    <div className="text-xs text-gray-400">Créances clients en cours</div>
                  </div>
                </div>
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-1 text-left">N°</th>
                      <th className="border p-1 text-left">Bon N°</th>
                      <th className="border p-1 text-left">Date</th>
                      <th className="border p-1 text-left">Code Client</th>
                      <th className="border p-1 text-left">Client</th>
                      <th className="border p-1 text-left">Magasin</th>
                      <th className="border p-1 text-right">Montant</th>
                      <th className="border p-1 text-left">Paiement</th>
                      <th className="border p-1 text-left">Statut</th>
                      <th className="border p-1 text-right">Reste</th>
                      <th className="border p-1 text-left">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((v: { id: number; numero: string; numeroBon?: string; date: string; montantTotal: number; montantPaye?: number; modePaiement: string; statutPaiement?: string; statut: string; magasin: { code: string }; client?: { code?: string; nom?: string }; clientLibre?: string }) => {
                      const rp = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))
                      return (
                        <tr key={v.id}>
                          <td className="border p-1">{v.numero}</td>
                          <td className="border p-1">{(v as any).numeroBon || '—'}</td>
                          <td className="border p-1">{formatDate(v.date, { includeTime: false })}</td>
                          <td className="border p-1">{(v as any).client?.code || '—'}</td>
                          <td className="border p-1">{(v as any).client?.nom || (v as any).clientLibre || '—'}</td>
                          <td className="border p-1">{v.magasin.code}</td>
                          <td className="border p-1 text-right">{Number(v.montantTotal).toLocaleString('fr-FR')} F</td>
                          <td className="border p-1">{v.modePaiement.replace('_', ' ')}</td>
                           <td className="border p-1">{getStatutPaiementLabel(v.statutPaiement || '')}</td>
                           <td className="border p-1 text-right">{rp > 0 ? rp.toLocaleString('fr-FR') + ' F' : '-'}</td>
                          <td className="border p-1">{v.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {pageIdx === pages.length - 1 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={6} className="border p-1 text-right">TOTAUX</td>
                        <td className="border p-1 text-right">{(allVentesForPrint.reduce((s, v) => s + Number(v.montantTotal), 0)).toLocaleString('fr-FR')} F</td>
                        <td colSpan={2} className="border p-1"></td>
                        <td className="border p-1 text-right">{(allVentesForPrint.reduce((s, v) => s + Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0)), 0)).toLocaleString('fr-FR')} F</td>
                        <td className="border p-1"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </ListPrintWrapper>
            </div>
          ))
        })()}
      </div>
    </div>
  )
}
