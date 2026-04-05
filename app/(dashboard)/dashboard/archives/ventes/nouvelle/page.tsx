'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { 
  ShoppingBag, Plus, Loader2, Trash2, Eye, FileSpreadsheet, Printer, X, 
  Search, Scan, Camera, Edit2, Pencil, Trash, CreditCard, Wallet, UserPlus, 
  AlertTriangle, Calculator, FileText, ChevronRight, HelpCircle, XCircle, ShoppingCart, Percent
} from 'lucide-react'
import { printDocument, generateLignesHTML, type TemplateData } from '@/lib/print-templates'
import PrintPreview from '@/components/print/PrintPreview'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import Pagination from '@/components/ui/Pagination'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import { formatDate } from '@/lib/format-date'

// Chargement dynamique du scanner (évite les erreurs SSR liées au DOM et à la webcam)
const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false })

type Magasin = { id: number; code: string; nom: string }
type Client = { id: number; nom: string; type: string }
type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  categorie?: string; 
  prixVente: number | null;
  stocks: Array<{ magasinId: number; quantite: number }>; prixAchat?: number | null 
}
type Ligne = { produitId: number; designation: string; code?: string; quantite: number; prixUnitaire: number; tvaPerc?: number; remise?: number }

export default function ArchivesVentesNouvellePage() {
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
    montantPaye?: number
    statutPaiement?: string
    modePaiement: string
    statut: string
    magasin: { code: string; nom: string }
    lignes: Array<{ quantite: number; prixUnitaire: number; designation: string; tvaPerc?: number }>
  }>>([])
  const [annulant, setAnnulant] = useState<number | null>(null)
  const [supprimant, setSupprimant] = useState<number | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [detailVente, setDetailVente] = useState<{
    id: number
    numero: string
    date: string
    montantTotal: number
    remiseGlobale: number
    montantPaye?: number
    statutPaiement?: string
    modePaiement: string
    statut: string
    clientLibre: string | null
    observation: string | null
    magasin: { code: string; nom: string }
    client: { nom: string; telephone?: string | null; adresse?: string | null; ncc?: string | null } | null
    lignes: Array<{ designation: string; quantite: number; prixUnitaire: number; tvaPerc?: number; remise?: number | string; montant: number }>
  } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(true)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [totals, setTotals] = useState<{ montantTotal: number; montantPaye: number; resteAPayer: number } | null>(null)
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD local
    magasinId: '',
    clientId: '',
    clientLibre: '',
    modePaiement: 'ESPECES',
    montantPaye: '',
    lignes: [] as Ligne[],
    pointsGagnes: 0,
    numeroFactureOrigine: '',
  })
  const [ajoutProduit, setAjoutProduit] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    recherche: '',
    tvaPerc: '',
    remise: '',
    remiseType: 'MONTANT' as 'MONTANT' | 'POURCENT'
  })
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterClientSearch, setFilterClientSearch] = useState('')
  const [addLignesPopupOpen, setAddLignesPopupOpen] = useState(false)
  const [popupLignes, setPopupLignes] = useState<Ligne[]>([])
  const [popupAjoutProduit, setPopupAjoutProduit] = useState({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
  const [submitting, setSubmitting] = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)
  // État du scanner code-barres
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerContext, setScannerContext] = useState<'main' | 'popup'>('main')
  const [clientForm, setClientForm] = useState({
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    type: 'CASH',
    plafondCredit: '',
  })
  const [savingClient, setSavingClient] = useState(false)
  const [createClientAfter, setCreateClientAfter] = useState<(() => void) | null>(null)
  const [stockInsuffisantModal, setStockInsuffisantModal] = useState<{
    produitId: number
    produitDesignation: string
    quantiteDemandee: number
    quantiteDisponible: number
    magasinId: number
    lignes: Ligne[]
  } | null>(null)
  const [ajoutStockQuantite, setAjoutStockQuantite] = useState('')
  const [ajoutStockSaving, setAjoutStockSaving] = useState(false)
  const [showReglement, setShowReglement] = useState<{ id: number; numero: string; reste: number } | null>(null)
  const [reglementData, setReglementData] = useState({ montant: '', modePaiement: 'ESPECES' })
  const [savingReglement, setSavingReglement] = useState(false)

  // Récupérer le templateId par défaut pour VENTE
  // Récupérer le templateId par défaut pour VENTE
  const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null)
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<TemplateData | null>(null)
  const [tvaParDefaut, setTvaParDefaut] = useState(0)

  useEffect(() => {
    fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setTvaParDefaut(Number(d.tvaParDefaut) || 0) }).catch(() => { })
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
    const d = detailVente
    const dateDoc = new Date(d.date)
    // Toutes les lignes (articles) de la vente sont affichées sur une même facture
    const lignes = Array.isArray(d.lignes) ? d.lignes : []
    // Calculs conformes (TTC = HT Net + TVA sur Net)
    const totalCalc = lignes.reduce((acc, l: any) => {
      const q = l.quantite
      const pu = l.prixUnitaire
      const r = Number(l.remise) || 0
      const t = l.tvaPerc || 0
      const ht = q * pu
      const htNet = ht - r
      const tva = htNet * (t / 100)
      acc.ht += ht
      acc.remise += r
      acc.tva += tva
      return acc
    }, { ht: 0, remise: 0, tva: 0 })
    
    const lignesHtml = generateLignesHTML(lignes.map((l) => ({
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise: l.remise,
      montant: l.montant,
    })))

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
      TOTAL_TVA: totalCalc.tva > 0 ? `${Math.round(totalCalc.tva).toLocaleString('fr-FR')} FCFA` : undefined,
      TOTAL_REMISE: totalCalc.remise > 0 ? `${totalCalc.remise.toLocaleString('fr-FR')} FCFA` : undefined,
      REMISE_GLOBALE: d.remiseGlobale > 0 ? `${Number(d.remiseGlobale).toLocaleString('fr-FR')} FCFA` : undefined,
      TOTAL: `${Number(d.montantTotal).toLocaleString('fr-FR')} FCFA`,
      MONTANT_PAYE: d.montantPaye ? `${Number(d.montantPaye).toLocaleString('fr-FR')} FCFA` : undefined,
      RESTE: d.statutPaiement !== 'PAYE' ? `${(Number(d.montantTotal) - (Number(d.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA` : undefined,
      MODE_PAIEMENT: d.modePaiement,
      OBSERVATION: d.observation || undefined,
    }



    setPrintData(templateData)
    setPrintPreviewOpen(true)
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
      fetch('/api/clients').then(async (r) => {
        if (!r.ok) return []
        const data = await r.json()
        // S'assurer que c'est un tableau (gérer le format paginé ou non)
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
    fetch('/api/ventes?' + params.toString())
      .then((r) => (r.ok ? r.json() : { data: [], pagination: null, totals: null }))
      .then((response) => {
        if (response.data) {
          setVentes(response.data)
          setPagination(response.pagination)
          setTotals(response.totals)
        } else {
          // Compatibilité avec l'ancien format
          setVentes(Array.isArray(response) ? response : [])
          setPagination(null)
          setTotals(null)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchVentes()
  }, [currentPage])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N ou Cmd+N : Nouvelle vente
      if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !form && !addLignesPopupOpen) {
        e.preventDefault()
        setForm(true)
      }
      // Échap : Fermer les modals
      if (e.key === 'Escape') {
        if (addLignesPopupOpen) {
          setAddLignesPopupOpen(false)
          setErr('')
        } else if (form) {
          setForm(false)
        } else if (detailVente) {
          setDetailVente(null)
        } else if (showCreateClient) {
          setShowCreateClient(false)
          setCreateClientAfter(null)
          setErr('')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [form, addLignesPopupOpen, detailVente, showCreateClient])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchVentes(undefined, undefined, page)
  }

  // Ouvrir le détail d'une vente si ?open=id dans l'URL (ex. depuis la recherche)
  useEffect(() => {
    const id = openIdParam ? Number(openIdParam) : NaN
    if (Number.isInteger(id) && id > 0) {
      handleVoirDetail(id)
    }
  })
  const addLigne = () => {
    const pId = Number(ajoutProduit.produitId)
    const p = produits.find((x) => x.id === pId)
    if (!p) {
      showError('Sélectionnez un produit.')
      return
    }
    const qte = Number(ajoutProduit.quantite) || 0
    if (qte <= 0) {
      showError('Quantité invalide.')
      return
    }

    const tvaVal = ajoutProduit.tvaPerc !== '' ? Number(ajoutProduit.tvaPerc) : tvaParDefaut
    let remiseVal = Number(ajoutProduit.remise) || 0
    
    // Calcul de la remise si type pourcentage
    if (ajoutProduit.remiseType === 'POURCENT' && remiseVal > 0) {
      remiseVal = (Number(ajoutProduit.prixUnitaire) * qte) * (remiseVal / 100)
    }

    const nouvelleLigne: Ligne = {
      produitId: p.id,
      designation: p.designation,
      code: p.code,
      quantite: qte,
      prixUnitaire: Number(ajoutProduit.prixUnitaire),
      tvaPerc: tvaVal,
      remise: remiseVal
    }
    setFormData((f) => ({ ...f, lignes: [...f.lignes, nouvelleLigne] }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', recherche: '', tvaPerc: '', remise: '', remiseType: 'MONTANT' })
  }

  const editLigne = (i: number) => {
    const l = formData.lignes[i]
    setAjoutProduit({
      produitId: String(l.produitId),
      quantite: String(l.quantite),
      prixUnitaire: String(l.prixUnitaire),
      tvaPerc: String(l.tvaPerc || '0'),
      remise: String(l.remise || '0'),
      remiseType: 'MONTANT',
      recherche: l.designation
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
      const r = val.remise || 0
      const ht = q * pu
      const htNet = ht - r
      const tvaMontant = htNet * (t / 100)
      const montantLigne = htNet + tvaMontant

      acc.totalHT += ht
      acc.totalTVA += tvaMontant
      acc.totalRemise += r
      acc.totalAvantRemiseGlobale += montantLigne
      return acc
    },
    { totalHT: 0, totalTVA: 0, totalRemise: 0, totalAvantRemiseGlobale: 0 }
  )
  const total = Math.max(0, totalAvantRemiseGlobale)
  const pointsGagnes = Math.floor(total)

  const popupTotal = popupLignes.reduce((s, l) => s + ( (l.quantite * l.prixUnitaire) - (l.remise || 0) ) * (1 + (l.tvaPerc || 0) / 100), 0)

  const doEnregistrerVente = async (lignes: Ligne[]) => {
    const magasinId = Number(formData.magasinId)
    if (!magasinId || !lignes.length) return
    setErr('')
    setSubmitting(true)

    const requestData = {
      date: formData.date || undefined,
      magasinId,
      clientId: formData.clientId ? Number(formData.clientId) : null,
      clientLibre: formData.clientLibre.trim() || null,
      modePaiement: formData.modePaiement,
      montantPaye: formData.modePaiement === 'CREDIT' ? (formData.montantPaye !== '' ? Number(formData.montantPaye) : 0) : undefined,
      remiseGlobale: 0,
      lignes: lignes.map((l) => ({
        produitId: l.produitId,
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tvaPerc: l.tvaPerc || 0,
        remise: l.remise || 0,
      })),
      numeroFactureOrigine: formData.numeroFactureOrigine.trim() || null,
    }

    // Dans GestiCom Offline, on tente toujours l'enregistrement direct vers le serveur local.
    // La file d'attente (SyncQueue) n'est utilisée que si le serveur local est injoignable (géré dans le catch).

    try {
      const res = await fetch('/api/archives/ventes/nouvelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setForm(false)
        setAddLignesPopupOpen(false)
        setPopupLignes([])
        setPopupAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
        setFormData({
          date: new Date().toLocaleDateString('en-CA'),
          magasinId: '',
          clientId: '',
          clientLibre: '',
          modePaiement: 'ESPECES',
          montantPaye: '',
          lignes: [],
          pointsGagnes: 0,
          numeroFactureOrigine: '',
        })
        setCurrentPage(1)
        showSuccess(MESSAGES.VENTE_ENREGISTREE)
        fetchVentes(undefined, undefined, 1)
        setTimeout(() => fetchVentes(undefined, undefined, 1), 500)
      } else {
        if (data.error?.includes('Client introuvable')) {
          setCreateClientAfter(() => () => doEnregistrerVente(lignes))
          setShowCreateClient(true)
        } else if (data.error?.includes('Stock insuffisant')) {
          // Extraire les informations du message d'erreur
          const match = data.error.match(/Stock insuffisant pour (.+?) \(dispo: (\d+)\)/)
          if (match) {
            const designation = match[1]
            const quantiteDisponible = Number(match[2])
            // Trouver la ligne concernée
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
    await doEnregistrerVente(formData.lignes)
  }

  // Calculer points restants pour remise (Fidélité Pro)
  const clientSel = clients.find(c => c.id === Number(formData.clientId))
  // @ts-ignore
  const pointsClient = clientSel?.pointsFidelite || 0

  const addLigneInPopup = () => {
    const pid = Number(popupAjoutProduit.produitId)
    const q = Math.max(1, Math.floor(Number(popupAjoutProduit.quantite) || 0))
    const pu = Math.max(0, Number(popupAjoutProduit.prixUnitaire) || 0)
    const tvaLigne = popupAjoutProduit.tvaPerc !== '' ? Math.max(0, Number(popupAjoutProduit.tvaPerc)) : tvaParDefaut
    const p = Array.isArray(produits) ? produits.find((x) => x.id === pid) : undefined
    if (!p || !q) return
    setPopupLignes((prev) => [...prev, { produitId: pid, designation: p.designation, quantite: q, prixUnitaire: pu, tvaPerc: tvaLigne }])
    setPopupAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tvaPerc: '0', remise: '0', recherche: '' })
  }

  const removePopupLigne = (i: number) => {
    setPopupLignes((prev) => prev.filter((_, j) => j !== i))
  }

  const onSelectProduit = (id: string) => {
    const p = produits.find((x) => x.id === Number(id))
    if (p) {
      const prixDefaut = (p.prixVente && p.prixVente > 0) ? p.prixVente : (p.prixAchat ?? 0)
      setAjoutProduit((a) => ({ ...a, produitId: id, prixUnitaire: String(prixDefaut) }))
    }
  }

  /**
   * Callback déclenché quand le scanner détecte un code-barres.
   * Cherche le produit par code et le sélectionne automatiquement dans le formulaire.
   */
  const handleBarcodeScan = (code: string) => {
    setScannerOpen(false)
    const codeNorm = code.trim().toLowerCase()
    // Recherche 1 : par codeBarres (EAN-13, QR du produit physique)
    // Recherche 2 : par code interne GestiCom (fallback)
    const produit = produits.find(
      (p) =>
        (p as any).codeBarres?.trim().toLowerCase() === codeNorm ||
        p.code.trim().toLowerCase() === codeNorm
    )
    if (!produit) {
      showError(`Produit introuvable pour le code scanné : "${code}". Renseignez le champ "Code-barres" du produit dans le catalogue.`)
      return
    }
    const prixDefaut = (produit.prixVente && produit.prixVente > 0) ? produit.prixVente : (produit.prixAchat ?? 0)
    if (scannerContext === 'popup') {
      setPopupAjoutProduit((a) => ({
        ...a,
        produitId: String(produit.id),
        prixUnitaire: String(prixDefaut),
        recherche: produit.designation,
      }))
    } else {
      setAjoutProduit((a) => ({
        ...a,
        produitId: String(produit.id),
        prixUnitaire: String(prixDefaut),
        recherche: produit.designation,
      }))
    }
    showSuccess(`✅ Produit scanné : ${produit.designation}`)
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingClient(true)
    setErr('')
    try {
      const plaf = clientForm.type === 'CREDIT' && clientForm.plafondCredit
        ? Math.max(0, Number(clientForm.plafondCredit))
        : null
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: clientForm.nom.trim(),
          telephone: clientForm.telephone.trim() || null,
          email: clientForm.email.trim() || null,
          adresse: clientForm.adresse.trim() || null,
          type: clientForm.type,
          plafondCredit: plaf,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowCreateClient(false)
        setClients((prev) => [...prev, data])
        setFormData((f) => ({ ...f, clientId: String(data.id) }))
        if (createClientAfter) {
          createClientAfter()
        }
        setCreateClientAfter(null)
        setClientForm({
          nom: '',
          telephone: '',
          email: '',
          adresse: '',
          type: 'CASH',
          plafondCredit: '',
        })
        showSuccess('Client créé avec succès.')
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de la création.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setSavingClient(false)
    }
  }

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

  const handleSupprimer = async (v: { id: number; numero: string }) => {
    if (!confirm(`Supprimer définitivement la vente ${v.numero} ? Toutes les données liées (lignes, écritures, règlements) seront supprimées. Cette action est irréversible.`)) return
    setSupprimant(v.id)
    setErr('')
    try {
      const res = await fetch(`/api/ventes/${v.id}`, { method: 'DELETE' })
      if (res.ok) {
        setVentes((list) => list.filter((x) => x.id !== v.id))
        if (detailVente?.id === v.id) setDetailVente(null)
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

  const handleVoirDetail = async (id: number) => {
    setDetailVente(null)
    setLoadingDetail(id)
    try {
      const res = await fetch(`/api/ventes/${id}`)
      if (res.ok) setDetailVente(await res.json())
    } finally {
      setLoadingDetail(null)
    }
  }

  const handleReglement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showReglement) return
    setSavingReglement(true)
    try {
      const res = await fetch(`/api/ventes/${showReglement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montant: Number(reglementData.montant),
          modePaiement: reglementData.modePaiement
        }),
      })
      if (res.ok) {
        showSuccess('Règlement enregistré avec succès.')
        setShowReglement(null)
        setReglementData({ montant: '', modePaiement: 'ESPECES' })
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Archives des Ventes (Anciennes)</h1>
          <p className="mt-1 text-white/90 font-medium">Flux de ventes et encaissements clients</p>
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
        <a
          href="/dashboard/ventes/rapide"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-md transition-all"
          title="Ouvrir l'interface Vente Rapide"
        >
          <CreditCard className="h-4 w-4" />
          Vente Rapide (PRO)
        </a>
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
              className="w-full min-w-[150px] rounded-lg border border-gray-200 py-1.5 pl-3 pr-8 text-sm focus:border-orange-500 focus:outline-none"
            />
            {filterClientSearch && !filterClientId && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                <div 
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-orange-50 font-medium text-gray-500 border-b"
                  onClick={() => { setFilterClientId(''); setFilterClientSearch('') }}
                >
                  Tous les clients
                </div>
                {clients
                  .filter(c => c.nom.toLowerCase().includes(filterClientSearch.toLowerCase()))
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setFilterClientId(String(c.id))
                        setFilterClientSearch(c.nom)
                      }}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-orange-50"
                    >
                      {c.nom}
                    </div>
                  ))
                }
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
        <button
          type="button"
          onClick={() => { setCurrentPage(1); fetchVentes(undefined, undefined, 1); }}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          Filtrer
        </button>
        <button
          type="button"
          onClick={() => { setDateDebut(''); setDateFin(''); setFilterClientId(''); setCurrentPage(1); fetchVentes('', '', 1); }}
          className="rounded-lg border-2 border-orange-400 bg-orange-100 px-3 py-1.5 text-sm font-medium text-orange-900 hover:bg-orange-200"
        >
          Réinitialiser
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams({ limit: '1000' })
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            window.open('/api/ventes/export?' + params.toString(), '_blank')
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
            const params = new URLSearchParams({ limit: '1000' })
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            window.open('/api/ventes/export-pdf?' + params.toString(), '_blank')
          }}
          className="rounded-lg border-2 border-red-500 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 flex items-center gap-1.5"
          title="Exporter la liste des ventes en PDF"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exporter PDF
        </button>
      </div>

      {form && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nouvelle vente</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Référence Facture (Libre)</label>
                <input
                  type="text"
                  value={formData.numeroFactureOrigine}
                  onChange={(e) => setFormData((f) => ({ ...f, numeroFactureOrigine: e.target.value.toUpperCase() }))}
                  placeholder="Ex: FAC-2023-001"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Magasin *</label>
                <select
                  required
                  value={formData.magasinId}
                  onChange={(e) => setFormData((f) => ({ ...f, magasinId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">—</option>
                  {magasins.map((m) => (
                    <option key={m.id} value={m.id}>{m.code} – {m.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Client (optionnel)</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData((f) => ({ ...f, clientId: e.target.value, clientLibre: '' }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ou nom libre</label>
                <input
                  value={formData.clientLibre}
                  onChange={(e) => setFormData((f) => ({ ...f, clientLibre: e.target.value }))}
                  placeholder="Si pas de fiche client"
                  disabled={!!formData.clientId}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 disabled:bg-gray-100 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Paiement</label>
                <select
                  value={formData.modePaiement}
                  onChange={(e) => setFormData((f) => ({ ...f, modePaiement: e.target.value, montantPaye: e.target.value === 'CREDIT' ? f.montantPaye : '' }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CREDIT">Crédit</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Lignes</h3>
              <div className="mb-3 space-y-2">
                {/* Barre de recherche + bouton scanner */}
                <div className="relative group">
                  <div className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Taper le nom ou le code du produit..."
                    value={ajoutProduit.recherche || ''}
                    onChange={(e) => {
                      setAjoutProduit((a) => ({ ...a, recherche: e.target.value }))
                    }}
                    onFocus={refetchProduits}
                    className="w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all shadow-sm"
                  />
                  {ajoutProduit.recherche.length > 0 && !ajoutProduit.produitId && (
                    <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg animate-in fade-in zoom-in duration-200">
                      {produits
                        .filter(p => {
                          const search = ajoutProduit.recherche.toLowerCase()
                          return p.code.toLowerCase().includes(search) || p.designation.toLowerCase().includes(search)
                        })
                        .map((p) => {
                          const s = p.stocks?.find(s => s.magasinId === Number(formData.magasinId))?.quantite || 0
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setAjoutProduit(a => ({ ...a, produitId: String(p.id), recherche: p.designation, prixUnitaire: String(p.prixVente || p.prixAchat || '') }))
                              }}
                              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-orange-50 transition-colors border-b last:border-0"
                            >
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900">{p.designation}</span>
                                <span className="text-xs text-gray-400 font-mono">{p.code}</span>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                Stock: {s}
                              </span>
                            </button>
                          )
                        })}
                    </div>
                  )}
                  {ajoutProduit.produitId && (
                    <button 
                      onClick={() => setAjoutProduit(a => ({ ...a, produitId: '', recherche: '' }))}
                      className="absolute right-3 top-3 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {ajoutProduit.produitId && (
                  <div className="flex flex-col gap-1 px-1 py-1 animate-in slide-in-from-top-1 duration-200">
                    {!formData.magasinId && (
                      <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Veuillez sélectionner un magasin pour voir le stock exact.
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className="text-gray-500 italic">Produit sélectionné.</span>
                      <span className="text-gray-900">Stock disponible :</span>
                      <span className={`px-2 py-0.5 rounded-full shadow-sm text-sm font-bold ${
                        (produits.find(p => p.id === Number(ajoutProduit.produitId))?.stocks?.find(s => s.magasinId === Number(formData.magasinId))?.quantite || 0) > 0 
                        ? 'bg-green-600 text-white' 
                        : 'bg-red-600 text-white'
                      }`}>
                        {produits.find(p => p.id === Number(ajoutProduit.produitId))?.stocks?.find(s => s.magasinId === Number(formData.magasinId))?.quantite || 0}
                      </span>
                    </div>
                  </div>
                )}

              </div>
              <div className="mb-3 flex flex-wrap gap-2 items-center">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 ml-1 font-bold">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={ajoutProduit.quantite}
                    onChange={(e) => setAjoutProduit((a) => ({ ...a, quantite: e.target.value }))}
                    placeholder="Qté"
                    className="w-20 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 ml-1 font-bold">P.U. (HT)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={ajoutProduit.prixUnitaire}
                    onChange={(e) => setAjoutProduit((a) => ({ ...a, prixUnitaire: e.target.value }))}
                    placeholder="Prix HT"
                    className="w-28 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 ml-1 font-bold">Remise</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={ajoutProduit.remise}
                      onChange={(e) => setAjoutProduit((a) => ({ ...a, remise: e.target.value }))}
                      placeholder="Remise"
                      className="w-24 rounded-l border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setAjoutProduit(a => ({ ...a, remiseType: a.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT' }))}
                      className={`px-2 py-2 border border-l-0 border-gray-200 text-xs font-bold rounded-r transition-colors ${
                        ajoutProduit.remiseType === 'POURCENT' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-700'
                      }`}
                      title="Changer le mode de remise (Fixe ou %)"
                    >
                      {ajoutProduit.remiseType === 'MONTANT' ? 'F' : '%'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 ml-1 font-bold">TVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ajoutProduit.tvaPerc}
                    onChange={(e) => setAjoutProduit((a) => ({ ...a, tvaPerc: e.target.value }))}
                    placeholder={`TVA %`}
                    className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none bg-orange-50/30"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-orange-600 ml-1 font-bold">Total TTC</label>
                  <div className="w-28 rounded border border-orange-100 bg-orange-50 px-2 py-2 text-sm font-bold text-orange-800">
                    {(() => {
                      const q = Number(ajoutProduit.quantite || 0)
                      const pu = Number(ajoutProduit.prixUnitaire || 0)
                      const r = Number(ajoutProduit.remise || 0)
                      const t = Number(ajoutProduit.tvaPerc || 0)
                      const ht = q * pu
                      const rv = ajoutProduit.remiseType === 'MONTANT' ? r : ht * (r / 100)
                      return Math.round((ht - rv) * (1 + t / 100)).toLocaleString('fr-FR')
                    })()} F
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addLigne}
                  className="rounded-lg bg-orange-500 px-4 py-2 mt-auto text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-sm"
                >
                  Ajouter
                </button>
              </div>
              {formData.lignes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="pb-2">Désignation</th>
                        <th className="pb-2 text-right">Qté</th>
                        <th className="pb-2 text-right">P.U. (HT)</th>
                        <th className="pb-2 text-right">Total (HT)</th>
                        <th className="pb-2 text-right">Remise</th>
                        <th className="pb-2 text-right">TVA</th>
                        <th className="pb-2 text-right">Total TTC</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lignes.map((l, i) => {
                        const ht = l.quantite * l.prixUnitaire
                        const htApresRemise = ht - (l.remise || 0)
                        const tva = htApresRemise * ((l.tvaPerc || 0) / 100)
                        const ttc = htApresRemise + tva
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2">{l.designation}</td>
                            <td className="text-right">{l.quantite}</td>
                            <td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{ht.toLocaleString('fr-FR')} F</td>
                            <td className="text-right text-red-600">-{(l.remise || 0).toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{l.tvaPerc}%</td>
                            <td className="text-right font-bold text-emerald-700">{Math.round(ttc).toLocaleString('fr-FR')} F</td>
                            <td className="w-16">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  type="button"
                                  onClick={() => editLigne(i)}
                                  title="Modifier cette ligne"
                                  className="rounded p-1 text-blue-600 hover:bg-blue-100 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeLigne(i)}
                                  title="Supprimer la ligne"
                                  className="rounded p-1 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 flex flex-col items-end text-sm gap-2 border-t border-gray-200 pt-3">
                <p className="text-gray-600 flex justify-between w-64"><span>Total HT Brut :</span> <span className="font-bold">{totalHT.toLocaleString('fr-FR')} F</span></p>
                
                {totalRemise > 0 && (
                  <p className="text-red-500 flex justify-between w-64"><span>Total Remises :</span> <span>-{totalRemise.toLocaleString('fr-FR')} F</span></p>
                )}

                <p className="text-gray-600 flex justify-between w-64"><span>Total TVA :</span> <span className="font-bold">{totalTVA.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F</span></p>
                
                <p className="text-lg font-black text-white mt-2 bg-emerald-600 px-4 py-2 rounded shadow-lg w-64 flex justify-between ring-2 ring-emerald-500 ring-offset-2">
                  <span>TOTAL TTC :</span> <span>{total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA</span>
                </p>
              </div>
            </div>

            {formData.lignes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Paiement (avance / reste à payer)</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Total à payer</label>
                    <p className="mt-0.5 font-semibold text-gray-900">{total.toLocaleString('fr-FR')} FCFA</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Montant payé (avance)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.montantPaye}
                      onChange={(e) => setFormData((f) => ({ ...f, montantPaye: e.target.value }))}
                      placeholder={formData.modePaiement === 'CREDIT' ? '0' : String(total)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 bg-white focus:border-orange-500 focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">Laisser vide = tout payé (sauf si Crédit)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Reste à payer</label>
                    <p className="mt-0.5 font-semibold text-amber-800">
                      {Math.max(0, total - (Number(formData.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enregistrer la vente'}
              </button>
              <button
                type="button"
                onClick={() => setForm(false)}
                className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

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
                  <input
                    type="text"
                    placeholder="Rechercher un produit (code, désignation, catégorie)..."
                    value={popupAjoutProduit.recherche || ''}
                    onChange={(e) => {
                      setPopupAjoutProduit((a) => ({ ...a, recherche: e.target.value }))
                    }}
                    onFocus={refetchProduits}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <select
                  value={popupAjoutProduit.produitId}
                  onChange={(e) => {
                    const p = Array.isArray(produits) ? produits.find((x) => x.id === Number(e.target.value)) : undefined
                    if (p) {
                      // Utiliser prixAchat comme prix par défaut si prixVente est 0 ou null
                      const prixDefaut = (p.prixVente && p.prixVente > 0) ? p.prixVente : (p.prixAchat ?? 0)
                      setPopupAjoutProduit((a) => ({ ...a, produitId: e.target.value, prixUnitaire: String(prixDefaut) }))
                    }
                  }}
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                  title="Liste de tous les produits enregistrés"
                >
                  <option value="">Choisir un produit</option>
                  {Array.isArray(produits) && produits
                    .filter(p => {
                      if (!popupAjoutProduit.recherche) return true
                      const search = popupAjoutProduit.recherche.toLowerCase()
                      return (
                        p.code.toLowerCase().includes(search) ||
                        p.designation.toLowerCase().includes(search) ||
                        (p.categorie && p.categorie.toLowerCase().includes(search))
                      )
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.code} – {p.designation}</option>
                    ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <input
                  type="number"
                  min="1"
                  value={popupAjoutProduit.quantite}
                  onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, quantite: e.target.value }))}
                  placeholder="Qté"
                  className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={popupAjoutProduit.prixUnitaire}
                  onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, prixUnitaire: e.target.value }))}
                  placeholder="Prix (HT)"
                  className="w-24 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={popupAjoutProduit.remise}
                  onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, remise: e.target.value }))}
                  placeholder="Remise"
                  className="w-20 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={popupAjoutProduit.tvaPerc}
                  onChange={(e) => setPopupAjoutProduit((a) => ({ ...a, tvaPerc: e.target.value }))}
                  placeholder={`TVA %`}
                  className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-orange-500 focus:outline-none bg-orange-50/30"
                />
                <div className="flex flex-col gap-0.5 min-w-[80px]">
                  <span className="text-[10px] font-bold text-orange-600 ml-1">Total TTC</span>
                  <div className="rounded border border-orange-100 bg-orange-50 px-2 py-1.5 text-xs font-bold text-orange-800">
                    {(() => {
                      const q = Number(popupAjoutProduit.quantite || 0)
                      const pu = Number(popupAjoutProduit.prixUnitaire || 0)
                      const r = Number(popupAjoutProduit.remise || 0)
                      const t = Number(popupAjoutProduit.tvaPerc || 0)
                      const ht = q * pu
                      // Le popup n'a pas encore de type de remise, on suppose MONTANT pour rester conforme au comportement actuel du popup
                      return Math.round((ht - r) * (1 + t / 100)).toLocaleString('fr-FR')
                    })()} F
                  </div>
                </div>
                <button type="button" onClick={addLigneInPopup} className="rounded-lg border-2 border-orange-400 bg-orange-100 px-3 py-2 text-sm font-medium text-orange-900 hover:bg-orange-200">
                  Ajouter
                </button>
              </div>
              {popupLignes.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="pb-2">Désignation</th>
                          <th className="pb-2 text-right">Qté</th>
                          <th className="pb-2 text-right">P.U(HT)</th>
                          <th className="pb-2 text-right">Remise</th>
                          <th className="pb-2 text-right">TVA</th>
                          <th className="pb-2 text-right text-emerald-700">TTC</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {popupLignes.map((l, i) => {
                          const lHT = l.quantite * l.prixUnitaire
                          const lHTNet = lHT - (l.remise || 0)
                          const lTva = lHTNet * ((l.tvaPerc || 0) / 100)
                          const lTTC = lHTNet + lTva
                          return (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="py-2">{l.designation}</td>
                              <td className="text-right">{l.quantite}</td>
                              <td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td>
                              <td className="text-right text-red-600">-{ (l.remise || 0).toLocaleString('fr-FR') }</td>
                              <td className="text-right">{l.tvaPerc || 0}%</td>
                              <td className="text-right font-bold text-emerald-700">{Math.round(lTTC).toLocaleString('fr-FR')} F</td>
                              <td>
                                <button type="button" onClick={() => removePopupLigne(i)} className="rounded p-1.5 text-red-600 hover:bg-red-100" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-right text-base font-bold text-gray-900">Total : {popupTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA</p>
                </>
              )}
            </div>
            {popupLignes.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Choisissez un produit, la quantité et le prix puis cliquez sur &quot;Ajouter&quot;.</p>
            )}
            {err && addLignesPopupOpen && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2 justify-end border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => { setAddLignesPopupOpen(false); setErr(''); }}
                disabled={submitting}
                className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => doEnregistrerVente(popupLignes)}
                disabled={popupLignes.length === 0 || submitting}
                className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Valider et enregistrer la vente
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 text-blue-600">Code Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Magasin</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut paiement</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Reste à payer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ventes.map((v) => {
                  const resteAPayer = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))
                  return (
                    <tr key={v.id} className={v.statut === 'ANNULEE' ? 'bg-gray-100' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 font-mono text-sm text-gray-900">{v.numero}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(v.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-blue-600 uppercase">
                        {(v as any).client?.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                        {(v as any).client?.nom || (v as any).clientLibre || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.magasin.code}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {Number(v.montantTotal).toLocaleString('fr-FR')} F
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.modePaiement}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.statutPaiement === 'PAYE' ? 'bg-green-100 text-green-800' :
                          v.statutPaiement === 'PARTIEL' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                          {v.statutPaiement === 'PAYE' ? 'Payé' :
                            v.statutPaiement === 'PARTIEL' ? 'Partiel' :
                              'Crédit'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {resteAPayer > 0 ? `${resteAPayer.toLocaleString('fr-FR')} F` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                          {v.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {v.statutPaiement !== 'PAYE' && v.statut !== 'ANNULEE' && (
                            <button
                              onClick={() => setShowReglement({ id: v.id, numero: v.numero, reste: Number(v.montantTotal) - (Number(v.montantPaye) || 0) })}
                              className="rounded p-1.5 text-orange-600 hover:bg-orange-100"
                              title="Enregistrer un règlement"
                            >
                              <Wallet className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleVoirDetail(v.id)}
                            disabled={loadingDetail === v.id}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                            title="Voir le détail"
                          >
                            {loadingDetail === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          </button>
                          {v.statut === 'VALIDEE' && (
                            <button
                              onClick={() => handleAnnuler(v)}
                              disabled={annulant === v.id}
                              className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Annuler la vente"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                            <button
                              onClick={() => handleSupprimer(v)}
                              disabled={supprimant === v.id}
                              className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {totals && (
                <tfoot className="bg-orange-50 font-bold text-gray-900 border-t-2 border-orange-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 uppercase text-xs tracking-wider text-orange-800 font-black">Total de la Période</td>
                    <td className="px-4 py-3 text-right text-orange-700">{totals.montantTotal.toLocaleString('fr-FR')} F</td>
                    <td colSpan={2}></td>
                    <td className="px-4 py-3 text-right text-red-700">{totals.resteAPayer.toLocaleString('fr-FR')} F</td>
                    <td colSpan={2}></td>
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
                  <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${detailVente.statutPaiement === 'PAYE' ? 'bg-green-100 text-green-800' :
                    detailVente.statutPaiement === 'PARTIEL' ? 'bg-amber-100 text-amber-800' :
                      detailVente.statutPaiement === 'CREDIT' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                    {detailVente.statutPaiement === 'PAYE' ? 'Payé' : detailVente.statutPaiement === 'PARTIEL' ? 'Partiel' : detailVente.statutPaiement === 'CREDIT' ? 'Crédit' : '—'}
                  </span>
                </div>
                <div><span className="font-medium text-gray-700">Montant payé (avance) :</span> <span className="text-gray-900">{(Number(detailVente.montantPaye) || 0).toLocaleString('fr-FR')} FCFA</span></div>
                <div><span className="font-medium text-gray-700">Reste à payer :</span> <strong className="text-amber-800">{(Number(detailVente.montantTotal) - (Number(detailVente.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA</strong></div>
                <div><span className="font-medium text-gray-700">Statut :</span>
                  <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${detailVente.statut === 'ANNULEE' ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                    {detailVente.statut === 'ANNULEE' ? 'Annulée' : 'Validée'}
                  </span>
                </div>
              </div>
              {detailVente.observation && <p className="text-sm"><span className="font-medium text-gray-700">Observation :</span> <span className="text-gray-900">{detailVente.observation}</span></p>}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b bg-gray-50 text-left text-gray-800"><th className="px-4 py-2">Désignation</th><th className="px-4 py-2 text-right">Qté</th><th className="px-4 py-2 text-right">P.U.</th><th className="px-4 py-2 text-right">Remise</th><th className="px-4 py-2 text-right">TVA</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailVente.lignes.map((l, i) => (
                      <tr key={i}><td className="px-4 py-2 text-gray-900">{l.designation}</td><td className="px-4 py-2 text-right text-gray-900">{l.quantite}</td><td className="px-4 py-2 text-right text-gray-900">{(l.prixUnitaire).toLocaleString('fr-FR')} F</td><td className="px-4 py-2 text-right text-red-600">{(l.remise ? `-${l.remise}` : '0')} F</td><td className="px-4 py-2 text-right text-gray-900">{l.tvaPerc || 0}%</td><td className="px-4 py-2 text-right font-medium text-emerald-700">{(l.montant).toLocaleString('fr-FR')} F</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right font-semibold text-gray-900">Montant total : {Number(detailVente.montantTotal).toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>
        </div>
      )}

      {showCreateClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Créer un nouveau client</h2>
              <button
                onClick={() => {
                  setShowCreateClient(false)
                  setCreateClientAfter(null)
                  setErr('')
                }}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom *</label>
                <input
                  required
                  value={clientForm.nom}
                  onChange={(e) => setClientForm((f) => ({ ...f, nom: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                <input
                  value={clientForm.telephone}
                  onChange={(e) => setClientForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={clientForm.type}
                  onChange={(e) => setClientForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="CASH">CASH</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>
              {clientForm.type === 'CREDIT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plafond crédit (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={clientForm.plafondCredit}
                    onChange={(e) => setClientForm((f) => ({ ...f, plafondCredit: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingClient}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {savingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer et continuer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateClient(false)
                    setCreateClientAfter(null)
                    setErr('')
                  }}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          </div>
        </div>
      )}

      {/* Modal Stock Insuffisant */}
      {stockInsuffisantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStockInsuffisantModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stock insuffisant</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {stockInsuffisantModal.produitDesignation}
                </p>
              </div>
              <button onClick={() => setStockInsuffisantModal(null)} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 space-y-2 rounded-lg bg-red-50 p-4">
              <p className="text-sm text-gray-700">
                <strong>Quantité demandée :</strong> {stockInsuffisantModal.quantiteDemandee} unités
              </p>
              <p className="text-sm text-gray-700">
                <strong>Quantité disponible :</strong> {stockInsuffisantModal.quantiteDisponible} unités
              </p>
              <p className="text-sm font-semibold text-red-600">
                <strong>Manquant :</strong> {stockInsuffisantModal.quantiteDemandee - stockInsuffisantModal.quantiteDisponible} unités
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const quantite = Math.max(1, Math.floor(Number(ajoutStockQuantite) || 0))
                if (quantite <= 0) {
                  showError('La quantité doit être supérieure à 0.')
                  return
                }
                setAjoutStockSaving(true)
                try {
                  // Ajouter le stock
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
                    
                    // Rafraîchir les produits pour mettre à jour les disponibilités locales
                    refetchProduits()
                    
                    // Réessayer l'enregistrement de la vente après un court délai pour laisser le state se mettre à jour
                    setTimeout(() => {
                      doEnregistrerVente(stockInsuffisantModal.lignes)
                    }, 500)
                  } else {
                    showError(data.error || 'Erreur lors de l\'ajout du stock.')
                  }
                } catch (e) {
                  showError('Erreur réseau lors de l\'ajout du stock.')
                } finally {
                  setAjoutStockSaving(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Quantité à ajouter au stock
                </label>
                <input
                  type="number"
                  min="1"
                  value={ajoutStockQuantite}
                  onChange={(e) => setAjoutStockQuantite(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  placeholder="Quantité"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Quantité recommandée : {stockInsuffisantModal.quantiteDemandee - stockInsuffisantModal.quantiteDisponible} unités
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={ajoutStockSaving}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {ajoutStockSaving ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      Ajout en cours...
                    </>
                  ) : (
                    'Ajouter au stock et continuer'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStockInsuffisantModal(null)}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
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

      {/* Modal scanner code-barres — chargé dynamiquement, 100% offline */}
      {scannerOpen && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  )
}
