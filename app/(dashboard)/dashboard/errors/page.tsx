'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Search, X, ChevronDown, ChevronUp,
  AlertTriangle, Bug, Info, Clock, Trash2,
  Calendar, RefreshCw, Terminal, Code, FileWarning,
  Globe, ShieldAlert, Filter,
  AlertCircle, AlertOctagon, Check,
} from 'lucide-react'

type ErrorEntry = {
  timestamp: string
  source: string
  component?: string
  message: string
  stack?: string
  context?: Record<string, unknown>
  userAction?: string
  level: 'error' | 'warning' | 'info'
  url?: string
  digest?: string
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; icon: React.ElementType }> = {
  error:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200',   dot: 'bg-red-500',   icon: AlertOctagon },
  warning: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500', icon: AlertTriangle },
  info:    { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200',    dot: 'bg-sky-500',   icon: Info },
}

const SOURCE_COLORS: Record<string, string> = {
  frontend: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  app:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  'error.tsx': 'bg-violet-100 text-violet-700 border-violet-200',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Il y a ${days}j`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)
  const pageSize = 15

  const fetchErrors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/errors/list?limit=200')
      if (res.ok) {
        const data = await res.json()
        setErrors(Array.isArray(data) ? data.reverse() : [])
      } else if (res.status === 403) {
        setErrors([])
      }
    } catch {
      setErrors([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchErrors() }, [fetchErrors])

  const filtered = errors.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const msg = (e.message || '').toLowerCase()
      const comp = (e.component || '').toLowerCase()
      const ctx = e.context ? JSON.stringify(e.context).toLowerCase() : ''
      if (!msg.includes(q) && !comp.includes(q) && !ctx.includes(q)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const stats = {
    total: errors.length,
    errors: errors.filter(e => e.level === 'error').length,
    warnings: errors.filter(e => e.level === 'warning').length,
    infos: errors.filter(e => e.level === 'info').length,
    today: errors.filter(e => {
      const d = new Date(e.timestamp)
      const today = new Date()
      return d.toDateString() === today.toDateString()
    }).length,
  }

  const sources = ['all', ...new Set(errors.map(e => e.source))]

  const toggleExpand = (idx: number) => {
    const next = new Set(expanded)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    setExpanded(next)
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await fetch('/api/errors/list', { method: 'DELETE' })
      setErrors([])
      setShowClearConfirm(false)
    } catch {} finally { setClearing(false) }
  }

  const handleDeleteOne = async (idx: number) => {
    setDeletingIdx(idx)
    await new Promise(r => setTimeout(r, 300))
    const remaining = errors.filter((_, i) => i !== idx)
    setErrors(remaining)
    setDeletingIdx(null)
  }

  const activeFilters = (levelFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0) + (search ? 1 : 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            <Bug className="absolute inset-0 m-auto h-6 w-6 text-orange-500 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-gray-500 animate-pulse">Chargement des erreurs…</p>
        </div>
      </div>
    )
  }

  if (errors.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 p-8 sm:p-12 shadow-xl shadow-emerald-500/20">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-teal-300/20 rounded-full blur-3xl" />
          <div className="relative flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <ShieldAlert className="h-12 w-12 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Aucune erreur</h2>
              <p className="text-emerald-100 text-center max-w-md text-base">
                Votre application fonctionne parfaitement. Aucune erreur n&apos;a été enregistrée.
              </p>
            </div>
            <div className="flex gap-2 mt-2">
              {['error', 'warning', 'info'].map(l => {
                const s = LEVEL_STYLES[l]
                const Icon = s.icon
                return (
                  <div key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/10`}>
                    <Icon className="h-3.5 w-3.5" />
                    {l === 'error' ? '0 Erreurs' : l === 'warning' ? '0 Avertissements' : '0 Infos'}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          {['error', 'warning', 'info'].map(l => {
            const s = LEVEL_STYLES[l]
            const Icon = s.icon
            return (
              <div key={l} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.bg} ${s.text} border ${s.border}`}>
                <Icon className="h-3.5 w-3.5" />
                {l === 'error' ? '0 Erreurs' : l === 'warning' ? '0 Avertissements' : '0 Infos'}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 sm:p-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
        </div>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Bug className="h-7 w-7 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                Moniteur d&apos;Erreurs
              </h1>
              <p className="text-sm text-white/60 mt-0.5">
                {stats.total} événement{stats.total > 1 ? 's' : ''} enregistré{stats.total > 1 ? 's' : ''}
                {stats.today > 0 && <span className="text-orange-400 font-medium"> · {stats.today} aujourd&apos;hui</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowFilters(!showFilters); setPage(1) }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                showFilters || activeFilters > 0
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFilters > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs font-bold">{activeFilters}</span>
              )}
            </button>
            <button
              onClick={fetchErrors}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/70 bg-white/10 hover:bg-white/20 transition-all duration-200 border border-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
            {errors.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-all duration-200 border border-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Tout effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Total', value: stats.total, icon: Bug, color: 'from-slate-500 to-slate-600', textColor: 'text-slate-100', bgGlow: 'bg-slate-400/10' },
            { label: 'Erreurs', value: stats.errors, icon: AlertOctagon, color: 'from-red-500 to-rose-600', textColor: 'text-red-100', bgGlow: 'bg-red-400/10' },
            { label: 'Avertissements', value: stats.warnings, icon: AlertTriangle, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-100', bgGlow: 'bg-amber-400/10' },
            { label: 'Aujourd\'hui', value: stats.today, icon: Clock, color: 'from-cyan-500 to-teal-600', textColor: 'text-cyan-100', bgGlow: 'bg-cyan-400/10' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="relative group">
                <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className={`relative rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 group-hover:border-white/20 transition-all duration-300`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider">{stat.label}</p>
                    <Icon className={`h-4 w-4 ${stat.textColor} opacity-60`} />
                  </div>
                  <p className={`text-2xl sm:text-3xl font-black mt-1.5 ${stat.textColor} tabular-nums`}>
                    {stat.value}
                  </p>
                  <div className={`absolute bottom-0 right-0 w-24 h-24 rounded-full ${stat.bgGlow} blur-2xl -mr-8 -mb-8 pointer-events-none`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="rounded-2xl bg-white border border-gray-200 shadow-lg shadow-gray-200/50 p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <Search className="inline h-3 w-3 mr-1" />
                Recherche
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Message, composant, contexte…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 outline-none transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <AlertCircle className="inline h-3 w-3 mr-1" />
                Niveau
              </label>
              <div className="flex gap-1.5">
                {['all', 'error', 'warning', 'info'].map(l => {
                  const isActive = levelFilter === l
                  const style = l !== 'all' ? LEVEL_STYLES[l] : null
                  return (
                    <button
                      key={l}
                      onClick={() => { setLevelFilter(l); setPage(1) }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                        isActive
                          ? l === 'all'
                            ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                            : `${style?.bg} ${style?.text} ${style?.border} ring-2 ring-offset-1 ${(style?.border || '').replace('border', 'ring')}`
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {l === 'all' ? 'Tous' : l === 'error' ? 'Erreurs' : l === 'warning' ? 'Avert.' : 'Infos'}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <Globe className="inline h-3 w-3 mr-1" />
                Source
              </label>
              <div className="flex gap-1.5">
                {sources.map(s => {
                  const isActive = sourceFilter === s
                  const color = s !== 'all' ? (SOURCE_COLORS[s] || 'bg-gray-100 text-gray-700 border-gray-200') : ''
                  return (
                    <button
                      key={s}
                      onClick={() => { setSourceFilter(s); setPage(1) }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border capitalize ${
                        isActive
                          ? s === 'all'
                            ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                            : `${color} ring-2 ring-offset-1 ring-${color.split(' ')[1] || 'gray-300'}`
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {s === 'all' ? 'Toutes' : s}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filtered.length > 0 ? (
            <>
              <span className="font-semibold text-gray-700">{filtered.length}</span> résultat{filtered.length > 1 ? 's' : ''}
              {filtered.length !== errors.length && (
                <span className="text-gray-400"> sur {errors.length}</span>
              )}
            </>
          ) : (
            'Aucun résultat'
          )}
        </p>
        {filtered.length > pageSize && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <span className="font-medium text-gray-700 min-w-[5rem] text-center tabular-nums">
              Page {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Errors Table */}
      <div className="space-y-2">
        {paged.map((entry, idx) => {
          const globalIdx = errors.indexOf(entry)
          const isExpanded = expanded.has(globalIdx)
          const levelStyle = LEVEL_STYLES[entry.level] || LEVEL_STYLES.error
          const LevelIcon = levelStyle.icon
          const sourceColor = SOURCE_COLORS[entry.source] || 'bg-gray-100 text-gray-700 border-gray-200'
          const isDeleting = deletingIdx === globalIdx

          return (
            <div
              key={globalIdx}
              className={`group rounded-xl border transition-all duration-200 ${
                isExpanded
                  ? `${levelStyle.border} shadow-md`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              } bg-white ${isDeleting ? 'animate-pulse opacity-30 scale-95' : ''}`}
            >
              {/* Row header - clickable */}
              <button
                onClick={() => toggleExpand(globalIdx)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                {/* Level indicator */}
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${levelStyle.bg} ${levelStyle.text} border ${levelStyle.border}`}>
                  <LevelIcon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${levelStyle.bg} ${levelStyle.text} border ${levelStyle.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${levelStyle.dot}`} />
                      {entry.level === 'error' ? 'Erreur' : entry.level === 'warning' ? 'Avertissement' : 'Info'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${sourceColor}`}>
                      <Code className="h-3 w-3 mr-1" />
                      {entry.source}
                    </span>
                    {entry.component && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Terminal className="h-3 w-3" />
                        {entry.component}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto hidden sm:inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 leading-snug break-words line-clamp-2">
                    {entry.message || 'Message non disponible'}
                  </p>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteOne(globalIdx) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3 animate-in slide-in-from-top-1 duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Horodatage</p>
                      <p className="text-gray-800 font-medium">{new Date(entry.timestamp).toLocaleString('fr-FR')}</p>
                    </div>
                    {entry.url && (
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">URL</p>
                        <p className="text-gray-800 font-medium truncate" title={entry.url}>{entry.url}</p>
                      </div>
                    )}
                    {entry.userAction && (
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Action utilisateur</p>
                        <p className="text-gray-800 font-medium">{entry.userAction}</p>
                      </div>
                    )}
                    {entry.digest && (
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Digest</p>
                        <p className="text-gray-800 font-mono text-xs">{entry.digest}</p>
                      </div>
                    )}
                  </div>

                  {entry.stack && (
                    <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700">
                        <Terminal className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Stack Trace</span>
                        <button
                          onClick={() => {
                            if (entry.stack) {
                              navigator.clipboard.writeText(entry.stack).catch(() => {})
                            }
                          }}
                          className="ml-auto px-2 py-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700 text-xs transition-colors"
                        >
                          Copier
                        </button>
                      </div>
                      <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto scrollbar-thin">
                        {entry.stack}
                      </pre>
                    </div>
                  )}

                  {entry.context && Object.keys(entry.context).length > 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-100/50 border-b border-amber-200">
                        <FileWarning className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Contexte</span>
                      </div>
                      <pre className="p-4 text-xs text-amber-900 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {JSON.stringify(entry.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Time badge */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {timeAgo(entry.timestamp)}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            ← Précédent
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum: number | string
            if (totalPages <= 7) {
              pageNum = i + 1
            } else if (page <= 4) {
              pageNum = i + 1
              if (i === 6) pageNum = totalPages
              if (i === 5 && totalPages > 7) pageNum = '…'
            } else if (page >= totalPages - 3) {
              pageNum = totalPages - 6 + i
              if (i === 0) pageNum = 1
              if (i === 1 && totalPages > 7) pageNum = '…'
            } else {
              if (i === 0) pageNum = 1
              else if (i === 1) pageNum = '…'
              else if (i === 5) pageNum = '…'
              else if (i === 6) pageNum = totalPages
              else pageNum = page + (i - 2)
            }
            if (typeof pageNum === 'string') {
              return <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                  page === pageNum
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-30 hover:bg-gray-50 transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 border border-red-200">
                <AlertOctagon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Effacer toutes les erreurs</h3>
                <p className="text-sm text-gray-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Vous êtes sur le point de supprimer les <strong className="text-gray-900">{errors.length}</strong> événement{errors.length > 1 ? 's' : ''} du journal. Les erreurs futures continueront d&apos;être enregistrées.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-50 transition-all shadow-lg shadow-red-500/30 flex items-center gap-2"
              >
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {clearing ? 'Suppression…' : 'Tout effacer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

