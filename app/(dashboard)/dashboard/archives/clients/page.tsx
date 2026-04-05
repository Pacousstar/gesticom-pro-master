'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Loader2, Trash2, X, FileSpreadsheet, Download, Clock, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

type ArchiveSolde = {
  id: number
  montant: number
  dateArchive: string
  clientLibre: string | null
  observation: string | null
  client: { nom: string } | null
  utilisateur: { nom: string }
}

export default function ArchivesClientsPage() {
  const [q, setQ] = useState('')
  const [list, setList] = useState<ArchiveSolde[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  
  const [clientsDb, setClientsDb] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    clientId: '',
    clientLibre: '',
    montant: '',
    dateArchive: new Date().toISOString().split('T')[0],
    observation: ''
  })

  // Pagination locale
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    fetchList()
    fetch('/api/clients').then(r => r.ok && r.json()).then(d => {
      setClientsDb(d.data || (Array.isArray(d) ? d : []))
    }).catch(() => {})
  }, [])

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/archives/clients`)
      if (res.ok) {
        setList(await res.json())
      }
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (a: ArchiveSolde) => {
    if (!confirm(`Supprimer l'archive de solde pour « ${a.client?.nom || a.clientLibre} » ?`)) return
    try {
      const res = await fetch(`/api/archives/clients?id=${a.id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchList()
        showSuccess('Archive supprimée.')
      } else {
        showError('Erreur de suppression.')
      }
    } catch (e) {
      showError('Erreur système')
    }
  }

  const openForm = () => {
    setForm(true)
    setErr('')
    setFormData({
      clientId: '',
      clientLibre: '',
      montant: '',
      dateArchive: new Date().toISOString().split('T')[0],
      observation: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')

    if (!formData.montant || (!formData.clientId && !formData.clientLibre)) {
      setErr('Veuillez renseigner le client et le montant.')
      return
    }

    try {
      const res = await fetch('/api/archives/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setForm(false)
        fetchList()
        showSuccess("Solde archivé avec succès.")
      } else {
        const d = await res.json()
        setErr(d.error || 'Erreur création')
      }
    } catch (e) {
      setErr('Erreur de connexion')
    }
  }

  const handleExport = (format: 'EXCEL' | 'PDF') => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const endpoint = format === 'EXCEL' ? 'export-excel' : 'export-pdf'
    window.location.href = `/api/archives/clients/${endpoint}?${params.toString()}`
  }

  const filteredData = list.filter(a => {
    const nom = (a.client?.nom || a.clientLibre || '').toLowerCase()
    return nom.includes(q.toLowerCase())
  })

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  return (
    <div className="space-y-6">
      {/* Reproduction exacte du Header de la page Clients/Tiers */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase italic">Soldes Clients <span className="text-orange-400 underline">ARCHIVES</span></h1>
          <p className="mt-1 text-white/90 italic">
            <strong>Copie UI :</strong> Cette page utilise textuellement l'affichage des Tiers pour lister les archives. Aucun impact comptable.
          </p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Archive de Solde
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Rechercher par nom de client..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleExport('EXCEL')}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('PDF')}
            className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {form && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Nouvelle archive de Solde</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Client Enregistré (Optionnel)</label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData((f) => ({ ...f, clientId: e.target.value, clientLibre: '' }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none bg-white"
              >
                <option value="">Aucun</option>
                {clientsDb.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ou Nom du Client (Libre)</label>
              <input
                type="text"
                value={formData.clientLibre}
                onChange={(e) => setFormData((f) => ({ ...f, clientLibre: e.target.value, clientId: '' }))}
                placeholder="Ex: Entreprise X..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
                disabled={!!formData.clientId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Montant (FCFA) *</label>
              <input
                required
                type="number"
                value={formData.montant}
                onChange={(e) => setFormData((f) => ({ ...f, montant: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Archive *</label>
              <input
                required
                type="date"
                value={formData.dateArchive}
                onChange={(e) => setFormData((f) => ({ ...f, dateArchive: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-sm font-medium text-gray-700">Observation</label>
              <input
                value={formData.observation}
                onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                placeholder="Note historique..."
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 sm:col-span-4">
              <button type="submit" className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 font-bold">
                Archiver le Solde
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
          {err && <p className="mt-2 text-sm text-red-600 font-bold">{err}</p>}
        </div>
      )}

      {/* Reproduction de l'affichage textuel Tiers/Clients */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-gray-500">Aucune archive de solde enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date Archive</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Client / Tiers</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type de Compte</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Opérateur</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Solde Global</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">
                      {new Date(a.dateArchive).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 border-l-2 border-transparent hover:border-orange-400">
                      {a.client?.nom || a.clientLibre}
                      {a.observation && <div className="text-[10px] text-gray-500 italic mt-0.5">{a.observation}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 tracking-widest uppercase">
                        Archive
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
                       <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs truncate max-w-[100px]">{a.utilisateur.nom}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black tabular-nums">
                        <span className="text-orange-600">{a.montant.toLocaleString('fr-FR')} F (Archive)</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                       <button
                         onClick={() => handleDelete(a)}
                         className="rounded p-1.5 text-red-600 hover:bg-red-50"
                         title="Supprimer l'archive"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  )
}
