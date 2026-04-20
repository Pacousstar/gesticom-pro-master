'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Loader2, ArrowDownCircle, ArrowUpCircle, Filter, X, Edit2, Trash2, Search, FileSpreadsheet, Download, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import Pagination from '@/components/ui/Pagination'

type Banque = {
  id: number
  numero: string
  nomBanque: string
  libelle: string
  soldeInitial: number
  soldeActuel: number
  compteId: number | null
  compte: { numero: string; libelle: string } | null
  actif: boolean
}

type OperationBancaire = {
  id: number
  date: string
  type: string
  libelle: string
  montant: number
  soldeAvant: number
  soldeApres: number
  reference: string | null
  beneficiaire: string | null
  banque: { id: number; numero: string; nomBanque: string; libelle: string }
  utilisateur: { nom: string; login: string }
}

type PlanCompte = {
  id: number
  numero: string
  libelle: string
  type: string
}

const TYPES_OPERATION = [
  { value: 'DEPOT', label: 'Dépôt' },
  { value: 'RETRAIT', label: 'Retrait' },
  { value: 'VIREMENT_ENTRANT', label: 'Virement entrant' },
  { value: 'VIREMENT_SORTANT', label: 'Virement sortant' },
  { value: 'FRAIS', label: 'Frais bancaires' },
  { value: 'INTERETS', label: 'Intérêts' },
]

