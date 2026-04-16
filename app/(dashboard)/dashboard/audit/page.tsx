'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search, Filter, Download, Calendar, User, Activity, FileSpreadsheet, FileText, X, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

type AuditLog = {
  id: number
  date: string
  utilisateur: {
    id: number
    login: string
    nom: string
    role: string
  }
  action: string
  type: string
  entiteId: number | null
  description: string
  details: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [utilisateurs, setUtilisateurs] = useState<Array<{ id: number; nom: string; login: string }>>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [showFilters, setShowFilters] = useState(true)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    utilisateurId: '',
    action: '',
    type: '',
    dateFrom: '',
    dateTo: '',
  })
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')
  const [allLogsForPrint, setAllLogsForPrint] = useState<AuditLog[]>([])
  const [isPrintingFull, setIsPrintingFull] = useState(false)
  const [entreprise, setEntreprise] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })
      if (filters.utilisateurId) params.set('utilisateurId', filters.utilisateurId)
      if (filters.action) params.set('action', filters.action)
      if (filters.type) params.set('type', filters.type)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (searchTerm) params.set('search', searchTerm)

      const res = await fetch(`/api/audit?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotalLogs(data.pagination.total)
      }
    } catch (e) {
      console.error('Erreur chargement logs:', e)
    } finally {
      setLoading(false)
    }
  }

  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const resetFilters = () => {
    setFilters({
      utilisateurId: '',
      action: '',
      type: '',
      dateFrom: '',
      dateTo: '',
    })
    setSearchTerm('')
    setPage(1)
  }

  useEffect(() => {
    // Charger la liste des utilisateurs
    fetch('/api/utilisateurs')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setUtilisateurs(data.map((u: any) => ({ id: u.id, nom: u.nom, login: u.login })))
        } else if (data.data && Array.isArray(data.data)) {
          setUtilisateurs(data.data.map((u: any) => ({ id: u.id, nom: u.nom, login: u.login })))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/parametres').then(r => r.ok && r.json()).then(setEntreprise).catch(() => {})
    setPage(1) // Réinitialiser à la page 1 quand les filtres changent
    loadLogs()
  }, [filters, searchTerm])

  useEffect(() => {
    loadLogs()
  }, [page, pageSize])

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CONNEXION':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'DECONNEXION':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'CREATION':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'MODIFICATION':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'SUPPRESSION':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const handlePrint = async () => {
    setIsPrintingFull(true)
    try {
      const params = new URLSearchParams()
      if (filters.utilisateurId) params.set('utilisateurId', filters.utilisateurId)
      if (filters.action) params.set('action', filters.action)
      if (filters.type) params.set('type', filters.type)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (searchTerm) params.set('search', searchTerm)
      params.set('limit', '10000')

      const res = await fetch(`/api/audit?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAllLogsForPrint(data.logs || [])
        setIsPreviewOpen(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsPrintingFull(false)
    }
  }
  const handleRestore = async (logId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir restaurer cet enregistrement ? Cela ré-incrémentera les stocks et recréera les écritures comptables.')) {
      return
    }

    try {
      const res = await fetch('/api/audit/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId })
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Restauration réussie !')
        loadLogs()
      } else {
        alert(data.error || 'Erreur lors de la restauration.')
      }
    } catch (e) {
      console.error('Restore error:', e)
      alert('Une erreur critique est survenue.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Journal d'audit {(filters.utilisateurId || filters.action || filters.type || filters.dateFrom || filters.dateTo || searchTerm) && <span className="ml-1" title="Filtre actif">⚠️</span>}</h1>
          <p className="text-white/80 mt-1 text-[10px] font-bold uppercase tracking-widest opacity-80 italic">Traçabilité des actions des utilisateurs</p>
          {totalLogs > 0 && (
            <p className="text-white/60 mt-1 text-[9px] font-black uppercase tracking-tighter">
              {totalLogs} TRANSACTION{totalLogs > 1 ? 'S' : ''} RÉPERTORIÉE{totalLogs > 1 ? 'S' : ''} SUR LA SÉLECTION
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (filters.utilisateurId) params.set('utilisateurId', filters.utilisateurId)
              if (filters.action) params.set('action', filters.action)
              if (filters.type) params.set('type', filters.type)
              if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
              if (filters.dateTo) params.set('dateTo', filters.dateTo)
              if (searchTerm) params.set('search', searchTerm)
              window.open(`/api/audit/export-excel?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
            title="Exporter en Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (filters.utilisateurId) params.set('utilisateurId', filters.utilisateurId)
              if (filters.action) params.set('action', filters.action)
              if (filters.type) params.set('type', filters.type)
              if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
              if (filters.dateTo) params.set('dateTo', filters.dateTo)
              if (searchTerm) params.set('search', searchTerm)
              window.open(`/api/audit/export-pdf?${params.toString()}`, '_blank')
            }}
            className="flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            title="Exporter en PDF"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
                <div className="hidden print:block absolute inset-0 bg-white">
                    {chunkArray(allLogsForPrint.length > 0 ? allLogsForPrint : logs, ITEMS_PER_PRINT_PAGE).map((chunk: AuditLog[], index: number, allChunks: AuditLog[][]) => (
                        <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                            <ListPrintWrapper
                                title="Journal d'Audit Transféré"
                                subtitle="Traçabilité des actions utilisateurs"
                                pageNumber={index + 1}
                                totalPages={allChunks.length}
                                hideHeader={index > 0}
                                hideVisa={index < allChunks.length - 1}
                                layout={printLayout}
                                enterprise={entreprise}
                            >
                                <table className="w-full text-[14px] border-collapse border-2 border-black">
                                    <thead>
                                        <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Horodatage</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Opérateur</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Action</th>
                                            <th className="border-r-2 border-black px-3 py-3 text-left">Module</th>
                                            <th className="px-3 py-3 text-left">Détails de l'évènement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((log: AuditLog, idx: number) => (
                                            <tr key={idx} className="border-b border-black">
                                                <td className="border-r-2 border-black px-3 py-2 whitespace-nowrap font-mono text-xs">{formatDate(log.date)}</td>
                                                <td className="border-r-2 border-black px-3 py-2 font-black">{log.utilisateur.nom}</td>
                                                <td className="border-r-2 border-black px-3 py-2 underline">{log.action}</td>
                                                <td className="border-r-2 border-black px-3 py-2">{log.type}</td>
                                                <td className="px-3 py-2 italic lowercase font-medium text-[12px]">{log.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {index === allChunks.length - 1 && (
                                        <tfoot>
                                            <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right bg-white shadow-inner">Total Transactions Audités</td>
                                                <td colSpan={2} className="px-3 py-4 bg-white text-blue-900 underline decoration-double">{totalLogs} évènements capturés</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </ListPrintWrapper>
                        </div>
                    ))}
                </div>

                {/* MODALE D'APERÇU IMPRESSION JOURNAL AUDIT */}
                {isPreviewOpen && (
                  <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
                    <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                        <div className="flex items-center gap-6">
                           <div>
                             <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal d'Audit</h2>
                             <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                               Contrôle de l'Intégrité et de la Traçabilité
                             </p>
                           </div>
                           <div className="h-10 w-px bg-gray-200" />
                           <div className="flex items-center gap-2">
                             <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black text-orange-600 uppercase">
                               {totalLogs} Évènements
                             </span>
                             <div className="h-10 w-px bg-gray-200" />
                             <div className="flex items-center gap-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase">Orientation :</label>
                               <select 
                                 value={printLayout}
                                 onChange={(e) => setPrintLayout(e.target.value as any)}
                                 className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-orange-500"
                               >
                                 <option value="portrait">Portrait</option>
                                 <option value="landscape">Paysage</option>
                               </select>
                             </div>
                           </div>
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
                        <div className={`mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} min-h-screen p-4 text-slate-900 not-italic tracking-normal`}>
                            {chunkArray(allLogsForPrint.length > 0 ? allLogsForPrint : logs, ITEMS_PER_PRINT_PAGE).map((chunk: AuditLog[], index: number, allChunks: AuditLog[][]) => (
                                <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                                    <ListPrintWrapper
                                        title="JOURNAL D'AUDIT SYSTÈME"
                                        subtitle={`Rapport de traçabilité consolidé - ${allLogsForPrint.length || totalLogs} entrées`}
                                        pageNumber={index + 1}
                                        totalPages={allChunks.length}
                                        hideHeader={index > 0}
                                        hideVisa={index < allChunks.length - 1}
                                        layout={printLayout}
                                        enterprise={entreprise}
                                    >
                                        <table className="w-full text-[14px] border-collapse border-2 border-black">
                                            <thead>
                                                <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Horodatage</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Opérateur</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left tabular-nums">Action</th>
                                                    <th className="border-r-2 border-black px-3 py-3 text-left">Type</th>
                                                    <th className="px-3 py-3 text-left">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chunk.map((log: AuditLog, idx: number) => (
                                                    <tr key={idx} className="border-b border-black text-[13px]">
                                                        <td className="border-r-2 border-black px-3 py-2 font-mono whitespace-nowrap text-xs">{formatDate(log.date)}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{log.utilisateur.nom}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 font-black">{log.action}</td>
                                                        <td className="border-r-2 border-black px-3 py-2 italic">{log.type}</td>
                                                        <td className="px-3 py-2 font-medium leading-tight">{log.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            {index === allChunks.length - 1 && (
                                                <tfoot>
                                                    <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                        <td colSpan={3} className="border-r-2 border-black px-3 py-4 text-right bg-white shadow-inner italic">VOLUME LOGS AUDITÉS</td>
                                                        <td colSpan={2} className="px-3 py-4 bg-white text-blue-900 underline underline-offset-4 decoration-double">{totalLogs} TRANSACTION(S)</td>
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
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={isPrintingFull}
              className="flex items-center gap-2 rounded-lg border-2 border-slate-800 bg-slate-100 px-4 py-2 text-sm font-black text-slate-900 hover:bg-slate-200 shadow-xl no-print uppercase transition-all active:scale-95"
              title="Aperçu avant impression"
            >
              {isPrintingFull ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              IMPRIMER
            </button>
            <button
              onClick={() => {
                const params = new URLSearchParams()
                if (filters.utilisateurId) params.set('utilisateurId', filters.utilisateurId)
                if (filters.action) params.set('action', filters.action)
                if (filters.type) params.set('type', filters.type)
                if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
                if (filters.dateTo) params.set('dateTo', filters.dateTo)
                if (searchTerm) params.set('search', searchTerm)
                window.open(`/api/audit/export-excel?${params.toString()}`, '_blank')
              }}
              className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 shadow-lg no-print uppercase transition-all active:scale-95"
              title="Exporter le journal d'audit en Excel"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              EXCEL
            </button>
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-white" />
              <h2 className="font-semibold text-white text-lg">Filtres et Recherche</h2>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-white hover:text-white/80 transition-colors"
            >
              {showFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="p-6 space-y-4">
            {/* Recherche textuelle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recherche dans les descriptions</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher dans les descriptions..."
                  className="w-full rounded-lg border-2 border-gray-300 pl-10 pr-3 py-2.5 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Utilisateur</label>
                <select
                  value={filters.utilisateurId}
                  onChange={(e) => setFilters({ ...filters, utilisateurId: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all hover:border-indigo-400"
                >
                  <option value="">Tous</option>
                  {utilisateurs.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nom} ({u.login})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <select
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all hover:border-indigo-400"
                >
                  <option value="">Toutes</option>
                  <option value="CONNEXION">Connexion</option>
                  <option value="DECONNEXION">Déconnexion</option>
                  <option value="CREATION">Création</option>
                  <option value="MODIFICATION">Modification</option>
                  <option value="SUPPRESSION">Suppression</option>
                  <option value="EXPORT">Export</option>
                  <option value="IMPORT">Import</option>
                  <option value="VALIDATION">Validation</option>
                  <option value="ANNULATION">Annulation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all hover:border-purple-400"
                >
                  <option value="">Tous</option>
                  <option value="UTILISATEUR">Utilisateur</option>
                  <option value="PRODUIT">Produit</option>
                  <option value="STOCK">Stock</option>
                  <option value="VENTE">Vente</option>
                  <option value="ACHAT">Achat</option>
                  <option value="DEPENSE">Dépense</option>
                  <option value="CHARGE">Charge</option>
                  <option value="CLIENT">Client</option>
                  <option value="FOURNISSEUR">Fournisseur</option>
                  <option value="MAGASIN">Magasin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all hover:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all hover:border-purple-400"
                />
              </div>
            </div>
            {(filters.utilisateurId || filters.action || filters.type || filters.dateFrom || filters.dateTo || searchTerm) && (
              <div className="flex justify-end">
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-2 rounded-lg border-2 border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liste des logs */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Aucun log trouvé</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Utilisateur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(log.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                            <User className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{log.utilisateur.nom}</div>
                            <div className="text-xs text-gray-500">{log.utilisateur.login} ({log.utilisateur.role})</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                        <div className="flex items-center justify-between">
                          <span>{log.description}</span>
                          {log.details && (
                            <button
                              onClick={() => toggleLogExpansion(log.id)}
                              className="ml-2 text-orange-600 hover:text-orange-700"
                              title="Voir les détails"
                            >
                              {expandedLogs.has(log.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                        {expandedLogs.has(log.id) && log.details && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                            {log.action === 'SUPPRESSION' && log.type === 'VENTE' && log.details?.numero && (
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => handleRestore(log.id)}
                                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 shadow-lg uppercase italic tracking-tighter transition-all active:scale-95"
                                >
                                  <Activity className="h-4 w-4" />
                                  Restaurer la facture {log.details.numero}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        <div>{log.ipAddress || '-'}</div>
                        {log.userAgent && (
                          <div className="text-xs text-gray-400 mt-1 truncate max-w-xs" title={log.userAgent}>
                            {log.userAgent.length > 30 ? log.userAgent.substring(0, 30) + '...' : log.userAgent}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(totalPages > 1 || totalLogs > 0) && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    {totalLogs} log{totalLogs !== 1 ? 's' : ''} — Page {page} sur {Math.max(1, totalPages)}
                  </span>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Afficher
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setPage(1)
                      }}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 bg-white text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    par page
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Première
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Précédent
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number
                      if (totalPages <= 5) p = i + 1
                      else if (page <= 3) p = i + 1
                      else if (page >= totalPages - 2) p = totalPages - 4 + i
                      else p = page - 2 + i
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`min-w-[2.25rem] px-2 py-2 rounded-lg border text-sm transition-colors ${
                            page === p
                              ? 'border-indigo-500 bg-indigo-500 text-white'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Suivant
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    Dernière
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
