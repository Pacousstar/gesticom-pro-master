'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Plus, Loader2, Pencil, Trash2, X, Search, Filter, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ComptabiliteNav from '../ComptabiliteNav'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

type PlanCompte = {
  id: number
  numero: string
  libelle: string
  classe: string
  type: string
  actif: boolean
}

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8']
const TYPES = ['ACTIF', 'PASSIF', 'CHARGES', 'PRODUITS']

export default function PlanComptesPage() {
  const [comptes, setComptes] = useState<PlanCompte[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<PlanCompte | null>(null)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [formData, setFormData] = useState({
    numero: '',
    libelle: '',
    classe: '1',
    type: 'CHARGES',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filtreClasse, setFiltreClasse] = useState('')
  const [filtreType, setFiltreType] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchComptes = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (filtreClasse) params.set('classe', filtreClasse)
    if (filtreType) params.set('type', filtreType)
    
    fetch('/api/plan-comptes?' + params.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then(setComptes)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchComptes()
  }, [searchTerm, filtreClasse, filtreType])

  const resetForm = () => {
    setFormData({ numero: '', libelle: '', classe: '1', type: 'CHARGES' })
    setEditing(null)
    setForm(false)
    setErr('')
  }

  const openForm = (c?: PlanCompte) => {
    if (c) {
      setEditing(c)
      setFormData({
        numero: c.numero,
        libelle: c.libelle,
        classe: c.classe,
        type: c.type,
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
    
    if (!formData.numero.trim() || !formData.libelle.trim()) {
      setErr('Numéro et libellé requis.')
      return
    }

    try {
      const url = editing ? `/api/plan-comptes/${editing.id}` : '/api/plan-comptes'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: formData.numero.trim(),
          libelle: formData.libelle.trim(),
          classe: formData.classe,
          type: formData.type,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        fetchComptes()
        showSuccess(editing ? 'Compte modifié avec succès.' : 'Compte créé avec succès.')
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
    if (!confirm('Désactiver ce compte ? Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/plan-comptes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchComptes()
        showSuccess('Compte désactivé avec succès.')
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de la désactivation.'))
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
          <h1 className="text-3xl font-bold text-white">Plan de Comptes SYSCOHADA</h1>
          <p className="mt-1 text-white/90">Gestion du plan de comptes selon le système comptable OHADA</p>
        </div>
        <div className="flex items-center gap-2">
          <ListPrintWrapper
            title="Plan de Comptes SYSCOHADA"
            subtitle="Référentiel Comptable de l'Entreprise"
          >
            <table className="w-full text-[10px] border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 uppercase font-black text-gray-700">
                  <th className="border border-gray-300 px-3 py-3 text-left">Numéro</th>
                  <th className="border border-gray-300 px-3 py-3 text-left">Libellé</th>
                  <th className="border border-gray-300 px-3 py-3 text-left">Classe</th>
                  <th className="border border-gray-300 px-3 py-3 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="border border-gray-300 px-3 py-2 font-mono font-bold">{c.numero}</td>
                    <td className="border border-gray-300 px-3 py-2 uppercase">{c.libelle}</td>
                    <td className="border border-gray-300 px-3 py-2 text-[9px]">Classe {c.classe}</td>
                    <td className="border border-gray-300 px-3 py-2 font-medium">{c.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListPrintWrapper>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-600 bg-orange-50 px-4 py-2 text-orange-800 hover:bg-orange-100 font-bold"
          >
            <Printer className="h-5 w-5" />
            Imprimer
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 font-bold"
          >
            <Plus className="h-5 w-5" />
            Nouveau compte
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro ou libellé..."
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
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Classe</label>
              <select
                value={filtreClasse}
                onChange={(e) => setFiltreClasse(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Toutes</option>
                {CLASSES.map((c) => (
                  <option key={c} value={c}>Classe {c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-800 mb-1">Type</label>
              <select
                value={filtreType}
                onChange={(e) => setFiltreType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Tous</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
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
      ) : comptes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">Aucun compte trouvé</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Numéro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comptes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.numero}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{c.libelle}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Classe {c.classe}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        c.type === 'ACTIF' ? 'bg-blue-100 text-blue-800' :
                        c.type === 'PASSIF' ? 'bg-purple-100 text-purple-800' :
                        c.type === 'CHARGES' ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openForm(c)}
                          className="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                          title="Désactiver"
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Modifier le compte' : 'Nouveau compte'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            {err && (
              <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{err}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de compte *</label>
                <input
                  type="text"
                  required
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="ex: 411, 512, 701"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
                <input
                  type="text"
                  required
                  value={formData.libelle}
                  onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                  placeholder="Libellé du compte"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Classe *</label>
                  <select
                    required
                    value={formData.classe}
                    onChange={(e) => setFormData({ ...formData, classe: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {CLASSES.map((c) => (
                      <option key={c} value={c}>Classe {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
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
    </div>
  )
}