export default function BanquePage() {
  const [banques, setBanques] = useState<Banque[]>([])
  const [operations, setOperations] = useState<OperationBancaire[]>([])
  const [comptes, setComptes] = useState<PlanCompte[]>([])
  const [loading, setLoading] = useState(true)
  const [formBanqueOpen, setFormBanqueOpen] = useState(false)
  const [formOperationOpen, setFormOperationOpen] = useState(false)
  const [editingBanque, setEditingBanque] = useState<Banque | null>(null)
  const [selectedBanque, setSelectedBanque] = useState<number | ''>('')
  const [formBanqueData, setFormBanqueData] = useState({
    numero: '',
    nomBanque: '',
    libelle: '',
    soldeInitial: '',
    compteId: '',
  })
  const [formOperationData, setFormOperationData] = useState({
    date: new Date().toISOString().split('T')[0],
    banqueId: '',
    type: 'DEPOT',
    libelle: '',
    montant: '',
    reference: '',
    beneficiaire: '',
    observation: '',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreBanque, setFiltreBanque] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [deletingOpId, setDeletingOpId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100
  const [statsConsolidation, setStatsConsolidation] = useState<any>(null)
  const [statsConsolidationLoading, setStatsConsolidationLoading] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [allOperationsForPrint, setAllOperationsForPrint] = useState<OperationBancaire[]>([])

  useEffect(() => {
    setCurrentPage(1)
  }, [dateDebut, dateFin, filtreType, searchTerm, selectedBanque])

  const [fluxDigitaux, setFluxDigitaux] = useState<any[]>([])
  const [loadingFlux, setLoadingFlux] = useState(false)

  useEffect(() => {
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchBanques()
    fetchComptes()
  }, [])

  useEffect(() => {
    fetchOperations()
  }, [selectedBanque, dateDebut, dateFin, filtreType])

  const fetchBanques = () => {
    fetch('/api/banques')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setBanques(res.data || (Array.isArray(res) ? res : [])))
  }

  const fetchComptes = () => {
    // Liste prédéfinie des comptes bancaires SYSCOHADA (avec id temporaire pour l'affichage)
    const comptesPredefinis: Array<PlanCompte & { isPredefini?: boolean }> = [
      { id: -1, numero: '512', libelle: 'Banque', type: 'ACTIF', isPredefini: true },
      { id: -2, numero: '513', libelle: 'Banques - Comptes courants', type: 'ACTIF', isPredefini: true },
      { id: -3, numero: '514', libelle: 'Banques - Comptes à terme', type: 'ACTIF', isPredefini: true },
    ]
    
    fetch('/api/plan-comptes?actif=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        // Filtrer les comptes bancaires (classe 5, numéros 512, 513, etc.)
        const comptesBancaires = data.filter((c: PlanCompte) => 
          c.numero.startsWith('512') || c.numero.startsWith('513') || c.numero.startsWith('514')
        )
        // Combiner avec les comptes prédéfinis (en priorité ceux de la BD)
        const tousComptes = [...comptesBancaires]
        for (const predef of comptesPredefinis) {
          if (!tousComptes.find(c => c.numero === predef.numero)) {
            tousComptes.push(predef)
          }
        }
        setComptes(tousComptes.sort((a, b) => a.numero.localeCompare(b.numero)))
      })
      .catch(() => {
        // En cas d'erreur, utiliser uniquement les comptes prédéfinis
        setComptes(comptesPredefinis)
      })
  }

  const fetchOperations = () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (selectedBanque) params.set('banqueId', String(selectedBanque))
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin) params.set('dateFin', dateFin)
    if (filtreType) params.set('type', filtreType)
    fetch('/api/banques/operations?' + params.toString())
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setOperations(res.data || (Array.isArray(res) ? res : [])))
      .finally(() => setLoading(false))

    // Récupérer aussi les soldes globaux par mode (MoMo, Virement, Cheque)
    setStatsConsolidationLoading(true)
    const consParams = new URLSearchParams()
    if (dateDebut) consParams.set('dateDebut', dateDebut)
    if (dateFin) consParams.set('dateFin', dateFin)
    fetch('/api/caisse/consolidation?' + consParams.toString())
      .then((r) => r.ok ? r.json() : null)
      .then(setStatsConsolidation)
      .finally(() => setStatsConsolidationLoading(false))

    // Récupérer l'historique détaillé des flux virtuels
    setLoadingFlux(true)
    fetch('/api/banques/flux-digitaux?' + consParams.toString())
      .then((r) => r.ok ? r.json() : [])
      .then(setFluxDigitaux)
      .finally(() => setLoadingFlux(false))
  }

  const resetFormBanque = () => {
    setFormBanqueData({
      numero: '',
      nomBanque: '',
      libelle: '',
      soldeInitial: '',
      compteId: '',
    })
    setEditingBanque(null)
    setFormBanqueOpen(false)
    setErr('')
  }

  const resetFormOperation = () => {
    setFormOperationData({
      date: new Date().toISOString().split('T')[0],
      banqueId: String(selectedBanque) || '',
      type: 'DEPOT',
      libelle: '',
      montant: '',
      reference: '',
      beneficiaire: '',
      observation: '',
    })
    setFormOperationOpen(false)
    setErr('')
  }

  const handleSubmitBanque = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!formBanqueData.numero.trim()) {
      setErr('Numéro de compte requis.')
      return
    }
    if (!formBanqueData.nomBanque.trim()) {
      setErr('Nom de la banque requis.')
      return
    }
    if (!formBanqueData.libelle.trim()) {
      setErr('Libellé requis.')
      return
    }

    // Pour les comptes prédéfinis (identifiés par leur numéro), chercher l'id réel dans la BD
    let compteIdFinal: number | null = null
    if (formBanqueData.compteId) {
      const compteIdNum = Number(formBanqueData.compteId)
      if (Number.isInteger(compteIdNum) && compteIdNum > 0) {
        compteIdFinal = compteIdNum
      } else {
        // C'est un numéro de compte prédéfini, chercher dans la BD
        const compte = comptes.find(c => c.numero === formBanqueData.compteId && c.id > 0)
        if (compte) {
          compteIdFinal = compte.id
        }
        // Si pas trouvé, on laisse null (le compte sera créé automatiquement si nécessaire)
      }
    }

    const requestData = {
      numero: formBanqueData.numero.trim(),
      nomBanque: formBanqueData.nomBanque.trim(),
      libelle: formBanqueData.libelle.trim(),
      soldeInitial: Number(formBanqueData.soldeInitial) || 0,
      compteId: compteIdFinal,
    }

    // Dans GestiCom Offline, l'enregistrement se fait toujours directement vers le serveur local.

    setSaving(true)
    try {
      const url = editingBanque ? `/api/banques/${editingBanque.id}` : '/api/banques'
      const method = editingBanque ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        resetFormBanque()
        fetchBanques()
        showSuccess(editingBanque ? MESSAGES.BANQUE_MODIFIEE : MESSAGES.BANQUE_ENREGISTREE)
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
      setSaving(false)
    }
  }

  const handleSubmitOperation = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!formOperationData.banqueId) {
      setErr('Sélectionnez un compte bancaire.')
      return
    }
    if (!formOperationData.libelle.trim()) {
      setErr('Libellé requis.')
      return
    }
    const montant = Number(formOperationData.montant) || 0
    if (montant <= 0) {
      setErr('Montant doit être supérieur à 0.')
      return
    }

    const requestData = {
      date: formOperationData.date,
      banqueId: Number(formOperationData.banqueId),
      type: formOperationData.type,
      libelle: formOperationData.libelle.trim(),
      montant,
      reference: formOperationData.reference.trim() || null,
      beneficiaire: formOperationData.beneficiaire.trim() || null,
      observation: formOperationData.observation.trim() || null,
    }

    // Dans GestiCom Offline, l'enregistrement se fait toujours directement vers le serveur local.

    setSaving(true)
    try {
      const res = await fetch('/api/banques/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        resetFormOperation()
        fetchOperations()
        fetchBanques() // Mettre à jour les soldes
        showSuccess(MESSAGES.OPERATION_BANQUE_ENREGISTREE)
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
      setSaving(false)
    }
  }

  const handleEditBanque = (banque: Banque) => {
    setEditingBanque(banque)
    setFormBanqueData({
      numero: banque.numero,
      nomBanque: banque.nomBanque,
      libelle: banque.libelle,
      soldeInitial: String(banque.soldeInitial),
      compteId: banque.compteId ? String(banque.compteId) : '',
    })
    setFormBanqueOpen(true)
  }

  const handleDeleteBanque = async (id: number) => {
    if (!confirm('Supprimer ce compte bancaire ?')) return
    try {
      const res = await fetch(`/api/banques/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchBanques()
        if (selectedBanque === id) setSelectedBanque('')
        showSuccess(MESSAGES.BANQUE_SUPPRIMEE)
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const banqueSelectionnee = banques.find((b) => b.id === Number(selectedBanque))

  // Calculer les statistiques des opérations
  const totalDepots = operations
    .filter((o) => o.type === 'DEPOT' || o.type === 'VIREMENT_ENTRANT' || o.type === 'INTERETS')
    .reduce((s, o) => s + o.montant, 0)
  const totalRetraits = operations
    .filter((o) => o.type === 'RETRAIT' || o.type === 'VIREMENT_SORTANT' || o.type === 'FRAIS')
    .reduce((s, o) => s + o.montant, 0)
  const soldeOperations = totalDepots - totalRetraits
  const soldeTotalBanques = banques.reduce((s, b) => s + b.soldeActuel, 0)

  // Extraire les soldes virtuels de la consolidation
  const getSoldeMode = (mode: string) => {
    if (!statsConsolidation) return 0
    const ouv = statsConsolidation.ouvertures[mode] || 0
    const mvt = statsConsolidation.stats[mode] || 0
    return ouv + mvt
  }

  return (
    <div className="space-y-6">
      {/* Bandeau des flux digitaux (MoMo, Virement, Cheque) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Mobile Money', key: 'MOBILE_MONEY', color: 'from-orange-500 to-yellow-600', icon: '📱' },
          { label: 'Virements Bancaires', key: 'VIREMENT', color: 'from-blue-600 to-indigo-700', icon: '🏦' },
          { label: 'Chèques à Encaisser', key: 'CHEQUE', color: 'from-purple-600 to-pink-700', icon: '📜' },
        ].map((s) => (
          <div key={s.key} className={`rounded-xl bg-gradient-to-br ${s.color} p-4 shadow-md transition-all hover:scale-105`}>
            <div className="flex justify-between items-center text-white/90">
              <span className="text-[10px] font-bold uppercase tracking-widest">{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">
              {statsConsolidationLoading ? '...' : `${getSoldeMode(s.key).toLocaleString('fr-FR')} F`}
            </p>
            <p className="text-[10px] text-white/70 italic mt-1">Solde cumulé (Ventes - Achats - Dépenses)</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-8 w-8 text-white" />
            Banque
          </h1>
          <p className="mt-1 text-white/90">Gestion des comptes bancaires et opérations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
          <button
            type="button"
            onClick={() => {
              resetFormBanque()
              setFormBanqueOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau compte
          </button>
        </div>
      </div>

      {/* Filtres (toujours visibles, comme Caisse) */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Compte</label>
              <select
                value={selectedBanque || ''}
                onChange={(e) => setSelectedBanque(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous les comptes</option>
                {banques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nomBanque} – {b.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                value={filtreType}
                onChange={(e) => setFiltreType(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {TYPES_OPERATION.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Barre de recherche et exports (toujours visible, comme Caisse) */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par libellé, référence, bénéficiaire..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (selectedBanque) params.set('banqueId', String(selectedBanque))
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreType) params.set('type', filtreType)
              window.open(`/api/banques/operations/export-excel?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            title="Exporter les opérations en Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (selectedBanque) params.set('banqueId', String(selectedBanque))
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreType) params.set('type', filtreType)
              window.open(`/api/banques/operations/export-pdf?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            title="Exporter les opérations en PDF"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          

          <button
            type="button"
            onClick={async () => {
               setIsPrinting(true)
               try {
                  const params = new URLSearchParams()
                  if (selectedBanque) params.set('banqueId', String(selectedBanque))
                  if (dateDebut) params.set('dateDebut', dateDebut)
                  if (dateFin) params.set('dateFin', dateFin)
                  if (filtreType) params.set('type', filtreType)
                  params.set('limit', '10000') // Récupérer tout pour l'impression

                  const res = await fetch(`/api/banques/operations?${params.toString()}`)
                  if (res.ok) {
                    const data = await res.json()
                    setAllOperationsForPrint(data.operations || [])
                    setIsPreviewOpen(true)
                  }
               } catch (e) {
                  console.error(e)
                  showError("Erreur lors de la préparation de l'aperçu.")
               } finally {
                  setIsPrinting(false)
               }
            }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100 h-[42px] disabled:opacity-50 transition-all"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Aperçu Impression
          </button>
        </div>
      </div>

      {/* Encarts statistiques globaux */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/90">Total comptes</p>
          <p className="mt-1 text-2xl font-bold text-white">{banques.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/90">
            Total dépôts {selectedBanque ? '(ce compte)' : '(tous comptes)'}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {totalDepots.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="mt-1 text-xs text-white/80">Dépôts + virements entrants + intérêts</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/90">
            Total retraits {selectedBanque ? '(ce compte)' : '(tous comptes)'}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {totalRetraits.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="mt-1 text-xs text-white/80">Retraits + virements sortants + frais</p>
        </div>
        <div className={`rounded-xl bg-gradient-to-br p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105 ${
          soldeTotalBanques >= 0 
            ? 'from-indigo-500 to-purple-600' 
            : 'from-orange-500 to-red-600'
        }`}>
          <p className="text-sm font-medium text-white/90">
            {selectedBanque ? 'Solde du compte' : 'Solde total'}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {selectedBanque 
              ? banqueSelectionnee?.soldeActuel.toLocaleString('fr-FR') || '0'
              : soldeTotalBanques.toLocaleString('fr-FR')
            } FCFA
          </p>
        </div>
      </div>
      <p className="text-sm text-white/80 -mt-2">
        Les totaux dépôts / retraits sont calculés automatiquement à partir des opérations (Dépôt, Retrait, Virement, etc.). Sélectionnez un compte puis utilisez les boutons Dépôt / Retrait / Autre opération pour enregistrer des mouvements.
      </p>

      {/* Liste des comptes bancaires */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Comptes bancaires</h2>
        {banques.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun compte bancaire. Créez-en un pour commencer.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {banques.map((banque) => (
              <div
                key={banque.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedBanque === banque.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => setSelectedBanque(banque.id === Number(selectedBanque) ? '' : banque.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{banque.nomBanque}</h3>
                    <p className="text-sm text-gray-600">{banque.libelle}</p>
                    <p className="text-xs text-gray-500 mt-1">N° {banque.numero}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditBanque(banque)
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {userRole === 'SUPER_ADMIN' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteBanque(banque.id)
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer (Super Admin)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">Solde actuel</p>
                  <p className={`text-lg font-bold ${banque.soldeActuel >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {banque.soldeActuel.toLocaleString('fr-FR')} FCFA
                  </p>
                  {banque.compte && (
                    <p className="text-xs text-gray-500 mt-1">
                      Compte: {banque.compte.numero} - {banque.compte.libelle}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Journal des Flux Digitaux Détaillés (Ventes, Achats, Dépenses) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Derniers Flux Virtuels (MoMo, Virement, Chèque)</h2>
            <p className="text-sm text-gray-600">Historique des encaissements et décaissements hors-espèces</p>
          </div>
          <div className="flex gap-2">
             <button
                onClick={() => fetchOperations()}
                className="text-xs text-blue-600 hover:underline"
             >
               Rafraîchir
             </button>
          </div>
        </div>

        {loadingFlux ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : fluxDigitaux.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun flux virtuel sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Mode</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Libellé / Référence</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fluxDigitaux.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">
                      {new Date(f.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        f.type === 'ENTREE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {f.type === 'ENTREE' ? 'ENTRÉE' : 'SORTIE'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-[10px] font-bold text-gray-700">
                      {f.mode.replace('_', ' ')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-[10px] text-gray-500 uppercase tracking-tighter">
                      {f.source}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      <div className="font-semibold">{f.libelle}</div>
                      <div className="text-[10px] text-gray-400">Réf: {f.reference}</div>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2 text-right text-sm font-black ${
                      f.type === 'ENTREE' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {f.type === 'ENTREE' ? '+' : '−'} {f.montant.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Journal des opérations (toujours visible) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedBanque && banqueSelectionnee
                ? `Opérations – ${banqueSelectionnee.nomBanque} (${banqueSelectionnee.libelle})`
                : 'Journal des opérations'}
            </h2>
            <p className="text-sm text-gray-600">
              {selectedBanque && banqueSelectionnee
                ? `Solde du compte : ${banqueSelectionnee.soldeActuel.toLocaleString('fr-FR')} FCFA`
                : 'Tous les comptes. Sélectionnez un compte dans la liste ci-dessus ou dans le filtre pour filtrer.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOperationData((f) => ({ ...f, banqueId: selectedBanque ? String(selectedBanque) : '', type: 'DEPOT' }))
                setFormOperationOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <ArrowDownCircle className="h-4 w-4" />
              Dépôt
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOperationData((f) => ({ ...f, banqueId: selectedBanque ? String(selectedBanque) : '', type: 'RETRAIT' }))
                setFormOperationOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Retrait
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOperationData((f) => ({ ...f, banqueId: selectedBanque ? String(selectedBanque) : '' }))
                setFormOperationOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              Autre opération
            </button>
          </div>
        </div>

          {/* Encarts statistiques pour le compte sélectionné */}
          {selectedBanque && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
                <p className="text-sm font-medium text-white/90">Total dépôts</p>
                <p className="mt-1 text-2xl font-bold text-white">{totalDepots.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-red-500 to-rose-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
                <p className="text-sm font-medium text-white/90">Total retraits</p>
                <p className="mt-1 text-2xl font-bold text-white">{totalRetraits.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className={`rounded-xl bg-gradient-to-br p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105 ${
                soldeOperations >= 0 
                  ? 'from-blue-500 to-cyan-600' 
                  : 'from-orange-500 to-red-600'
              }`}>
                <p className="text-sm font-medium text-white/90">Solde (dépôts − retraits)</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {soldeOperations.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : operations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Aucune opération sur la période. Utilisez les boutons Dépôt, Retrait ou Autre opération pour enregistrer des mouvements.</div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      {!selectedBanque && (
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Compte</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Libellé</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Référence</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bénéficiaire</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Montant</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Solde après</th>
                      {userRole === 'SUPER_ADMIN' && <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 w-20">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(() => {
                      const filtered = operations.filter((op) => {
                        if (!searchTerm) return true
                        const search = searchTerm.toLowerCase()
                        return (
                          op.libelle.toLowerCase().includes(search) ||
                          (op.reference && op.reference.toLowerCase().includes(search)) ||
                          (op.beneficiaire && op.beneficiaire.toLowerCase().includes(search))
                        )
                      })
                      const totalPages = Math.ceil(filtered.length / itemsPerPage)
                      const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

                      return (
                        <>
                          {paginated.map((op) => {
                            const isEntree = op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS'
                            return (
                          <tr key={op.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {new Date(op.date).toLocaleDateString('fr-FR')}
                            </td>
                            {!selectedBanque && (
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                                {op.banque?.nomBanque} – {op.banque?.libelle}
                              </td>
                            )}
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                  isEntree ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {TYPES_OPERATION.find((t) => t.value === op.type)?.label || op.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{op.libelle}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{op.reference || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{op.beneficiaire || '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-medium ${isEntree ? 'text-green-600' : 'text-red-600'}`}>
                              {isEntree ? '+' : '−'} {op.montant.toLocaleString('fr-FR')} FCFA
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                              {op.soldeApres.toLocaleString('fr-FR')} FCFA
                            </td>
                            {userRole === 'SUPER_ADMIN' && (
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm('Supprimer cette opération bancaire ? Comptabilité et solde seront mis à jour. Irréversible.')) return
                                    setDeletingOpId(op.id)
                                    try {
                                      const res = await fetch(`/api/banques/operations/${op.id}`, { method: 'DELETE' })
                                      if (res.ok) {
                                        fetchOperations()
                                        fetchBanques()
                                        showSuccess(MESSAGES.OPERATION_BANQUE_SUPPRIMEE)
                                      } else {
                                        const d = await res.json()
                                        showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : (d.error || 'Erreur suppression.'))
                                      }
                                    } catch (e) {
                                      showError(formatApiError(e))
                                    } finally {
                                      setDeletingOpId(null)
                                    }
                                  }}
                                  disabled={deletingOpId === op.id}
                                  className="rounded p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  title="Supprimer (Super Admin)"
                                >
                                  {deletingOpId === op.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                              </td>
                            )}
                          </tr>
                            )
                          })}
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan={userRole === 'SUPER_ADMIN' ? (selectedBanque ? 8 : 9) : (selectedBanque ? 7 : 8)} className="px-0 py-0 border-t border-gray-200">
                                <div className="bg-white px-4 py-3">
                                  <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      {/* Formulaire compte bancaire */}
      {formBanqueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetFormBanque}>
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBanque ? 'Modifier le compte' : 'Nouveau compte bancaire'}
              </h2>
              <button onClick={resetFormBanque} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
            <form onSubmit={handleSubmitBanque} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Numéro de compte *</label>
                <input
                  type="text"
                  required
                  value={formBanqueData.numero}
                  onChange={(e) => setFormBanqueData((f) => ({ ...f, numero: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: 1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom de la banque *</label>
                <input
                  type="text"
                  required
                  value={formBanqueData.nomBanque}
                  onChange={(e) => setFormBanqueData((f) => ({ ...f, nomBanque: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: UBA, SGBC, Ecobank"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Libellé *</label>
                <input
                  type="text"
                  required
                  value={formBanqueData.libelle}
                  onChange={(e) => setFormBanqueData((f) => ({ ...f, libelle: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: Compte Principal, Compte Chèque"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Solde initial (FCFA)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formBanqueData.soldeInitial}
                  onChange={(e) => setFormBanqueData((f) => ({ ...f, soldeInitial: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Compte SYSCOHADA</label>
                <select
                  value={formBanqueData.compteId}
                  onChange={(e) => setFormBanqueData((f) => ({ ...f, compteId: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sélectionner un compte</option>
                  {comptes.map((c) => {
                    // Pour les comptes prédéfinis (id négatif), utiliser le numéro comme identifiant
                    const value = c.id > 0 ? String(c.id) : c.numero
                    return (
                      <option key={c.id || c.numero} value={value}>
                        {c.numero} - {c.libelle}
                      </option>
                    )
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500">Lier à un compte du plan comptable (ex: 512, 513)</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : editingBanque ? 'Modifier' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={resetFormBanque}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulaire opération bancaire */}
      {formOperationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetFormOperation}>
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle opération bancaire</h2>
              <button onClick={resetFormOperation} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
            <form onSubmit={handleSubmitOperation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Compte bancaire *</label>
                <select
                  required
                  value={formOperationData.banqueId}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, banqueId: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sélectionnez un compte</option>
                  {banques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nomBanque} - {b.libelle} ({b.numero})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={formOperationData.date}
                    onChange={(e) => setFormOperationData((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type *</label>
                  <select
                    required
                    value={formOperationData.type}
                    onChange={(e) => setFormOperationData((f) => ({ ...f, type: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {TYPES_OPERATION.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Libellé *</label>
                <input
                  type="text"
                  required
                  value={formOperationData.libelle}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, libelle: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Description de l'opération"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (FCFA) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formOperationData.montant}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, montant: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Référence</label>
                <input
                  type="text"
                  value={formOperationData.reference}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, reference: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="N° chèque, virement, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bénéficiaire / Émetteur</label>
                <input
                  type="text"
                  value={formOperationData.beneficiaire}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, beneficiaire: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Nom du bénéficiaire ou émetteur"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Observation</label>
                <textarea
                  value={formOperationData.observation}
                  onChange={(e) => setFormOperationData((f) => ({ ...f, observation: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Notes supplémentaires"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={resetFormOperation}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modale d'Aperçu Impression Bancaire */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/90 backdrop-blur-sm no-print">
          <div className="flex items-center justify-between bg-white px-6 py-4 shadow-lg">
            <div className="flex items-center gap-4">
               <h2 className="text-xl font-black text-gray-900 uppercase italic">Aperçu du Relevé Bancaire</h2>
               <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-600 uppercase tracking-widest">
                 {selectedBanque ? (banques.find(b => b.id === selectedBanque)?.nomBanque + ' - ' + banques.find(b => b.id === selectedBanque)?.numero) : 'Tous les comptes'}
               </span>
               <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600 uppercase tracking-widest">
                 {allOperationsForPrint.length} OPÉRATIONS
               </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border border-gray-300 px-6 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  window.print()
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-8 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" />
                LANCER L'IMPRESSION
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-gray-100/50">
            <div className="mx-auto max-w-[210mm] bg-white p-2 shadow-2xl">
               {(() => {
                 const ITEMS_PER_PRINT = 18;
                 const chunks = [];
                 for (let i = 0; i < allOperationsForPrint.length; i += ITEMS_PER_PRINT) {
                   chunks.push(allOperationsForPrint.slice(i, i + ITEMS_PER_PRINT));
                 }
                 
                 const totalSolde = allOperationsForPrint.reduce((acc, op) => acc + (op.montant || 0), 0);

                 return chunks.map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break mb-8 border-b-2 border-dashed border-gray-200 pb-8' : ''}>
                      <ListPrintWrapper
                        title={selectedBanque ? `Relevé de Compte : ${banques.find(b => b.id === selectedBanque)?.nomBanque} - ${banques.find(b => b.id === selectedBanque)?.numero}` : "Relevé des Opérations Bancaires Globales"}
                        subtitle={dateDebut && dateFin ? `Période du ${new Date(dateDebut).toLocaleDateString()} au ${new Date(dateFin).toLocaleDateString()}` : "Toutes les opérations"}
                        pageNumber={index + 1}
                        totalPages={allChunks.length}
                      >
                         <table className="w-full text-[14px] border-collapse border-2 border-black">
                          <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                              <th className="border-r-2 border-black px-3 py-3 text-left">Date</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Type</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Libellé / Bénéficiaire</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Référence</th>
                              <th className="px-3 py-3 text-right">Montant (F)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((op, idx) => (
                              <tr key={idx} className="border-b border-black">
                                <td className="border-r-2 border-black px-3 py-2 whitespace-nowrap">{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                                <td className="border-r-2 border-black px-3 py-2 font-bold text-[11px] uppercase">{op.type.replace(/_/g, ' ')}</td>
                                <td className="border-r-2 border-black px-3 py-2">
                                   <div className="font-bold">{op.libelle}</div>
                                   {op.beneficiaire && <div className="text-[10px] italic text-gray-500">Bénéf: {op.beneficiaire}</div>}
                                </td>
                                <td className="border-r-2 border-black px-3 py-2 font-mono text-[11px] uppercase">{op.reference || '-'}</td>
                                <td className="px-3 py-2 text-right font-black">
                                  {op.montant.toLocaleString('fr-FR')} F
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {index === allChunks.length - 1 && (
                            <tfoot>
                              <tr className="bg-gray-100 font-black text-[15px] border-t-2 border-black uppercase italic shadow-inner">
                                <td colSpan={4} className="border-r-2 border-black px-3 py-5 text-right uppercase tracking-widest bg-white">Cumul des mouvements sur la période</td>
                                <td className="px-3 py-5 text-right bg-slate-50 underline decoration-double">
                                  {totalSolde.toLocaleString('fr-FR')} F
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </ListPrintWrapper>
                    </div>
                  ));
               })()}
            </div>
          </div>
        </div>
      )}

      {/* Rendu masqué pour l'impression système direct */}
      <div className="hidden print:block absolute inset-0 bg-white">
          {(() => {
                 const ITEMS_PER_PRINT = 18;
                 const chunks = [];
                 for (let i = 0; i < allOperationsForPrint.length; i += ITEMS_PER_PRINT) {
                   chunks.push(allOperationsForPrint.slice(i, i + ITEMS_PER_PRINT));
                 }
                 const totalSolde = allOperationsForPrint.reduce((acc, op) => acc + (op.montant || 0), 0);

                 return chunks.map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                      <ListPrintWrapper
                        title={selectedBanque ? `Relevé de Compte : ${banques.find(b => b.id === selectedBanque)?.nomBanque} - ${banques.find(b => b.id === selectedBanque)?.numero}` : "Relevé des Opérations Bancaires Globales"}
                        subtitle={dateDebut && dateFin ? `Période du ${new Date(dateDebut).toLocaleDateString()} au ${new Date(dateFin).toLocaleDateString()}` : "Toutes les opérations"}
                        pageNumber={index + 1}
                        totalPages={allChunks.length}
                        hideHeader={index > 0}
                        hideVisa={index < allChunks.length - 1}
                      >
                         <table className="w-full text-[14px] border-collapse border-2 border-black">
                          <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-700 border-b-2 border-black">
                              <th className="border-r-2 border-black px-3 py-3 text-left">Date</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Type</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Libellé</th>
                              <th className="border-r-2 border-black px-3 py-3 text-left">Référence</th>
                              <th className="px-3 py-3 text-right">Montant (F)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((op, idx) => (
                              <tr key={idx} className="border-b border-black">
                                <td className="border-r-2 border-black px-3 py-2">{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                                <td className="border-r-2 border-black px-3 py-2 font-bold text-[11px] uppercase">{op.type}</td>
                                <td className="border-r-2 border-black px-3 py-2">{op.libelle}</td>
                                <td className="border-r-2 border-black px-3 py-2">{op.reference || '-'}</td>
                                <td className="px-3 py-2 text-right font-black">
                                  {op.montant.toLocaleString('fr-FR')} F
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {index === allChunks.length - 1 && (
                            <tfoot>
                              <tr className="bg-gray-100 font-black text-[15px] border-t-2 border-black uppercase italic">
                                <td colSpan={4} className="border-r-2 border-black px-3 py-5 text-right uppercase bg-white">Total</td>
                                <td className="px-3 py-5 text-right bg-white">
                                  {totalSolde.toLocaleString('fr-FR')} F
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </ListPrintWrapper>
                    </div>
                 ));
          })()}
      </div>

    </div>
  )
}
