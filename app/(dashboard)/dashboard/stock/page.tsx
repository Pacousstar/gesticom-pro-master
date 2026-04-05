'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, X, Search, Minus, ClipboardList, FileSpreadsheet, Download, Printer, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import Pagination from '@/components/ui/Pagination'
type Magasin = { id: number; code: string; nom: string }
type Produit = { id: number; code: string; designation: string; prixAchat?: number | null }
type StockRow = {
  id: number | null
  quantite: number
  quantiteInitiale: number
  createdAt?: string
  produit: { id: number; code: string; designation: string; categorie: string; seuilMin: number; prixAchat: number | null; pamp: number | null; prixVente: number | null }
  magasin: { id: number; code: string; nom: string }
}

type AlerteRupture = {
  id: number
  code: string
  designation: string
  stockActuel: number
  vitesseVenteQuotidienne: number
  joursRestants: number
}

type Recommendation = {
  produitId: number
  codeProduit: string
  designation: string
  magasinOrigineId: number
  magasinOrigineNom: string
  magasinDestId: number
  magasinDestNom: string
  quantite: number
  estSourcePrincipale: boolean
  motif: string
}

export default function StockPage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [magasinId, setMagasinId] = useState<string>('')
  const [list, setList] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showEntree, setShowEntree] = useState(false)
  const [showSortie, setShowSortie] = useState(false)
  const [showInventaire, setShowInventaire] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editRow, setEditRow] = useState<StockRow | null>(null)
  const [entreeForm, setEntreeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    produitId: '',
    quantite: '1',
    observation: '',
  })
  const [sortieForm, setSortieForm] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    produitId: '',
    quantite: '1',
    observation: '',
  })
  const [inventaireReelles, setInventaireReelles] = useState<Record<string, string>>({})
  const [inventaireSaving, setInventaireSaving] = useState(false)
  const [editForm, setEditForm] = useState({ quantite: '', quantiteInitiale: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateProduit, setShowCreateProduit] = useState(false)
  const [deletingStock, setDeletingStock] = useState<StockRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [createProduitData, setCreateProduitData] = useState<{ magasinId: string; produitId?: string; afterCreate?: () => void } | null>(null)
  const [produitForm, setProduitForm] = useState({
    code: '',
    designation: '',
    categorie: 'DIVERS',
    magasinId: '',
    prixAchat: '',
    prixVente: '',
    seuilMin: '5',
    quantiteInitiale: '0',
  })
  const [categories, setCategories] = useState<string[]>(['DIVERS'])
  const [savingProduit, setSavingProduit] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const [stockInsuffisantModal, setStockInsuffisantModal] = useState<{
    produitId: number
    produitDesignation: string
    quantiteDemandee: number
    quantiteDisponible: number
    magasinId: number
    type: 'sortie' | 'vente'
    onSuccess?: () => void
  } | null>(null)
  const [ajoutStockQuantite, setAjoutStockQuantite] = useState('')
  const [ajoutStockSaving, setAjoutStockSaving] = useState(false)
  const [alertesRupture, setAlertesRupture] = useState<AlerteRupture[]>([])
  const [showIntelligence, setShowIntelligence] = useState(false)
  const [loadingIntelligence, setLoadingIntelligence] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [allStocksForPrint, setAllStocksForPrint] = useState<StockRow[]>([])
  const [entreprise, setEntreprise] = useState<any>(null)
  const [showTransferAssistant, setShowTransferAssistant] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  const [validatingTransfers, setValidatingTransfers] = useState(false)
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<number>>(new Set())

  const refetchProduits = () => {
    fetch('/api/produits?complet=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((res) => {
        setProduits(Array.isArray(res) ? res : [])
      })
      .catch(() => setProduits([]))
  }

  const fetchIntelligence = async () => {
    setLoadingIntelligence(true)
    try {
      const res = await fetch('/api/rapports/alertes-stock')
      if (res.ok) {
        const data = await res.json()
        setAlertesRupture(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingIntelligence(false)
    }
  }

  const fetchRecommendations = async () => {
    setLoadingRecommendations(true)
    try {
      const res = await fetch('/api/stock/transferts/auto')
      if (res.ok) {
        const data = await res.json()
        setRecommendations(data)
        // Sélectionner tout par défaut
        setSelectedRecommendations(new Set(data.map((_: any, i: number) => i)))
      }
    } catch (e) {
      showError("Erreur lors du chargement des recommandations")
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const handleValidateTransfers = async () => {
    if (selectedRecommendations.size === 0) return
    setValidatingTransfers(true)
    
    try {
      const toValidate = recommendations.filter((_, i) => selectedRecommendations.has(i))
      
      // Groupe par couple (Origine, Destination) pour faire moins d'appels ou un seul transfert groupé
      // Pour GestiCom, on va faire un appel par transfert unique (Origine -> Dest)
      
      const transfersMap = new Map<string, any>()
      toValidate.forEach(r => {
        const key = `${r.magasinOrigineId}-${r.magasinDestId}`
        if (!transfersMap.has(key)) {
          transfersMap.set(key, {
            magasinOrigineId: r.magasinOrigineId,
            magasinDestId: r.magasinDestId,
            observation: 'Transfert automatique via Assistant',
            lignes: []
          })
        }
        transfersMap.get(key).lignes.push({
          produitId: r.produitId,
          designation: r.designation,
          quantite: r.quantite
        })
      })

      let successCount = 0
      for (const [_, payload] of transfersMap) {
        const res = await fetch('/api/stock/transferts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        if (res.ok) successCount++
      }

      showSuccess(`${successCount} transfert(s) généré(s) avec succès.`)
      setShowTransferAssistant(false)
      refetch()
    } catch (e) {
      showError("Erreur lors de la validation des transferts")
    } finally {
      setValidatingTransfers(false)
    }
  }

  useEffect(() => {
    fetchIntelligence()
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/magasins').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/produits?complet=1').then((r) => (r.ok ? r.json() : [])).then((res) => {
        return Array.isArray(res) ? res : []
      }),
      fetch('/api/produits/categories').then((r) => (r.ok ? r.json() : ['DIVERS'])),
      fetch('/api/parametres').then((r) => (r.ok ? r.json() : null)),
    ]).then(([m, p, cat, ent]) => {
      setMagasins(Array.isArray(m) ? m : [])
      setProduits(Array.isArray(p) ? p : [])
      setCategories(Array.isArray(cat) && cat.length ? cat : ['DIVERS'])
      setEntreprise(ent)
    })
      .catch(() => {
        setMagasins([])
        setProduits([])
        setCategories(['DIVERS'])
      })
  }, [])

  useEffect(() => {
    if (showEntree) refetchProduits()
  }, [showEntree])

  // Écouter les événements de création de produit depuis d'autres pages
  useEffect(() => {
    const handleProduitCreated = () => {
      refetchProduits()
    }
    window.addEventListener('produit-created', handleProduitCreated)
    return () => window.removeEventListener('produit-created', handleProduitCreated)
  }, [])

  const fetchList = async (page?: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        complet: '1',
        page: String(page ?? currentPage),
        limit: '20',
      })
      if (magasinId) params.set('magasinId', magasinId)

      const res = await fetch('/api/stock?' + params.toString())
      if (res.ok) {
        const response = await res.json()
        // Mode complet : retourne directement un tableau
        if (Array.isArray(response)) {
          setList(response)
          setPagination(null)
        } else if (response.data && response.pagination) {
          setList(response.data)
          setPagination(response.pagination)
        } else {
          setList([])
          setPagination(null)
        }
      } else {
        setList([])
        setPagination(null)
      }
    } catch {
      setList([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
    fetchList(1)
  }, [magasinId])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  useEffect(() => {
    fetchList()
  }, [currentPage])

  const handlePrintAll = async () => {
    setIsPrinting(true)
    try {
      const params = new URLSearchParams({
        complet: '1',
        limit: '10000',
      })
      if (magasinId) params.set('magasinId', magasinId)

      const res = await fetch('/api/stock?' + params.toString())
      if (res.ok) {
        const response = await res.json()
        const data = Array.isArray(response) ? response : (response.data || [])
        setAllStocksForPrint(data)
        setTimeout(() => {
          window.print()
          setIsPrinting(false)
        }, 500)
      }
    } catch (e) {
      console.error(e)
      setIsPrinting(false)
    }
  }

  const refetch = () => {
    fetchList(currentPage)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchList(page)
  }

  const searchLower = searchTerm.trim().toLowerCase()
  const filteredList = searchLower
    ? list.filter(
      (s) =>
        s.magasin.code.toLowerCase().includes(searchLower) ||
        s.magasin.nom.toLowerCase().includes(searchLower) ||
        s.produit.code.toLowerCase().includes(searchLower) ||
        s.produit.designation.toLowerCase().includes(searchLower)
    )
    : list

  // Pagination côté client pour la liste filtrée
  const itemsPerPage = 20
  const totalPagesFiltered = Math.ceil(filteredList.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedList = filteredList.slice(startIndex, endIndex)

  const alertes = filteredList.filter((s) => s.quantite < s.produit.seuilMin)
  const totalLignes = filteredList.length
  const produitsAvecStock = new Set(filteredList.filter((s) => s.quantite > 0).map((s) => s.produit.id)).size

  const handleEntree = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setSaving(true)

    const requestData = {
      date: entreeForm.date || undefined,
      magasinId: Number(entreeForm.magasinId),
      produitId: Number(entreeForm.produitId),
      quantite: Math.max(0, Number(entreeForm.quantite) || 0), // Libération décimales
      observation: entreeForm.observation.trim() || undefined,
    }

    // Dans GestiCom Offline, on enregistre toujours directement vers le serveur local.
    // La file d'attente (SyncQueue) est gérée dans le catch en cas de défaillance du serveur.

    try {
      const res = await fetch('/api/stock/entree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setShowEntree(false)
        refetch()
        setTimeout(() => refetch(), 500)
      } else {
        if (data.error?.includes("n'existe pas dans ce magasin") || data.error?.includes("Creez d'abord le produit")) {
          setCreateProduitData({
            magasinId: entreeForm.magasinId,
            afterCreate: () => {
              handleEntree(e as any)
            }
          })
          setShowCreateProduit(true)
        } else {
          setErr(data.error || 'Erreur')
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleSortie = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setSaving(true)

    const requestData = {
      date: sortieForm.date || undefined,
      magasinId: Number(sortieForm.magasinId),
      produitId: Number(sortieForm.produitId),
      quantite: Math.max(0, Number(sortieForm.quantite) || 0), // Libération décimales
      observation: sortieForm.observation.trim() || undefined,
    }

    // Dans GestiCom Offline, on enregistre toujours directement vers le serveur local.

    try {
      const res = await fetch('/api/stock/sortie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        setShowSortie(false)
        refetch()
        setTimeout(() => refetch(), 500)
        showSuccess('Sortie de stock enregistrée avec succès.')
      } else {
        if (data.error?.includes("n'existe pas dans ce magasin") || data.error?.includes("Creez d'abord le produit")) {
          setCreateProduitData({
            magasinId: sortieForm.magasinId,
            afterCreate: () => {
              handleSortie(e as any)
            }
          })
          setShowCreateProduit(true)
        } else if (data.error?.includes('Stock insuffisant')) {
          // Extraire les informations du message d'erreur
          const match = data.error.match(/Stock insuffisant\. Disponible : (\d+), demandé : (\d+)\./)
          if (match) {
            const quantiteDisponible = Number(match[1])
            const quantiteDemandee = Number(match[2])
            const produit = produits.find((p) => p.id === Number(sortieForm.produitId))
            if (produit) {
              setStockInsuffisantModal({
                produitId: produit.id,
                produitDesignation: produit.designation,
                quantiteDemandee,
                quantiteDisponible,
                magasinId: Number(sortieForm.magasinId),
                type: 'sortie',
                onSuccess: () => {
                  handleSortie(e as any)
                },
              })
              setAjoutStockQuantite(String(quantiteDemandee - quantiteDisponible))
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
      setSaving(false)
    }
  }

  const fetchNextCode = async (categorie: string) => {
    try {
      const res = await fetch(`/api/produits/next-code?categorie=${encodeURIComponent(categorie)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.code) {
          setProduitForm((f) => ({ ...f, code: data.code }))
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  const handleCreateProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProduit(true)
    setErr('')
    try {
      const res = await fetch('/api/produits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: produitForm.code.trim().toUpperCase(),
          designation: produitForm.designation.trim(),
          categorie: produitForm.categorie.trim() || 'DIVERS',
          magasinId: produitForm.magasinId ? Number(produitForm.magasinId) : null,
          prixAchat: produitForm.prixAchat ? Number(produitForm.prixAchat) : null,
          prixVente: produitForm.prixVente ? Number(produitForm.prixVente) : null,
          seuilMin: Math.max(0, Number(produitForm.seuilMin) || 5),
          quantiteInitiale: Math.max(0, Number(produitForm.quantiteInitiale) || 0),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowCreateProduit(false)
        refetchProduits()
        refetch()
        // Notifier les autres pages pour rafraîchir leurs listes de produits
        window.dispatchEvent(new CustomEvent('produit-created'))
        if (createProduitData?.afterCreate) {
          createProduitData.afterCreate()
        }
        setCreateProduitData(null)
        setProduitForm({
          code: '',
          designation: '',
          categorie: 'DIVERS',
          magasinId: '',
          prixAchat: '',
          prixVente: '',
          seuilMin: '5',
          quantiteInitiale: '0',
        })
        showSuccess('Produit créé avec succès.')
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
      setSavingProduit(false)
    }
  }

  useEffect(() => {
    if (showCreateProduit && createProduitData) {
      setProduitForm({
        code: '',
        designation: '',
        categorie: 'DIVERS',
        magasinId: createProduitData.magasinId,
        prixAchat: '',
        prixVente: '',
        seuilMin: '5',
        quantiteInitiale: '0',
      })
      fetchNextCode('DIVERS')
    }
  }, [showCreateProduit, createProduitData])

  const stockKey = (s: StockRow) => (s.id != null ? String(s.id) : `p${s.produit.id}-m${s.magasin.id}`)

  const handleInventaire = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setInventaireSaving(true)
    try {
      const lignes = filteredList
        .filter((s) => s.id != null)
        .map((s) => {
          const key = stockKey(s)
          const val = inventaireReelles[key]
          const quantiteReelle =
            val !== '' && val !== undefined
              ? Math.max(0, Number(val) || 0) // Libération décimales
              : s.quantite
          return { stockId: s.id!, quantiteReelle }
        })
      const res = await fetch('/api/stock/inventaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          magasinId: magasinId || undefined,
          lignes,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowInventaire(false)
        setInventaireReelles({})
        refetch()
        setTimeout(() => refetch(), 500)
        showSuccess(data.regularise !== undefined ? `${data.regularise} ligne(s) régularisée(s).` : 'Inventaire enregistré avec succès.')
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de l\'enregistrement.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setInventaireSaving(false)
    }
  }

  const openEdit = (s: StockRow) => {
    setEditRow(s)
    setEditForm({ quantite: String(s.quantite), quantiteInitiale: String(s.quantiteInitiale) })
    setShowEdit(true)
    setErr('')
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRow) return
    setErr('')
    setSaving(true)

    // Si le stock n'existe pas encore (id null), on doit le créer via une entrée de stock
    if (editRow.id == null) {
      const quantite = Math.max(0, Number(editForm.quantite) || 0)
      try {
        const res = await fetch('/api/stock/entree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: new Date().toISOString().split('T')[0],
            magasinId: editRow.magasin.id,
            produitId: editRow.produit.id,
            quantite: quantite,
            observation: 'Initialisation stock',
          }),
        })
        if (res.ok) {
          setShowEdit(false)
          setEditRow(null)
          refetch()
          setTimeout(() => refetch(), 500)
          showSuccess('Stock initialisé avec succès.')
        } else {
          const d = await res.json()
          const errorMsg = formatApiError(d.error || 'Erreur lors de l\'initialisation.')
          setErr(errorMsg)
          showError(errorMsg)
        }
      } catch (e) {
        const errorMsg = formatApiError(e)
        setErr(errorMsg)
        showError(errorMsg)
      } finally {
        setSaving(false)
      }
      return
    }

    // Stock existant, on peut le modifier
    try {
      const res = await fetch(`/api/stock/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantite: (() => { const v = Number(editForm.quantite); return Number.isNaN(v) ? editRow.quantite : Math.max(0, v); })(),
          quantiteInitiale: (() => { const v = Number(editForm.quantiteInitiale); return Number.isNaN(v) ? editRow.quantiteInitiale : Math.max(0, v); })(),
        }),
      })
      if (res.ok) {
        setShowEdit(false)
        setEditRow(null)
        refetch()
        setTimeout(() => refetch(), 500)
        showSuccess('Stock modifié avec succès.')
      } else {
        const d = await res.json()
        const errorMsg = formatApiError(d.error || 'Erreur lors de la modification.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteStock = async () => {
    if (!deletingStock || !deletingStock.id) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/stock/${deletingStock.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingStock(null)
        refetch()
        showSuccess('Ligne de stock supprimée avec succès.')
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la suppression.')
      }
    } catch (e) {
      showError('Erreur réseau lors de la suppression.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Stock</h1>
        <p className="mt-1 text-white/90">Stocks par magasin, quantités, entrées et inventaire</p>
        <p className="mt-1 text-sm font-medium text-white/80">
          {searchLower ? 'Affichage : ' : 'Total : '}
          <span className="text-amber-300 font-bold">{totalLignes}</span>
          {searchLower ? ' lignes (filtré)' : ' lignes de stock'}
          {' · Produits avec stock >0 : '}
          <span className="text-emerald-300 font-bold">{produitsAvecStock}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par magasin, code, designation..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Magasin</span>
          <select
            value={magasinId}
            onChange={(e) => setMagasinId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
            <option value="">Tous</option>
            {magasins.map((m) => (
              <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setShowEntree(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Entrée stock
        </button>
        <button
          onClick={() => setShowSortie(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Minus className="h-4 w-4" />
          Sortie stock
        </button>
        <button
          onClick={() => { setShowInventaire(true); setInventaireReelles({}); }}
          className="flex items-center gap-2 rounded-lg border-2 border-purple-500 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-800 hover:bg-purple-100"
        >
          <ClipboardList className="h-4 w-4" />
          Inventaire
        </button>
        <button
          onClick={() => { setShowIntelligence(true); fetchIntelligence(); }}
          className="flex items-center gap-2 rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 shadow-sm"
        >
          <Loader2 className={`h-4 w-4 ${loadingIntelligence ? 'animate-spin' : ''}`} />
          Intelligence Stock {alertesRupture.length > 0 && <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white animate-pulse">{alertesRupture.length}</span>}
        </button>
        <button
          onClick={() => { setShowTransferAssistant(true); fetchRecommendations(); }}
          className="flex items-center gap-2 rounded-lg border-2 border-purple-600 bg-purple-600 px-3 py-2 text-sm font-bold text-white hover:bg-purple-700 shadow-lg active:scale-95"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Assistant de Transfert
        </button>
        <button
          onClick={handlePrintAll}
          disabled={isPrinting}
          className="flex items-center gap-2 rounded-lg border-2 border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 shadow-lg active:scale-95 disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          IMPRIMER L'ÉTAT DU STOCK
        </button>
        {alertes.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5" />
            {alertes.length} alerte(s) stock faible
          </div>
        )}
        {magasinId && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                window.open(`/api/stock/export-excel?magasinId=${magasinId}`, '_blank')
              }}
              className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
              title="Exporter le stock en Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(`/api/stock/export-pdf?magasinId=${magasinId}`, '_blank')
              }}
              className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
              title="Exporter le stock en PDF"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      {showEntree && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Entrée de stock</h2>
          <form onSubmit={handleEntree} className="grid gap-4 sm:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input
                type="date"
                required
                value={entreeForm.date}
                onChange={(e) => setEntreeForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Magasin *</label>
              <select
                required
                value={entreeForm.magasinId}
                onChange={(e) => setEntreeForm((f) => ({ ...f, magasinId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="">-</option>
                {magasins.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Produit *</label>
              <select
                required
                value={entreeForm.produitId}
                onChange={(e) => setEntreeForm((f) => ({ ...f, produitId: e.target.value }))}
                onFocus={refetchProduits}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                title="Liste de tous les produits enregistrés"
              >
                <option value="">-</option>
                {Array.isArray(produits) && produits.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.designation}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantité *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={entreeForm.quantite}
                onChange={(e) => setEntreeForm((f) => ({ ...f, quantite: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Observation</label>
              <input
                value={entreeForm.observation}
                onChange={(e) => setEntreeForm((f) => ({ ...f, observation: e.target.value }))}
                placeholder="Réception, inventaire..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60">
                {saving ? '...' : "Enregistrer l'entree"}
              </button>
              <button type="button" onClick={() => { setShowEntree(false); setErr(''); }} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                Annuler
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      {showSortie && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Sortie de stock (hors vente)</h2>
          <p className="mb-4 text-sm text-gray-600">Casse, don, transfert, correction... Le stock disponible ne doit pas etre depasse.</p>
          <form onSubmit={handleSortie} className="grid gap-4 sm:grid-cols-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date *</label>
              <input
                type="date"
                required
                value={sortieForm.date}
                onChange={(e) => setSortieForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Magasin *</label>
              <select
                required
                value={sortieForm.magasinId}
                onChange={(e) => setSortieForm((f) => ({ ...f, magasinId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="">-</option>
                {magasins.map((m) => (
                  <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Produit *</label>
              <select
                required
                value={sortieForm.produitId}
                onChange={(e) => setSortieForm((f) => ({ ...f, produitId: e.target.value }))}
                onFocus={refetchProduits}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                <option value="">-</option>
                {Array.isArray(produits) && produits.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.designation}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantité *</label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={sortieForm.quantite}
                onChange={(e) => setSortieForm((f) => ({ ...f, quantite: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Motif ou observation</label>
              <input
                value={sortieForm.observation}
                onChange={(e) => setSortieForm((f) => ({ ...f, observation: e.target.value }))}
                placeholder="Casse, don, transfert, correction..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-60">
                {saving ? '...' : 'Enregistrer la sortie'}
              </button>
              <button type="button" onClick={() => { setShowSortie(false); setErr(''); }} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                Annuler
              </button>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      {showInventaire && (
        <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-gray-900">Inventaire et Régularisation</h2>
              <p className="text-sm text-gray-700">Saisissez les quantites reelles comptees. Cliquez sur "Regulariser" pour aligner le stock (mouvements ENTREE/SORTIE crees automatiquement).</p>
            </div>
            <button
              onClick={() => { setShowInventaire(false); setInventaireReelles({}); setErr(''); }}
              className="rounded-lg p-2 text-gray-500 hover:bg-white/50 hover:text-gray-700 transition-colors"
              title="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleInventaire} className="space-y-4">
            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 bg-white shadow-sm max-h-[60vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Désignation</th>
                    <th className="px-4 py-2">Magasin</th>
                    <th className="px-4 py-2 text-right">Stock actuel</th>
                    <th className="px-4 py-2">Quantité réelle</th>
                    <th className="px-4 py-2 text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredList.filter((s) => s.id != null).length === 0 ? (
                    <tr className="bg-white">
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-600">
                        Aucune ligne de stock à inventorier. Créez des produits avec leur magasin pour voir les stocks.
                      </td>
                    </tr>
                  ) : filteredList.filter((s) => s.id != null).map((s) => {
                    const key = stockKey(s)
                    const reel = inventaireReelles[key] !== '' ? Math.max(0, Number(inventaireReelles[key]) || 0) : null
                    const ecart = reel !== null ? reel - s.quantite : null
                    return (
                      <tr key={key} className="bg-white text-gray-900 hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono text-gray-900">{s.produit.code}</td>
                        <td className="px-4 py-2 text-gray-900">{s.produit.designation}</td>
                        <td className="px-4 py-2 text-gray-900">{s.magasin.code}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{s.quantite}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-gray-900"
                            value={inventaireReelles[key] ?? ''}
                            onChange={(e) => setInventaireReelles((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={String(s.quantite)}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          {ecart !== null && ecart !== 0 && (
                            <span className={ecart > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {ecart > 0 ? '+' : ''}{ecart}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center justify-between gap-4 border-t-2 border-orange-300 bg-orange-50 pt-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">
                  {Object.keys(inventaireReelles).filter(k => inventaireReelles[k] !== '').length > 0
                    ? `✓ ${Object.keys(inventaireReelles).filter(k => inventaireReelles[k] !== '').length} ligne(s) modifiée(s)`
                    : 'Aucune modification saisie'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowInventaire(false); setInventaireReelles({}); setErr(''); }}
                  className="rounded-xl border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={inventaireSaving || Object.keys(inventaireReelles).filter(k => inventaireReelles[k] !== '').length === 0}
                  className="rounded-xl bg-gradient-to-r from-orange-600 to-orange-700 px-8 py-3 font-bold text-white hover:from-orange-700 hover:to-orange-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {inventaireSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Régularisation...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Régulariser le stock
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      )}

      {showEdit && editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Modifier le stock</h2>
              <button onClick={() => { setShowEdit(false); setEditRow(null); }} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">{editRow.produit.designation} - {editRow.magasin.code}</p>
            <div className="rounded-lg bg-gray-50 p-4">
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantité</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.quantite}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantite: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantité initiale</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.quantiteInitiale}
                    onChange={(e) => setEditForm((f) => ({ ...f, quantiteInitiale: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60">
                    {saving ? '...' : 'Enregistrer'}
                  </button>
                  <button type="button" onClick={() => { setShowEdit(false); setEditRow(null); }} className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : paginatedList.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            {searchLower ? 'Aucun stock ne correspond à la recherche.' : 'Aucun stock. Créez des produits avec leur magasin pour voir les stocks.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Magasin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Désignation</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">P.A (Init)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">PAMP (Pro)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Qté</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Qté init.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Seuil</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date entrée</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedList.map((s, idx) => {
                  const faible = s.quantite <= s.produit.seuilMin
                  const key = s.id ?? `v-${s.produit.id}-${s.magasin.id}`
                  const numeroLigne = startIndex + idx + 1
                  return (
                    <tr key={key} className={faible ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-500">{numeroLigne}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.magasin.code}</td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-900">{s.produit.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{s.produit.designation}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500 italic">
                        {s.produit.prixAchat != null ? `${Number(s.produit.prixAchat).toLocaleString('fr-FR')} F` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-700">
                        {s.produit.pamp != null && s.produit.pamp > 0 ? `${Math.round(s.produit.pamp).toLocaleString('fr-FR')} F` : (s.produit.prixAchat != null ? `${Number(s.produit.prixAchat).toLocaleString('fr-FR')} F` : '-')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${faible ? 'text-red-600' : 'text-gray-900'}`}>
                          {s.quantite}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{s.quantiteInitiale}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{s.produit.seuilMin}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {s.createdAt ? formatDate(s.createdAt, { includeTime: true }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEdit(s)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-orange-600"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {s.id != null && (
                            <button
                              onClick={() => setDeletingStock(s)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                              title="Supprimer cette ligne de stock"
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
            </table>
          </div>
        )}
        {filteredList.length > itemsPerPage && (
          <div className="mt-4 px-4 pb-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPagesFiltered}
              totalItems={filteredList.length}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
      {showCreateProduit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Créer un nouveau produit</h2>
              <button
                onClick={() => {
                  setShowCreateProduit(false)
                  setCreateProduitData(null)
                  setErr('')
                }}
                className="rounded p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateProduit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code *</label>
                <input
                  required
                  value={produitForm.code}
                  onChange={(e) => setProduitForm((f) => ({ ...f, code: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Désignation *</label>
                <input
                  required
                  value={produitForm.designation}
                  onChange={(e) => setProduitForm((f) => ({ ...f, designation: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catégorie</label>
                <select
                  value={produitForm.categorie}
                  onChange={(e) => {
                    const cat = e.target.value
                    setProduitForm((f) => ({ ...f, categorie: cat }))
                    fetchNextCode(cat)
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Magasin *</label>
                <select
                  required
                  value={produitForm.magasinId}
                  onChange={(e) => setProduitForm((f) => ({ ...f, magasinId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="">- Choisir un magasin -</option>
                  {magasins.map((m) => (
                    <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix d&apos;achat (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={produitForm.prixAchat}
                  onChange={(e) => setProduitForm((f) => ({ ...f, prixAchat: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix de vente (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={produitForm.prixVente}
                  onChange={(e) => setProduitForm((f) => ({ ...f, prixVente: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Seuil min.</label>
                <input
                  type="number"
                  min="0"
                  value={produitForm.seuilMin}
                  onChange={(e) => setProduitForm((f) => ({ ...f, seuilMin: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantité initiale *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={produitForm.quantiteInitiale}
                  onChange={(e) => setProduitForm((f) => ({ ...f, quantiteInitiale: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingProduit}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {savingProduit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer et continuer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateProduit(false)
                    setCreateProduitData(null)
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
                    // Réessayer l'opération
                    if (stockInsuffisantModal.onSuccess) {
                      stockInsuffisantModal.onSuccess()
                    } else {
                      refetch()
                    }
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

      {/* Modal Intelligence Stock : Prédiction Rupture */}
      {showIntelligence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowIntelligence(false)}>
          <div className="w-full max-w-3xl rounded-2xl border border-blue-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <AlertTriangle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 text-blue-800">Intelligence Prédictive : Alertes 10 Jours</h3>
                  <p className="text-sm text-gray-500">Basé sur les tendances de vente des 30 derniers jours</p>
                </div>
              </div>
              <button 
                  onClick={() => setShowIntelligence(false)} 
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingIntelligence ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              </div>
            ) : alertesRupture.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-10 text-center">
                <p className="text-green-800 font-medium">Aucun risque de rupture détecté pour les 10 prochains jours ! 🚀</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventes/Jour</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Autonomie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {alertesRupture.map((a) => (
                      <tr key={a.id} className="hover:bg-blue-50/50">
                        <td className="px-4 py-4">
                          <div className="font-bold text-gray-900">{a.designation}</div>
                          <div className="text-xs text-gray-500">{a.code}</div>
                        </td>
                        <td className="px-4 py-4 text-right font-medium">{a.stockActuel}</td>
                        <td className="px-4 py-4 text-right text-gray-600">{a.vitesseVenteQuotidienne.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${a.joursRestants <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {a.joursRestants} jours
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowIntelligence(false)}
                className="rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 shadow-md transform active:scale-95 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
          {/* Modal Confirmation Suppression Stock */}
      {deletingStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeletingStock(null)}>
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-100 p-2">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Supprimer le stock ?</h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Voulez-vous supprimer la ligne de stock pour **{deletingStock.produit.designation}** dans **{deletingStock.magasin.nom}** ?
              Cette action est définitive.
            </p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={handleDeleteStock}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Confirmer'}
              </button>
              <button
                onClick={() => setDeletingStock(null)}
                className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      )}
      {/* Modal Assistant de Transfert */}
      {showTransferAssistant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !validatingTransfers && setShowTransferAssistant(false)}>
          <div className="w-full max-w-5xl rounded-2xl border border-purple-200 bg-white p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-100 p-2">
                  <ArrowRightLeft className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 text-purple-800">Assistant de Transfert Intelligent</h3>
                  <p className="text-sm text-gray-500">Rééquilibrage automatique des stocks basés sur les seuils d'alerte</p>
                </div>
              </div>
              <button 
                  disabled={validatingTransfers}
                  onClick={() => setShowTransferAssistant(false)} 
                  className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar">
              {loadingRecommendations ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                  <p className="text-purple-800 font-medium animate-pulse">Analyse des stocks et calcul des surplus...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-10 text-center">
                  <p className="text-green-800 font-medium text-lg">Bravo ! Tous vos magasins sont approvisionnés au-dessus des seuils. 🎉</p>
                  <p className="text-green-600 text-sm mt-2">Aucun transfert n'est nécessaire pour le moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-4">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <p className="text-sm text-amber-800">
                        L'assistant a identifié <strong>{recommendations.length}</strong> transferts optimaux. 
                        Les stocks seront prélevés en priorité sur le <strong>Dépôt Principal</strong> pour combler les ruptures.
                      </p>
                   </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left w-10">
                            <input 
                              type="checkbox" 
                              checked={selectedRecommendations.size === recommendations.length && recommendations.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecommendations(new Set(recommendations.map((_, i) => i)))
                                } else {
                                  setSelectedRecommendations(new Set())
                                }
                              }}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source (Origine)</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Flux</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Destination</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Quantité</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {recommendations.map((r, i) => (
                          <tr key={i} className={`hover:bg-purple-50/30 transition-colors ${selectedRecommendations.has(i) ? 'bg-purple-50/20' : ''}`}>
                            <td className="px-4 py-4">
                              <input 
                                type="checkbox" 
                                checked={selectedRecommendations.has(i)}
                                onChange={(e) => {
                                  const next = new Set(selectedRecommendations)
                                  if (e.target.checked) next.add(i)
                                  else next.delete(i)
                                  setSelectedRecommendations(next)
                                }}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div className="font-bold text-gray-900 leading-tight">{r.designation}</div>
                              <div className="text-[10px] font-mono text-gray-500">{r.codeProduit}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-800">{r.magasinOrigineNom}</span>
                                {r.estSourcePrincipale && (
                                  <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 mt-1 uppercase">
                                    Dépôt Principal
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <ArrowRightLeft className="h-4 w-4 text-purple-400 mx-auto" />
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-gray-800">{r.magasinDestNom}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-lg font-black text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
                                {r.quantite}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between border-t pt-6">
              <p className="text-sm text-gray-500">
                {selectedRecommendations.size} transfert(s) sélectionné(s)
              </p>
              <div className="flex gap-3">
                <button
                  disabled={validatingTransfers}
                  onClick={() => setShowTransferAssistant(false)}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2.5 font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  disabled={validatingTransfers || selectedRecommendations.size === 0}
                  onClick={handleValidateTransfers}
                  className="rounded-xl bg-purple-600 px-8 py-2.5 font-bold text-white hover:bg-purple-700 shadow-lg shadow-purple-200 transform active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                >
                  {validatingTransfers ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Valider les transferts ({selectedRecommendations.size})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone d'impression professionnelle standardisée */}
      <ListPrintWrapper
        title="État du Stock"
        subtitle={magasinId ? `Magasin: ${magasins.find(m => String(m.id) === magasinId)?.nom || magasinId}` : "Inventaire Global"}
      >
        <table className="w-full text-[10px] border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 uppercase font-black text-gray-700">
              <th className="border border-gray-300 px-3 py-3 text-left">Magasin</th>
              <th className="border border-gray-300 px-3 py-3 text-left">Code</th>
              <th className="border border-gray-300 px-3 py-3 text-left">Désignation</th>
              <th className="border border-gray-300 px-3 py-3 text-right">Qté</th>
              <th className="border border-gray-300 px-3 py-3 text-right">P. Achat</th>
              <th className="border border-gray-300 px-3 py-3 text-right">Valorisation</th>
            </tr>
          </thead>
          <tbody>
            {(allStocksForPrint.length > 0 ? allStocksForPrint : list).map((s, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="border border-gray-300 px-3 py-2 font-bold">{s.magasin.code}</td>
                <td className="border border-gray-300 px-3 py-2 font-mono">{s.produit.code}</td>
                <td className="border border-gray-300 px-3 py-2 uppercase font-medium">{s.produit.designation}</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-black">{s.quantite.toLocaleString()}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{(s.produit.pamp || s.produit.prixAchat || 0).toLocaleString()} F</td>
                <td className="border border-gray-300 px-3 py-2 text-right font-bold">
                  {(s.quantite * (s.produit.pamp || s.produit.prixAchat || 0)).toLocaleString()} F
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
             <tr className="bg-gray-100 font-black text-[10px] border-t-2 border-black uppercase italic">
                <td colSpan={2} className="border border-gray-300 px-3 py-4 text-right bg-white">RÉCAPITULATIF SÉLECTION</td>
                <td className="border border-gray-300 px-3 py-4 text-center bg-white">
                   Lignes: {totalLignes}<br/>
                   Produits Actifs: {produitsAvecStock}
                </td>
                <td className="border border-gray-300 px-3 py-4 text-right bg-white">
                   QUANTITÉ TOTALE<br/>
                   {(allStocksForPrint.length > 0 ? allStocksForPrint : list).reduce((acc, s) => acc + s.quantite, 0).toLocaleString()}
                </td>
                <td className="border border-gray-300 px-3 py-4 text-right bg-white">
                   —
                </td>
                <td className="border border-gray-300 px-3 py-4 text-right text-emerald-700 bg-white underline decoration-double">
                   VALEUR STOCK (PAMP)<br/>
                   {(allStocksForPrint.length > 0 ? allStocksForPrint : list).reduce((acc, s) => acc + (s.quantite * (s.produit.pamp || s.produit.prixAchat || 0)), 0).toLocaleString()} F
                </td>
             </tr>
          </tfoot>
        </table>
      </ListPrintWrapper>

      <style jsx global>{`
        @media print {
          @page { size: portrait; margin: 10mm; }
          nav, aside, header, .no-print, button, form, .Pagination { display: none !important; }
          body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
          th { background-color: #f3f4f6 !important; border: 1px solid #000 !important; padding: 4px !important; font-size: 8px !important; font-weight: 900 !important; text-transform: uppercase; }
          td { border: 1px solid #ccc !important; padding: 4px !important; font-size: 7px !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
    </div>
  )
}
