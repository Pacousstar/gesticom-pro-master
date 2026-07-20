'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Download, MessageSquare, Phone, Mail, Filter, CheckCircle, Clock, Upload, AlertCircle } from 'lucide-react'

interface Lead {
  id: number
  nom: string
  email: string | null
  contact: string | null
  domaine: string | null
  message: string | null
  source: string
  statut: string
  notes: string | null
  relance: boolean
  relanceAt: string | null
  createdAt: string
}

const STATUTS = ['NOUVEAU', 'CONTACTE', 'REPONDU', 'CONVERTI', 'ARCHIVE'] as const
const SOURCES = ['preinscription', 'contact']

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreSource, setFiltreSource] = useState('')

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtreStatut) params.set('statut', filtreStatut)
      if (filtreSource) params.set('source', filtreSource)
      const res = await fetch(`/api/leads?${params}`)
      if (res.ok) setLeads(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeads() }, [filtreStatut, filtreSource])

  const updateStatut = async (id: number, statut: string) => {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    fetchLeads()
  }

  const exportCSV = () => {
    const csv = [
      ['Nom', 'Email', 'Contact', 'Domaine', 'Source', 'Statut', 'Message', 'Date'].join(','),
      ...leads.map(l => [
        `"${l.nom}"`,
        l.email || '',
        l.contact || '',
        l.domaine || '',
        l.source,
        l.statut,
        `"${(l.message || '').replace(/"/g, '""')}"`,
        new Date(l.createdAt).toLocaleDateString('fr-FR'),
      ].join(','))
    ].join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Leads_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = leads.filter(l =>
    !search || l.nom.toLowerCase().includes(search.toLowerCase()) ||
    (l.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (l.contact || '').includes(search) ||
    (l.domaine?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const badgeStatut = (s: string) => {
    const colors: Record<string, string> = {
      NOUVEAU: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      CONTACTE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      REPONDU: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      CONVERTI: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      ARCHIVE: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    }
    return colors[s] || 'bg-gray-500/20 text-gray-300'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Leads</h1>
            <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Prospects et inscriptions</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              setImporting(true); setImportMsg(null)
              try {
                const res = await fetch('/api/leads/import-formspree', { method: 'POST' })
                const d = await res.json()
                if (res.ok) {
                  setImportMsg({ type: 'ok', text: `${d.imported} importé(s), ${d.skipped} ignoré(s) sur ${d.total}` })
                  fetchLeads()
                } else {
                  setImportMsg({ type: 'error', text: d.error || 'Erreur' })
                }
              } catch { setImportMsg({ type: 'error', text: 'Erreur réseau' }) }
              finally { setImporting(false) }
            }} disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 px-4 py-2 text-sm font-medium text-white border border-indigo-500/30 transition-all disabled:opacity-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importer Formspree
            </button>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>
        </div>

        {importMsg && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            importMsg.type === 'ok'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/20 text-red-300'
          }`}>
            {importMsg.type === 'ok' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{importMsg.text}</span>
            <button onClick={() => setImportMsg(null)} className="ml-auto text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Nouveaux', count: leads.filter(l => l.statut === 'NOUVEAU').length, color: 'text-blue-400' },
            { label: 'Contactés', count: leads.filter(l => l.statut === 'CONTACTE').length, color: 'text-yellow-400' },
            { label: 'Répondu', count: leads.filter(l => l.statut === 'REPONDU').length, color: 'text-purple-400' },
            { label: 'Converti', count: leads.filter(l => l.statut === 'CONVERTI').length, color: 'text-emerald-400' },
            { label: 'Total', count: leads.length, color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, contact, domaine..."
              className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500" />
          </div>
          <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
            <option value="" className="bg-gray-800">Tous les statuts</option>
            {STATUTS.map(s => (
              <option key={s} value={s} className="bg-gray-800">{s}</option>
            ))}
          </select>
          <select value={filtreSource} onChange={e => setFiltreSource(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white">
            <option value="" className="bg-gray-800">Toutes les sources</option>
            {SOURCES.map(s => (
              <option key={s} value={s} className="bg-gray-800">{s === 'preinscription' ? 'Pré-inscription' : 'Contact'}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-gray-400">
            Aucun lead trouvé.
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold">Domaine</th>
                  <th className="text-center px-4 py-3 font-semibold">Source</th>
                  <th className="text-center px-4 py-3 font-semibold">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold">Date</th>
                  <th className="text-center px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(lead => (
                  <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-semibold">{lead.nom}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="text-gray-300 hover:text-orange-400 flex items-center gap-1.5 text-xs">
                            <Mail className="h-3 w-3" /> {lead.email}
                          </a>
                        )}
                        {lead.contact && (
                          <a href={`tel:${lead.contact}`} className="text-gray-300 hover:text-orange-400 flex items-center gap-1.5 text-xs">
                            <Phone className="h-3 w-3" /> {lead.contact}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.domaine && (
                        <span className="text-xs bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/10">
                          {lead.domaine}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-400">{lead.source === 'preinscription' ? '📝 Pré-inscription' : '💬 Contact'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select value={lead.statut} onChange={e => updateStatut(lead.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border font-bold cursor-pointer ${badgeStatut(lead.statut)}`}>
                        {STATUTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-xs">
                      {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {lead.email && (
                          <a href={`mailto:${lead.email}?subject=Suite%20de%20votre%20demande%20GestiCom%20Pro`}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            title="Envoyer un email">
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        )}
                        {lead.contact && (
                          <a href={`https://wa.me/${lead.contact.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 transition-all"
                            title="Contacter via WhatsApp">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
