'use client'

import { useState, useEffect } from 'react'
import { Book, Plus, Loader2, Pencil, Trash2, X, Search, Filter, Download, FileSpreadsheet, Printer } from 'lucide-react'
import ComptabiliteNav from '../ComptabiliteNav'
import { useToast } from '@/hooks/useToast'
import { journalSchema } from '@/lib/validations'
import { validateForm, formatApiError } from '@/lib/validation-helpers'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type Journal = {
  id: number
  code: string
  libelle: string
  type: string
  actif: boolean
}

const TYPES = ['ACHATS', 'VENTES', 'BANQUE', 'CAISSE', 'OD']

export default function JournauxPage() {
  const [journaux, setJournaux] = useState<Journal[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<Journal | null>(null)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [formData, setFormData] = useState({
    code: '',
    libelle: '',
    type: 'OD',
  })
  const [filtreType, setFiltreType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const fetchJournaux = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtreType) params.set('type', filtreType)
    
    fetch('/api/journaux?' + params.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then(setJournaux)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchJournaux()
  }, [filtreType])

  const resetForm = () => {
    setFormData({ code: '', libelle: '', type: 'OD' })
    setEditing(null)
    setForm(false)
    setErr('')
  }

  const openForm = (j?: Journal) => {
    if (j) {
      setEditing(j)
      setFormData({
        code: j.code,
        libelle: j.libelle,
        type: j.type,
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
    
    if (!formData.code.trim() || !formData.libelle.trim()) {
      setErr('Code et libellé requis.')
      return
    }

    try {
      const url = editing ? `/api/journaux/${editing.id}` : '/api/journaux'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.trim().toUpperCase(),
          libelle: formData.libelle.trim(),
          type: formData.type,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        resetForm()
        fetchJournaux()
      } else {
        setErr(data.error || 'Erreur')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Désactiver ce journal ? Cette action est irréversible.')) return
    try {
      const res = await fetch(`/api/journaux/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchJournaux()
        showSuccess('Journal désactivé avec succès.')
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
          <h1 className="text-3xl font-bold text-white">Journaux Comptables SYSCOHADA</h1>
          <p className="mt-1 text-white/90">Gestion des journaux comptables selon le système OHADA</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (filtreType) params.set('type', filtreType)
              window.open(`/api/journaux/export-excel?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100 no-print"
            title="Exporter en Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={() => setIsPreviewOpen(true)}
            disabled={isPrinting || journaux.length === 0}
            className="flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800 hover:bg-orange-100 shadow-md transition-all active:scale-95 disabled:opacity-50 no-print"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
            Aperçu Impression
          </button>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 no-print shadow-lg"
          >
            <Plus className="h-5 w-5" />
            Nouveau journal
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
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
      ) : journaux.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <Book className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">Aucun journal trouvé</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journaux.map((j) => (
                  <tr key={j.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{j.code}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{j.libelle}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        j.type === 'ACHATS' ? 'bg-blue-100 text-blue-800' :
                        j.type === 'VENTES' ? 'bg-green-100 text-green-800' :
                        j.type === 'BANQUE' ? 'bg-purple-100 text-purple-800' :
                        j.type === 'CAISSE' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {j.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openForm(j)}
                          className="rounded-lg p-1 text-blue-600 hover:bg-blue-50"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(j.id)}
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
                {editing ? 'Modifier le journal' : 'Nouveau journal'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Code du journal *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="ex: AC, VE, OD"
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
                  placeholder="Libellé du journal"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
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
      {/* MODALE D'APERÇU IMPRESSION JOURNAUX */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
            <div className="flex items-center gap-6">
               <div>
                 <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Répertoire Journaux</h2>
                 <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                   SYSCOHADA - LISTE DES JOURNAUX CONFIGURÉS {filtreType ? `TYPE: ${filtreType}` : ''}
                 </p>
               </div>
               <div className="h-10 w-px bg-gray-200" />
               <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                 {journaux.length} JOURNAUX
               </span>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"
              >
                <Printer className="h-4 w-4" />
                Lancer l'impression
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
            <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4">
                {chunkArray(journaux, ITEMS_PER_PRINT_PAGE).map((chunk: any[], index: number, allChunks: any[][]) => (
                  <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                    <ListPrintWrapper
                      title="RÉPERTOIRE DES JOURNAUX"
                      subtitle="Structure comptable des journaux auxiliaires"
                      pageNumber={index + 1}
                      totalPages={allChunks.length}
                      hideHeader={index > 0}
                      hideVisa={index < allChunks.length - 1}
                    >
                      <table className="w-full text-[14px] border-collapse border-2 border-black">
                        <thead>
                          <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                            <th className="border-r-2 border-black px-2 py-3 text-left">CODE</th>
                            <th className="border-r-2 border-black px-2 py-3 text-left">LIBELLÉ DU JOURNAL</th>
                            <th className="px-2 py-3 text-left">TYPE OHADA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((j: any, idx: number) => (
                            <tr key={idx} className="border-b border-black">
                              <td className="border-r-2 border-black px-2 py-2 font-mono font-bold text-[14px]">{j.code}</td>
                              <td className="border-r-2 border-black px-2 py-2 uppercase font-medium text-[13px]">{j.libelle}</td>
                              <td className="px-2 py-2">
                                <span className="text-[12px] font-black uppercase tracking-widest">{j.type}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                          <tfoot>
                            <tr className="bg-gray-100 font-black text-[15px] border-t-2 border-black uppercase italic">
                              <td colSpan={2} className="border-r-2 border-black px-3 py-4 text-right bg-white tracking-widest text-[11px]">NOMBRE TOTAL DE JOURNAUX</td>
                              <td className="px-3 py-4 text-left bg-white">{journaux.length}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </ListPrintWrapper>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Rendu masqué pour l'impression système direct */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {chunkArray(journaux, ITEMS_PER_PRINT_PAGE).map((chunk: any[], index: number, allChunks: any[][]) => (
          <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
            <ListPrintWrapper
              title="RÉPERTOIRE DES JOURNAUX"
              subtitle="Structure comptable des journaux auxiliaires"
              pageNumber={index + 1}
              totalPages={allChunks.length}
              hideHeader={index > 0}
              hideVisa={index < allChunks.length - 1}
            >
              <table className="w-full text-[14px] border-collapse border-2 border-black">
                <thead>
                  <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                    <th className="border-r-2 border-black px-2 py-3 text-left w-24">CODE</th>
                    <th className="border-r-2 border-black px-2 py-3 text-left">LIBELLÉ</th>
                    <th className="px-2 py-3 text-left">TYPE</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((j: any, idx: number) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r-2 border-black px-2 py-2 font-mono font-bold">{j.code}</td>
                      <td className="border-r-2 border-black px-2 py-2 uppercase font-medium">{j.libelle}</td>
                      <td className="px-2 py-2 uppercase font-black">{j.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ListPrintWrapper>
          </div>
        ))}
      </div>
    </div>
  )
}
