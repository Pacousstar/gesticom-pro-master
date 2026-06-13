'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Trash2, Edit2, Search, Filter, X, FileSpreadsheet, Download } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { chargeSchema } from '@/lib/validations'
import { validateForm, formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import Pagination from '@/components/ui/Pagination'

type Charge = {
  id: number
  date: string
  type: string
  rubrique: string
  beneficiaire: string | null
  montant: number
  observation: string | null
  magasin: { id: number; code: string; nom: string } | null
  entite: { id: number; code: string; nom: string }
  utilisateur: { nom: string; login: string }
}

const RUBRIQUES = [
  'LOYER',
  'SALAIRES',
  'ELECTRICITE',
  'EAU',
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
  'AUTRE',
]

const TYPES = ['FIXE', 'VARIABLE'] as const

type Magasin = { id: number; code: string; nom: string }

export default function ChargesPage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Charge | null>(null)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    type: 'VARIABLE' as 'FIXE' | 'VARIABLE',
    rubrique: 'AUTRE',
    rubriqueLibre: '',
    beneficiaire: '',
    montant: '',
    observation: '',
  })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const { success: showSuccess, error: showError } = useToast()
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [filtreRubrique, setFiltreRubrique] = useState('')
  const [filtreMagasin, setFiltreMagasin] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)
  const itemsPerPage = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [dateDebut, dateFin, filtreType, filtreRubrique, filtreMagasin, searchTerm])

  useEffect(() => {
    fetch('/api/auth/check').then((r) => r.ok && r.json()).then((d) => d && setUserRole(d.role)).catch(() => { })
  }, [])

  useEffect(() => {
    fetch('/api/magasins')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMagasins)
  }, [])

  const fetchCharges = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(itemsPerPage), page: String(currentPage) })
      if (searchTerm) params.set('q', searchTerm)
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (filtreType) params.set('type', filtreType)
      if (filtreRubrique) params.set('rubrique', filtreRubrique)
      if (filtreMagasin) params.set('magasinId', filtreMagasin)
      const res = await fetch('/api/charges?' + params.toString())
      if (res.ok) {
        const data = await res.json()
        setCharges(data.charges || [])
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
    fetchCharges()
  }, [dateDebut, dateFin, filtreType, filtreRubrique, filtreMagasin, searchTerm, currentPage])

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      magasinId: '',
      type: 'VARIABLE',
      rubrique: 'AUTRE',
      rubriqueLibre: '',
      beneficiaire: '',
      montant: '',
      observation: '',
    })
    setEditing(null)
    setFormOpen(false)
    setErr('')
  }

  const openNew = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      magasinId: '',
      type: 'VARIABLE',
      rubrique: 'AUTRE',
      rubriqueLibre: '',
      beneficiaire: '',
      montant: '',
      observation: '',
    })
    setEditing(null)
    setErr('')
    setFormOpen(true)
  }

  const handleEdit = (c: Charge) => {
    setEditing(c)
    const isRubriqueLibre = !RUBRIQUES.includes(c.rubrique || '')
    setFormData({
      date: c.date.split('T')[0],
      magasinId: c.magasin ? String(c.magasin.id) : '',
      type: (c.type as 'FIXE' | 'VARIABLE') || 'VARIABLE',
      rubrique: isRubriqueLibre ? 'AUTRE' : (c.rubrique || 'AUTRE'),
      rubriqueLibre: isRubriqueLibre ? (c.rubrique || '') : '',
      beneficiaire: c.beneficiaire || '',
      montant: String(c.montant),
      observation: c.observation || '',
    })
    setErr('')
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    const rubriqueFinale = formData.rubrique === 'AUTRE' && formData.rubriqueLibre ? formData.rubriqueLibre.trim() : formData.rubrique.trim()
    const validationData = {
      date: formData.date,
      magasinId: formData.magasinId ? Number(formData.magasinId) : null,
      type: formData.type,
      rubrique: rubriqueFinale,
      beneficiaire: formData.beneficiaire.trim() || null,
      montant: Number(formData.montant),
      observation: formData.observation.trim() || null,
    }

    const validation = validateForm(chargeSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      return
    }

    setSaving(true)
    try {
      const url = editing ? `/api/charges/${editing.id}` : '/api/charges'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validationData),
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        fetchCharges()
        setTimeout(() => fetchCharges(), 500)
        showSuccess(editing ? MESSAGES.CHARGE_MODIFIEE : MESSAGES.CHARGE_ENREGISTREE)
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

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette charge ? Toutes les écritures comptables associées seront également supprimées. Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/charges/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCharges()
        showSuccess(MESSAGES.CHARGE_SUPPRIMEE)
      } else {
        const d = await res.json()
        showError(res.status === 403 ? (d.error || MESSAGES.RESERVE_SUPER_ADMIN) : formatApiError(d.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const total = charges.reduce((s, c) => s + c.montant, 0)
  const totalFixe = charges.filter((c) => c.type === 'FIXE').reduce((s, c) => s + c.montant, 0)
  const totalVariable = charges.filter((c) => c.type === 'VARIABLE').reduce((s, c) => s + c.montant, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Charges</h1>
          <p className="mt-1 text-white/90">Charges de l&apos;entité (fixes et variables)</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700 shadow-lg transition-all">
          <Plus className="h-5 w-5" />
          Nouvelle charge
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
                placeholder="Rechercher par rubrique, bénéficiaire, observation..."
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
          {(dateDebut || dateFin || filtreType || filtreRubrique || filtreMagasin) && (
            <button
              onClick={() => {
                setDateDebut('')
                setDateFin('')
                setFiltreType('')
                setFiltreRubrique('')
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
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-5">
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date début</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date fin</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Type</label>
              <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Tous</option>
                <option value="FIXE">Fixe</option>
                <option value="VARIABLE">Variable</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Rubrique</label>
              <select value={filtreRubrique} onChange={(e) => setFiltreRubrique(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Toutes</option>
                {RUBRIQUES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Point de vente</label>
              <select value={filtreMagasin} onChange={(e) => setFiltreMagasin(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Tous</option>
                {magasins.map((m) => (<option key={m.id} value={String(m.id)}>{m.nom}</option>))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-red-500 to-pink-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/80">Total charges (période)</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalAmount.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/80">Nombre de charges</p>
          <p className="mt-1 text-2xl font-bold text-white">{pagination?.total || 0}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
          <p className="text-sm font-medium text-white/80">Moyenne</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {pagination && pagination.total > 0 ? Math.round(totalAmount / pagination.total).toLocaleString('fr-FR') : 0} FCFA
          </p>
        </div>
      </div>

      {/* Boutons d'export */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => { const p = new URLSearchParams(); if (dateDebut) p.set('dateDebut', dateDebut); if (dateFin) p.set('dateFin', dateFin); if (filtreType) p.set('type', filtreType); if (filtreRubrique) p.set('rubrique', filtreRubrique); if (filtreMagasin) p.set('magasinId', filtreMagasin); window.open(`/api/charges/export-excel?${p.toString()}`, '_blank') }} className="flex items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100">
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </button>
        <button onClick={() => { const p = new URLSearchParams(); if (dateDebut) p.set('dateDebut', dateDebut); if (dateFin) p.set('dateFin', dateFin); if (filtreType) p.set('type', filtreType); if (filtreRubrique) p.set('rubrique', filtreRubrique); if (filtreMagasin) p.set('magasinId', filtreMagasin); window.open(`/api/charges/export-pdf?${p.toString()}`, '_blank') }} className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100">
          <Download className="h-4 w-4" /> PDF
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
        </div>
      ) : charges.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">Aucune charge sur la période.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Point de vente</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Rubrique</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Bénéficiaire</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Observation</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">Utilisateur</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {charges.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{new Date(c.date).toLocaleString('fr-FR')}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{c.magasin?.nom || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${c.type === 'FIXE' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {c.type === 'FIXE' ? 'Fixe' : 'Variable'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{c.rubrique}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">{c.beneficiaire || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-gray-900">{c.montant.toLocaleString('fr-FR')} FCFA</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{c.observation || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{c.utilisateur?.nom || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(c)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 className="h-4 w-4" /></button>
                        {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
                          <button onClick={() => handleDelete(c.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagination && pagination.totalPages > 1 && (
                  <tr>
                    <td colSpan={9} className="px-0 py-0 border-t border-gray-200">
                      <div className="bg-white px-4 py-3">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={pagination.totalPages}
                          totalItems={pagination.total}
                          itemsPerPage={itemsPerPage}
                          onPageChange={(p) => { setCurrentPage(p); scrollTo({ top: 0, behavior: 'smooth' }) }}
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
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[95vh] w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Modifier la charge' : 'Nouvelle charge'}
              </h2>
              <button type="button" onClick={resetForm} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <form onSubmit={handleSubmit} className="space-y-4">
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Point de vente</label>
                <select
                  value={formData.magasinId}
                  onChange={(e) => setFormData((f) => ({ ...f, magasinId: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Aucun —</option>
                  {magasins.map((m) => (
                    <option key={m.id} value={String(m.id)}>{m.code} – {m.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value as 'FIXE' | 'VARIABLE' }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t === 'FIXE' ? 'Fixe' : 'Variable'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rubrique</label>
                <select
                  required
                  value={formData.rubrique}
                  onChange={(e) => setFormData((f) => ({ ...f, rubrique: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {RUBRIQUES.filter(r => r !== 'AUTRE').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="AUTRE">Autre (à préciser)</option>
                </select>
                {formData.rubrique === 'AUTRE' && (
                  <input
                    type="text"
                    required
                    placeholder="Précisez la rubrique"
                    value={formData.rubriqueLibre || ''}
                    onChange={(e) => setFormData((f) => ({ ...f, rubriqueLibre: e.target.value }))}
                    className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 font-bold">Bénéficiaire / Destinataire</label>
                <input
                  type="text"
                  value={formData.beneficiaire}
                  onChange={(e) => setFormData((f) => ({ ...f, beneficiaire: e.target.value }))}
                  placeholder="Ex: Nom de l'employé, Fournisseur..."
                  className="mt-1 block w-full rounded-lg border-2 border-orange-100 px-3 py-2 text-sm focus:border-orange-500 outline-none italic font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Montant (FCFA)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={formData.montant}
                  onChange={(e) => setFormData((f) => ({ ...f, montant: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Observation</label>
                <input
                  type="text"
                  value={formData.observation}
                  onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                  placeholder="Optionnel"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
