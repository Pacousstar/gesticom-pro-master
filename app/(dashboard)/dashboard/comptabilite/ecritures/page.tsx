'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, Loader2, Pencil, Trash2, X, Search, Filter, Download, FileSpreadsheet, Printer } from 'lucide-react'
import ComptabiliteNav from '../ComptabiliteNav'
import { useToast } from '@/hooks/useToast'
import { ecritureSchema } from '@/lib/validations'
import { validateForm, formatApiError, ErrorMessages } from '@/lib/validation-helpers'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

type Ecriture = {
  id: number
  numero: string
  date: string
  journal: { code: string; libelle: string }
  piece: string | null
  libelle: string
  compte: { numero: string; libelle: string }
  debit: number
  credit: number
  reference: string | null
  referenceType: string | null
  utilisateur: { nom: string; login: string }
}

type Journal = { id: number; code: string; libelle: string }
type PlanCompte = { id: number; numero: string; libelle: string }

export default function EcrituresPage() {
  const [ecritures, setEcritures] = useState<Ecriture[]>([])
  const [journaux, setJournaux] = useState<Journal[]>([])
  const [comptes, setComptes] = useState<PlanCompte[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Ecriture | null>(null)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    journalId: '',
    piece: '',
    libelle: '',
    compteId: '',
    debit: '',
    credit: '',
    reference: '',
    referenceType: '',
    referenceId: '',
  })
  // Par défaut : début de l'année précédente jusqu'à fin du mois en cours (pour inclure écritures importées, souvent en 2025)
  const now = new Date()
  const firstDayPreviousYear = new Date(now.getFullYear() - 1, 0, 1)
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const [dateDebut, setDateDebut] = useState(firstDayPreviousYear.toISOString().split('T')[0])
  const [dateFin, setDateFin] = useState(lastDayOfMonth.toISOString().split('T')[0])
  const [filtreJournal, setFiltreJournal] = useState('')
  const [filtreCompte, setFiltreCompte] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [toutesLesDates, setToutesLesDates] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [diagnostic, setDiagnostic] = useState<{
    operations?: { ventes: number; achats: number; depenses: number; charges: number }
    ecritures?: { total: number; parType?: { type: string; nombre: number }[] }
    ecrituresDateMin?: string | null
    ecrituresDateMax?: string | null
  } | null>(null)

  useEffect(() => {
    fetch('/api/journaux')
      .then((r) => (r.ok ? r.json() : []))
      .then(setJournaux)
    fetch('/api/plan-comptes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setComptes)
  }, [])

  const fetchEcritures = () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (!toutesLesDates) {
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
    }
    if (filtreJournal) params.set('journalId', filtreJournal)
    if (filtreCompte) params.set('compteId', filtreCompte)
    
    fetch('/api/ecritures?' + params.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then(setEcritures)
      .finally(() => setLoading(false))
  }

  const fetchDiagnostic = () => {
    fetch('/api/comptabilite/diagnostic')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setDiagnostic({
          operations: d.operations,
          ecritures: d.ecritures ? { total: d.ecritures.total, parType: d.ecritures.parType } : undefined,
          ecrituresDateMin: d.ecrituresDateMin,
          ecrituresDateMax: d.ecrituresDateMax,
        })
      })
      .catch(() => setDiagnostic(null))
  }

  useEffect(() => {
    fetchEcritures()
  }, [dateDebut, dateFin, filtreJournal, filtreCompte, toutesLesDates])

  useEffect(() => {
    fetchDiagnostic()
  }, [])

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      journalId: '',
      piece: '',
      libelle: '',
      compteId: '',
      debit: '',
      credit: '',
      reference: '',
      referenceType: '',
      referenceId: '',
    })
    setEditing(null)
    setForm(false)
    setErr('')
  }

  const openForm = (e?: Ecriture) => {
    if (e) {
      setEditing(e)
      setFormData({
        date: e.date.split('T')[0],
        journalId: String(e.journal.code),
        piece: e.piece || '',
        libelle: e.libelle,
        compteId: String(e.compte.numero),
        debit: String(e.debit),
        credit: String(e.credit),
        reference: e.reference || '',
        referenceType: e.referenceType || '',
        referenceId: e.reference ? String(e.reference) : '',
      })
    } else {
      resetForm()
    }
    setForm(true)
    setErr('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    
    // Trouver le journal et le compte par code/numéro
    const journal = journaux.find(j => j.code === formData.journalId || String(j.id) === formData.journalId)
    const compte = comptes.find(c => c.numero === formData.compteId || String(c.id) === formData.compteId)

    if (!journal || !compte) {
      const errorMsg = !journal ? 'Journal invalide. Veuillez sélectionner un journal valide.' : 'Compte invalide. Veuillez sélectionner un compte valide.'
      setErr(errorMsg)
      showError(errorMsg)
      return
    }

    const debit = Number(formData.debit) || 0
    const credit = Number(formData.credit) || 0

    // Validation avec schéma Zod
    const validationData = {
      date: formData.date,
      journalId: journal.id,
      piece: formData.piece.trim() || null,
      libelle: formData.libelle.trim(),
      compteId: compte.id,
      debit,
      credit,
      reference: formData.reference.trim() || null,
      referenceType: formData.referenceType.trim() || null,
      referenceId: formData.referenceId ? Number(formData.referenceId) : null,
    }

    const validation = validateForm(ecritureSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      return
    }

    try {
      const url = editing ? `/api/ecritures/${editing.id}` : '/api/ecritures'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validationData),
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        fetchEcritures()
        showSuccess(editing ? 'Écriture modifiée avec succès.' : 'Écriture créée avec succès.')
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de l\'enregistrement.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette écriture ? Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/ecritures/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchEcritures()
        showSuccess('Écriture supprimée avec succès.')
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  return (
    <div className="space-y-6">
      <ComptabiliteNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Écritures Comptables</h1>
          <p className="mt-1 text-white/90">Saisie et gestion des écritures comptables SYSCOHADA</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreJournal) params.set('journalId', filtreJournal)
              if (filtreCompte) params.set('compteId', filtreCompte)
              window.open(`/api/ecritures/export-excel?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            title="Exporter en Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (dateDebut) params.set('dateDebut', dateDebut)
              if (dateFin) params.set('dateFin', dateFin)
              if (filtreJournal) params.set('journalId', filtreJournal)
              if (filtreCompte) params.set('compteId', filtreCompte)
              window.open(`/api/ecritures/export-pdf?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            title="Exporter en PDF"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 1000); }}
            disabled={isPrinting}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-4 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            Imprimer Livre-Journal
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            <Plus className="h-5 w-5" />
            Nouvelle écriture
          </button>
        </div>
      </div>

      {/* Résumé base (ventes, achats, dépenses, charges, écritures) */}
      {diagnostic && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Contenu de la base</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="text-gray-700">Ventes (validées): <strong>{diagnostic.operations?.ventes ?? '-'}</strong></span>
            <span className="text-gray-700">Achats: <strong>{diagnostic.operations?.achats ?? '-'}</strong></span>
            <span className="text-gray-700">Dépenses: <strong>{diagnostic.operations?.depenses ?? '-'}</strong></span>
            <span className="text-gray-700">Charges: <strong>{diagnostic.operations?.charges ?? '-'}</strong></span>
            <span className="text-gray-700 border-l pl-4">Écritures: <strong>{diagnostic.ecritures?.total ?? '-'}</strong></span>
            {diagnostic.ecritures?.parType && diagnostic.ecritures.parType.length > 0 && (
              <span className="text-gray-600">
                ({diagnostic.ecritures.parType.map((t) => `${t.type || 'MANUEL'}: ${t.nombre}`).join(', ')})
              </span>
            )}
            {(diagnostic.ecrituresDateMin || diagnostic.ecrituresDateMax) && (
              <span className="text-gray-600">
                Période écritures: {diagnostic.ecrituresDateMin ?? '?'} → {diagnostic.ecrituresDateMax ?? '?'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchDiagnostic}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Actualiser le résumé
          </button>
        </div>
      )}

      {/* Filtres et backfill */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
          <button
            type="button"
            disabled={backfilling}
            onClick={async () => {
              setBackfilling(true)
              try {
                const res = await fetch('/api/comptabilite/backfill-ecritures', { method: 'POST' })
                const data = await res.json().catch(() => ({}))
                if (res.ok && data.ok) {
                  showSuccess(data.message || 'Écritures générées.')
                  fetchEcritures()
                  fetchDiagnostic()
                } else {
                  showError(data.error || data.message || 'Erreur lors de la génération.')
                }
              } catch (e) {
                showError('Erreur réseau.')
              } finally {
                setBackfilling(false)
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            title="Génère les écritures pour les ventes, achats et dépenses qui n'en ont pas encore (ex. après import)."
          >
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Générer écritures manquantes
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-5">
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={toutesLesDates}
                  onChange={(e) => setToutesLesDates(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Toutes les dates</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                disabled={toutesLesDates}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                disabled={toutesLesDates}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Journal</label>
              <select
                value={filtreJournal}
                onChange={(e) => setFiltreJournal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {journaux.map((j) => (
                  <option key={j.id} value={String(j.id)}>{j.code} - {j.libelle}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Compte</label>
              <select
                value={filtreCompte}
                onChange={(e) => setFiltreCompte(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {comptes.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.numero} - {c.libelle}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : ecritures.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">Aucune écriture trouvée</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Journal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Pièce</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Compte</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Débit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Crédit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ecritures.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(e.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{e.journal.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{e.piece || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{e.libelle}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {e.compte.numero} - {e.compte.libelle}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                      {e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                      {e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openForm(e)}
                          className="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulaire */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Modifier l\'écriture' : 'Nouvelle écriture'}
              </h2>
              <button onClick={resetForm} className="text-gray-600 hover:text-gray-900" aria-label="Fermer">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Journal *</label>
                  <select
                    required
                    value={formData.journalId}
                    onChange={(e) => setFormData({ ...formData, journalId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  >
                    <option value="">—</option>
                    {journaux.map((j) => (
                      <option key={j.id} value={j.code}>{j.code} - {j.libelle}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Pièce justificative</label>
                  <input
                    type="text"
                    value={formData.piece}
                    onChange={(e) => setFormData({ ...formData, piece: e.target.value })}
                    placeholder="Numéro de pièce"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Compte *</label>
                  <select
                    required
                    value={formData.compteId}
                    onChange={(e) => setFormData({ ...formData, compteId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  >
                    <option value="">—</option>
                    {comptes.map((c) => (
                      <option key={c.id} value={c.numero}>{c.numero} - {c.libelle}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Libellé *</label>
                <input
                  type="text"
                  required
                  value={formData.libelle}
                  onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                  placeholder="Description de l'écriture"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Débit (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.debit}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({ ...formData, debit: val, credit: val ? '' : formData.credit })
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Crédit (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.credit}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({ ...formData, credit: val, debit: val ? '' : formData.debit })
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Type référence</label>
                  <select
                    value={formData.referenceType}
                    onChange={(e) => setFormData({ ...formData, referenceType: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  >
                    <option value="">—</option>
                    <option value="VENTE">Vente</option>
                    <option value="ACHAT">Achat</option>
                    <option value="DEPENSE">Dépense</option>
                    <option value="CHARGE">Charge</option>
                    <option value="CAISSE">Caisse</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">ID référence</label>
                  <input
                    type="number"
                    value={formData.referenceId}
                    onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                    placeholder="ID de l'opération"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Référence</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="Référence libre"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 bg-white"
                  />
                </div>
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
      {/* Zone d'impression professionnelle standardisée */}
      <ListPrintWrapper
        title="Livre-Journal"
        subtitle="Journal général des écritures comptables"
        dateRange={toutesLesDates ? undefined : { start: dateDebut, end: dateFin }}
      >
        <table className="w-full text-[9px] border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 uppercase font-black text-gray-700">
              <th className="border border-gray-300 px-2 py-3 text-left">Date</th>
              <th className="border border-gray-300 px-2 py-3 text-left">Journal</th>
              <th className="border border-gray-300 px-2 py-3 text-left">Pièce</th>
              <th className="border border-gray-300 px-2 py-3 text-left">Libellé</th>
              <th className="border border-gray-300 px-2 py-3 text-left">Compte</th>
              <th className="border border-gray-300 px-2 py-3 text-right">Débit</th>
              <th className="border border-gray-300 px-2 py-3 text-right">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {ecritures.map((e, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="border border-gray-300 px-2 py-2">
                  {new Date(e.date).toLocaleDateString('fr-FR')}
                </td>
                <td className="border border-gray-300 px-2 py-2 uppercase font-bold text-center">{e.journal.code}</td>
                <td className="border border-gray-300 px-2 py-2">{e.piece || '—'}</td>
                <td className="border border-gray-300 px-2 py-2 uppercase font-medium">{e.libelle}</td>
                <td className="border border-gray-300 px-2 py-2">
                   <span className="font-bold">{e.compte.numero}</span><br/>
                   <small className="italic text-gray-500">{e.compte.libelle}</small>
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                   {e.debit > 0 ? e.debit.toLocaleString('fr-FR') : '—'}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right">
                   {e.credit > 0 ? e.credit.toLocaleString('fr-FR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
             <tr className="bg-gray-50 font-black text-[10px]">
                <td colSpan={5} className="border border-gray-300 px-3 py-4 text-right uppercase italic">Totaux du Période</td>
                <td className="border border-gray-300 px-3 py-4 text-right">
                   {ecritures.reduce((acc, e) => acc + e.debit, 0).toLocaleString('fr-FR')} F
                </td>
                <td className="border border-gray-300 px-3 py-4 text-right">
                   {ecritures.reduce((acc, e) => acc + e.credit, 0).toLocaleString('fr-FR')} F
                </td>
             </tr>
          </tfoot>
        </table>
      </ListPrintWrapper>

      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print, button, form { display: none !important; }
          body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  )
}
