'use client'

import { useState } from 'react'
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

const ENTITIES = [
  { value: 'PRODUITS', label: 'Produits' },
  { value: 'CLIENTS', label: 'Clients' },
  { value: 'FOURNISSEURS', label: 'Fournisseurs' },
]

const EXPORT_FORMATS = [
  { value: 'EXCEL', label: 'Excel (.xlsx)' },
  { value: 'CSV', label: 'CSV (.csv)' },
]

export default function ImportExportPage() {
  const [importEntity, setImportEntity] = useState('PRODUITS')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported: number
    failed: number
    errors: Array<{ row: number; error: string }>
    message: string
  } | null>(null)

  const [exportEntity, setExportEntity] = useState('PRODUITS')
  const [exportFormat, setExportFormat] = useState('EXCEL')
  const [exporting, setExporting] = useState(false)

  const { success: showSuccess, error: showError } = useToast()

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile) {
      showError('Veuillez sélectionner un fichier.')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('entity', importEntity)

      const res = await fetch('/api/import-export', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        setImportResult({
          success: true,
          imported: data.imported || 0,
          failed: data.failed || 0,
          errors: data.errors || [],
          message: data.message || 'Import réussi.',
        })
        showSuccess(data.message || 'Import réussi.')
        setImportFile(null)
      } else {
        setImportResult({
          success: false,
          imported: 0,
          failed: 0,
          errors: data.errors || [],
          message: data.error || 'Erreur lors de l\'import.',
        })
        showError(formatApiError(data.error || 'Erreur lors de l\'import.'))
      }
    } catch (e) {
      showError(formatApiError(e))
      setImportResult({
        success: false,
        imported: 0,
        failed: 0,
        errors: [],
        message: 'Erreur réseau.',
      })
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)

    try {
      const url = `/api/import-export?entity=${exportEntity}&format=${exportFormat}`
      const res = await fetch(url)

      if (res.ok) {
        const blob = await res.blob()
        const filename = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `export-${exportEntity.toLowerCase()}.${exportFormat === 'CSV' ? 'csv' : 'xlsx'}`
        
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)

        showSuccess('Export réussi.')
      } else {
        const data = await res.json()
        showError(formatApiError(data.error || 'Erreur lors de l\'export.'))
      }
    } catch (e) {
      showError(formatApiError(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Import / Export de Données</h1>
        <p className="mt-1 text-white/90">Importer ou exporter des données depuis/vers Excel ou CSV</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Import */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Importer des données</h2>
          </div>

          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type de données *</label>
              <select
                value={importEntity}
                onChange={(e) => setImportEntity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                {ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fichier Excel/CSV *</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Formats acceptés : Excel (.xlsx, .xls) ou CSV (.csv)
              </p>
            </div>

            <button
              type="submit"
              disabled={importing || !importFile}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importer
                </>
              )}
            </button>
          </form>

          {importResult && (
            <div className={`mt-4 rounded-lg border p-4 ${
              importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-start gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {importResult.message}
                  </p>
                  {importResult.imported > 0 && (
                    <p className="mt-1 text-sm text-green-700">
                      {importResult.imported} élément(s) importé(s) avec succès.
                    </p>
                  )}
                  {importResult.failed > 0 && (
                    <p className="mt-1 text-sm text-red-700">
                      {importResult.failed} élément(s) en échec.
                    </p>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs text-red-600">
                          Ligne {err.row} : {err.error}
                        </p>
                      ))}
                      {importResult.errors.length > 5 && (
                        <p className="text-xs text-red-600">
                          ... et {importResult.errors.length - 5} autre(s) erreur(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Format attendu :</p>
                {importEntity === 'PRODUITS' && (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Code (requis)</li>
                    <li>Désignation (requis)</li>
                    <li>Catégorie</li>
                    <li>Prix achat</li>
                    <li>Prix vente</li>
                    <li>Seuil min</li>
                  </ul>
                )}
                {importEntity === 'CLIENTS' && (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Nom (requis)</li>
                    <li>Téléphone</li>
                    <li>Type (CASH/CREDIT)</li>
                    <li>Plafond crédit</li>
                    <li>NCC</li>
                  </ul>
                )}
                {importEntity === 'FOURNISSEURS' && (
                  <ul className="list-disc list-inside space-y-1">
                    <li>Nom (requis)</li>
                    <li>Téléphone</li>
                    <li>Email</li>
                    <li>NCC</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Export */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Download className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">Exporter des données</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type de données *</label>
              <select
                value={exportEntity}
                onChange={(e) => setExportEntity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                {ENTITIES.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Format *</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Export en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exporter
                </>
              )}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Informations :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>L'export inclut toutes les données actives</li>
                  <li>Le fichier sera téléchargé automatiquement</li>
                  <li>Vous pouvez réimporter le fichier exporté</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
