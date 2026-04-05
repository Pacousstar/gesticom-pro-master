'use client'

import { useState, useEffect } from 'react'
import { Printer, Plus, Edit2, Trash2, Loader2, X, Upload, Eye } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { getPrintStyles } from '@/lib/print-templates'

type PrintTemplate = {
  id: number
  type: string
  nom: string
  logo?: string | null
  enTete?: string | null
  piedDePage?: string | null
  variables?: string | null
  actif: boolean
  createdAt: string
  updatedAt: string
}

const TEMPLATE_TYPES = [
  { value: 'VENTE', label: 'Vente' },
  { value: 'ACHAT', label: 'Achat' },
  { value: 'BON_LIVRAISON', label: 'Bon de livraison' },
  { value: 'FACTURE', label: 'Facture' },
]

const DEFAULT_TEMPLATE = `{ENTREPRISE_LOGO}
{ENTREPRISE_NOM}
{ENTREPRISE_CONTACT}

{ENTREPRISE_LOCALISATION}

Ticket N°: {NUMERO}

Date: {DATE} {HEURE}

Magasin: {MAGASIN_CODE} - {MAGASIN_NOM}

{CLIENT_NOM ? '
Client: {CLIENT_NOM}

' : ''}
{LIGNES}
Total: {TOTAL}

{MONTANT_PAYE ? '
Payé: {MONTANT_PAYE}

' : ''} {RESTE ? '
Reste: {RESTE}

' : ''}
Mode: {MODE_PAIEMENT}

{OBSERVATION ? '
{OBSERVATION}

' : ''}
Merci de votre visite !

{ENTREPRISE_NOM}`

export default function ImpressionPage() {
  const [templates, setTemplates] = useState<PrintTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PrintTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<string>('')
  const [formData, setFormData] = useState({
    type: 'VENTE',
    nom: '',
    logo: '',
    enTete: '',
    piedDePage: '',
    actif: true,
  })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = () => {
    setLoading(true)
    fetch('/api/print-templates')
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editing ? `/api/print-templates/${editing.id}` : '/api/print-templates'
      const method = editing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          variables: null, // Pour l'instant, pas de variables personnalisées
        }),
      })

      const data = await res.json()
      if (res.ok) {
        showSuccess(editing ? 'Template modifié avec succès.' : 'Template créé avec succès.')
        resetForm()
        fetchTemplates()
      } else {
        showError(formatApiError(data.error || 'Erreur lors de l\'enregistrement.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce template ?')) return

    try {
      const res = await fetch(`/api/print-templates/${id}`, { method: 'DELETE' })
      if (res.ok) {
        showSuccess('Template supprimé avec succès.')
        fetchTemplates()
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de la suppression.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    }
  }

  const handleEdit = (template: PrintTemplate) => {
    setEditing(template)
    setFormData({
      type: template.type,
      nom: template.nom,
      logo: template.logo || '',
      enTete: template.enTete || '',
      piedDePage: template.piedDePage || '',
      actif: template.actif,
    })
    setFormOpen(true)
  }

  const handlePreview = (template: PrintTemplate) => {
    const content = template.enTete || DEFAULT_TEMPLATE
    setPreviewTemplate(content)
    setPreviewOpen(true)
  }

  const resetForm = () => {
    setFormData({
      type: 'VENTE',
      nom: '',
      logo: '',
      enTete: '',
      piedDePage: '',
      actif: true,
    })
    setEditing(null)
    setFormOpen(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showError('Le fichier doit être une image.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      showError('L\'image ne doit pas dépasser 2 Mo.')
      return
    }

    setUploadingLogo(true)
    try {
      // Convertir en base64
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setFormData((f) => ({ ...f, logo: base64 }))
        setUploadingLogo(false)
        showSuccess('Logo uploadé avec succès.')
      }
      reader.onerror = () => {
        showError('Erreur lors de la lecture du fichier.')
        setUploadingLogo(false)
      }
      reader.readAsDataURL(file)
    } catch (e) {
      showError(formatApiError(e))
      setUploadingLogo(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Modèles d'Impression</h1>
          <p className="mt-1 text-white/90">Personnalisez les templates d'impression pour vos documents</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        >
          <Plus className="h-5 w-5" />
          Nouveau template
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Printer className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500">Aucun template. Créez-en un pour commencer.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{template.nom}</h3>
                  <p className="text-sm text-gray-500">
                    {TEMPLATE_TYPES.find((t) => t.value === template.type)?.label || template.type}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    template.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {template.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              {template.logo && (
                <div className="mb-4">
                  <img src={template.logo} alt="Logo" className="h-16 w-auto object-contain" />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePreview(template)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Eye className="mx-auto h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(template)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}>
          <div
            className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Modifier le template' : 'Nouveau template'}
              </h2>
              <button onClick={resetForm} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                    required
                  >
                    {TEMPLATE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nom *</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData((f) => ({ ...f, nom: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Logo</label>
                <div className="mt-1 flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                    disabled={uploadingLogo}
                  />
                  <label
                    htmlFor="logo-upload"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {formData.logo ? 'Changer le logo' : 'Uploader un logo'}
                  </label>
                  {formData.logo && (
                    <img src={formData.logo} alt="Logo" className="h-16 w-auto object-contain" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">En-tête (HTML)</label>
                <textarea
                  value={formData.enTete}
                  onChange={(e) => setFormData((f) => ({ ...f, enTete: e.target.value }))}
                  rows={10}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none"
                  placeholder={DEFAULT_TEMPLATE}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Utilisez les variables : {'{ENTREPRISE_NOM}'}, {'{NUMERO}'}, {'{DATE}'}, {'{LIGNES}'}, etc.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Pied de page (HTML)</label>
                <textarea
                  value={formData.piedDePage}
                  onChange={(e) => setFormData((f) => ({ ...f, piedDePage: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="<p>Merci de votre visite !</p>"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.actif}
                    onChange={(e) => setFormData((f) => ({ ...f, actif: e.target.checked }))}
                  />
                  Template actif
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Aperçu impression</h2>
              <button onClick={() => setPreviewOpen(false)} className="rounded p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <style dangerouslySetInnerHTML={{ __html: getPrintStyles() }} />
              <div
                className="print-document !max-w-none !shadow-none !p-4"
                dangerouslySetInnerHTML={{ __html: previewTemplate }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
