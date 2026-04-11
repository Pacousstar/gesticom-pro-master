'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Plus, Loader2, Trash2, Edit2, Search, Filter, X, FileSpreadsheet, Download, Printer, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/useToast'
import { depenseSchema } from '@/lib/validations'
import { validateForm, formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import { addToSyncQueue, isOnline } from '@/lib/offline-sync'
import Pagination from '@/components/ui/Pagination'

type Magasin = { id: number; code: string; nom: string }
type Depense = {
  id: number
  date: string
  categorie: string
  libelle: string
  montant: number
  montantPaye?: number
  statutPaiement?: string
  modePaiement: string
  beneficiaire: string | null
  pieceJustificative: string | null
  observation: string | null
  magasin: { id: number; code: string; nom: string } | null
  entite: { code: string; nom: string }
  utilisateur: { nom: string; login: string }
}

const CATEGORIES = [
  'LOYER',
  'SALAIRES',
  'TRANSPORT',
  'COMMUNICATION',
  'MAINTENANCE',
  'FOURNITURES',
  'PUBLICITE',
  'ASSURANCE',
  'IMPOTS',
  'FRAIS_BANCAIRES',
  'AMORTISSEMENT',
  'PROVISION',
  'INTERETS',
  'FRAIS_JURIDIQUES',
  'FRAIS_COMPTABLES',
  'FORMATION',
  'CARBURANT',
  'TELEPHONE',
  'INTERNET',
  'NETTOYAGE',
  'SECURITE',
  'GARDENNAGE',
  'REPARATION',
  'MATERIEL_INFORMATIQUE',
  'LICENCES_LOGICIELS',
  'MARKETING',
  'EVENEMENTS',
  'DONS',
  'IMMOBILISATIONS_CORPORELLES',
  'IMMOBILISATIONS_INCORPORELLES',
  'MOBILIERS_BUREAU',
  'MATERIELS_BUREAU',
  'EQUIPEMENTS_INFORMATIQUES',
  'VEHICULES',
  'TERRAINS',
  'BATIMENTS',
  'INSTALLATIONS_TECHNIQUES',
  'AGENCEMENTS_AMENAGEMENTS',
  'BREVETS_LICENCES',
  'FONDS_COMMERCIAL',
  'MARQUES_DEPOTS',
  'AUTRE',
]

const MODES_PAIEMENT = ['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE']

export default function DepensesPage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Depense | null>(null)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    categorie: 'AUTRE',
    categorieLibre: '',
    libelle: '',
    montant: '',
    montantPaye: '',
    modePaiement: 'ESPECES',
    beneficiaire: '',
    pieceJustificative: '',
    observation: '',
  })

  // Filtres
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [dateDebut, dateFin, filtreCategorie, filtreMagasin, searchTerm])

  useEffect(() => {
    fetch('/api/magasins')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMagasins)
  }, [])


  const fetchDepenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
      })
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (filtreCategorie) params.set('categorie', filtreCategorie)
      if (filtreMagasin) params.set('magasinId', filtreMagasin)
      if (searchTerm) params.set('search', searchTerm)

      const res = await fetch(`/api/depenses?${params.toString()}&t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setDepenses(data.data || [])
        setPagination(data.pagination || null)
        setTotalAmount(data.totalAmount || 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepenses()
  }, [dateDebut, dateFin, filtreCategorie, filtreMagasin, searchTerm])

  useEffect(() => {
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => { })
  }, [])

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      magasinId: '',
      categorie: 'AUTRE',
      categorieLibre: '',
      libelle: '',
      montant: '',
      montantPaye: '',
      modePaiement: 'ESPECES',
      beneficiaire: '',
      pieceJustificative: '',
      observation: '',
    })
    setEditing(null)
    setForm(false)
    setErr('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    const validationData = {
      date: formData.date,
      magasinId: formData.magasinId ? Number(formData.magasinId) : null,
      categorie: formData.categorie === 'AUTRE' && formData.categorieLibre ? formData.categorieLibre.trim() : formData.categorie,
      libelle: formData.libelle.trim(),
      montant: Number(formData.montant),
      montantPaye: formData.montantPaye !== '' ? Number(formData.montantPaye) : undefined,
      modePaiement: formData.modePaiement as 'ESPECES' | 'MOBILE_MONEY' | 'CREDIT' | 'VIREMENT' | 'CHEQUE',
      beneficiaire: formData.beneficiaire.trim() || null,
    }

    const validation = validateForm(depenseSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      return
    }

    const requestData = {
      ...validationData,
      pieceJustificative: formData.pieceJustificative.trim() || null,
      observation: formData.observation.trim() || null,
    }

    // Dans GestiCom Offline, l'enregistrement se fait toujours directement vers le serveur local.

    try {
      const url = editing ? `/api/depenses/${editing.id}` : '/api/depenses'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        fetchDepenses()
        setTimeout(() => fetchDepenses(), 500)
        showSuccess(editing ? MESSAGES.DEPENSE_MODIFIEE : MESSAGES.DEPENSE_ENREGISTREE)
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de l\'enregistrement.')
        setErr(data.hint ? `${errorMsg}\n\n${data.hint}` : errorMsg)
        showError(data.hint ? `${errorMsg}\n\n${data.hint}` : errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    }
  }

  const handleEdit = (depense: Depense) => {
    setEditing(depense)
    const isCategorieLibre = !CATEGORIES.includes(depense.categorie)
    setFormData({
      date: depense.date.split('T')[0],
      magasinId: depense.magasin ? String(depense.magasin.id) : '',
      categorie: isCategorieLibre ? 'AUTRE' : depense.categorie,
      categorieLibre: isCategorieLibre ? depense.categorie : '',
      libelle: depense.libelle,
      montant: String(depense.montant),
      montantPaye: depense.montantPaye != null ? String(depense.montantPaye) : '',
      modePaiement: depense.modePaiement,
      beneficiaire: depense.beneficiaire || '',
      pieceJustificative: depense.pieceJustificative || '',
      observation: depense.observation || '',
    })
    setForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette dépense ? Toutes les écritures comptables et règlements associés seront également supprimés. Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/depenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess(MESSAGES.DEPENSE_SUPPRIMEE)
        fetchDepenses()
        setTimeout(() => fetchDepenses(), 500)
      } else {
        const data = await res.json()
        showError(res.status === 403 ? (data.error || MESSAGES.RESERVE_SUPER_ADMIN) : formatApiError(data.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const total = depenses.reduce((s, d) => s + d.montant, 0)
  const totalParCategorie = depenses.reduce((acc, d) => {
    acc[d.categorie] = (acc[d.categorie] || 0) + d.montant
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dépenses</h1>
          <p className="mt-1 text-white/90">Gestion des dépenses quotidiennes</p>
        </div>
        <button
          onClick={() => setForm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        >
          <Plus className="h-5 w-5" />
          Nouvelle dépense
        </button>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
          {(dateDebut || dateFin || filtreCategorie || filtreMagasin) && (
            <button
              onClick={() => {
                setDateDebut('')
                setDateFin('')
                setFiltreCategorie('')
                setFiltreMagasin('')
              }}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Catégorie</label>
              <select
                value={filtreCategorie}
                onChange={(e) => setFiltreCategorie(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Magasin</label>
              <select
                value={filtreMagasin}
                onChange={(e) => setFiltreMagasin(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {magasins.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.nom}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="text-sm font-medium text-white/90">Total dépenses</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {totalAmount.toLocaleString('fr-FR')} FCFA
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="text-sm font-medium text-white/90">Nombre de dépenses</div>
          <div className="mt-1 text-2xl font-bold text-white">{pagination?.total || 0}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <div className="text-sm font-medium text-white/90">Moyenne</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {pagination && pagination.total > 0 ? Math.round(totalAmount / pagination.total).toLocaleString('fr-FR') : 0} FCFA
          </div>
        </div>
      </div>

      {/* Boutons d'export */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams()
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            if (filtreCategorie) params.set('categorie', filtreCategorie)
            if (filtreMagasin) params.set('magasinId', filtreMagasin)
            window.open(`/api/depenses/export-excel?${params.toString()}`, '_blank')
          }}
          className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
          title="Exporter les dépenses en Excel"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams()
            if (dateDebut) params.set('dateDebut', dateDebut)
            if (dateFin) params.set('dateFin', dateFin)
            if (filtreCategorie) params.set('categorie', filtreCategorie)
            if (filtreMagasin) params.set('magasinId', filtreMagasin)
            window.open(`/api/depenses/export-pdf?${params.toString()}`, '_blank')
          }}
          className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
          title="Exporter les dépenses en PDF"
        >
          <Download className="h-4 w-4" />
          PDF
        </button>
        <Link
          href="/dashboard/depenses/journal"
          className="flex items-center gap-2 rounded-lg border-2 border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 shadow-lg active:scale-95 transition-all"
          title="Consulter le journal pour impression"
        >
          <BookOpen className="h-4 w-4" />
          JOURNAL DES DÉPENSES
        </Link>
      </div>

      <div className="hidden print:block text-center p-8">
        <p className="text-sm font-bold text-slate-500 italic">Veuillez utiliser la page dédiée &quot;Journal des Dépenses&quot; pour l'impression.</p>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : depenses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">Aucune dépense trouvée</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mode paiement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Bénéficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Magasin</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {depenses.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(d.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                        {d.categorie}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{d.libelle}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {d.montant.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{d.modePaiement}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{d.beneficiaire || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{d.magasin?.nom || d.magasin?.code || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(d)}
                          className="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                            title="Supprimer (Super Admin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagination && pagination.totalPages > 1 && (
                  <tr>
                    <td colSpan={8} className="px-0 py-0 border-t border-gray-200">
                      <div className="bg-white px-4 py-3">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={pagination.totalPages}
                          totalItems={pagination.total}
                          itemsPerPage={pagination.limit || itemsPerPage}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            {err && (
              <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm whitespace-pre-line">{err}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Point de vente</label>
                  <select
                    value={formData.magasinId}
                    onChange={(e) => setFormData({ ...formData, magasinId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">— Aucun —</option>
                    {magasins.map((m) => (
                      <option key={m.id} value={String(m.id)}>{m.nom}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select
                    required
                    value={formData.categorie}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({ ...formData, categorie: val })
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {CATEGORIES.filter(c => c !== 'AUTRE').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="AUTRE">Autre (à préciser)</option>
                  </select>
                  {formData.categorie === 'AUTRE' && (
                    <input
                      type="text"
                      required
                      placeholder="Précisez la catégorie"
                      value={formData.categorieLibre || ''}
                      onChange={(e) => setFormData({ ...formData, categorieLibre: e.target.value })}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant (FCFA) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.montant}
                    onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement *</label>
                  <select
                    required
                    value={formData.modePaiement}
                    onChange={(e) => {
                      const mode = e.target.value
                      const total = Number(formData.montant) || 0
                      setFormData({
                        ...formData,
                        modePaiement: mode,
                        montantPaye: mode === 'CREDIT' ? '0' : (formData.montantPaye === '' ? String(total) : formData.montantPaye),
                      })
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {MODES_PAIEMENT.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (avance)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.montantPaye}
                    onChange={(e) => setFormData({ ...formData, montantPaye: e.target.value })}
                    placeholder={formData.modePaiement === 'CREDIT' ? '0' : formData.montant}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <p className="mt-0.5 text-xs text-gray-500">Laisser vide = tout payé (sauf si Crédit)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reste à payer</label>
                  <p className="mt-1 font-semibold text-amber-800">
                    {Math.max(0, (Number(formData.montant) || 0) - (Number(formData.montantPaye) || 0)).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bénéficiaire</label>
                  <input
                    type="text"
                    value={formData.beneficiaire}
                    onChange={(e) => setFormData({ ...formData, beneficiaire: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
                <input
                  type="text"
                  required
                  value={formData.libelle}
                  onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Description de la dépense"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pièce justificative</label>
                <input
                  type="text"
                  value={formData.pieceJustificative}
                  onChange={(e) => setFormData({ ...formData, pieceJustificative: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Référence de la pièce"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observation</label>
                <textarea
                  value={formData.observation}
                  onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                >
                  {editing ? 'Modifier' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
