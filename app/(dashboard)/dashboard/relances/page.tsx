'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Search, AlertTriangle, Clock, AlertCircle,
  ChevronDown, Mail, Phone, CheckCircle, XCircle,
  Send, User, FileText, Ban
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

type ClientRelance = {
  clientId: number
  nom: string
  telephone: string | null
  email: string | null
  solde: number
  plafondCredit: number
  tranche: string
  ageJours: number
  nbFactures: number
  derniereVenteDate: string | null
  derniereRelanceDate: string | null
  derniereRelanceStatut: string | null
  eligibleRelance: boolean
}

export default function RelancesPage() {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  const [clients, setClients] = useState<ClientRelance[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('TOUS')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const fetchRelances = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filtre })
      const res = await fetch('/api/relances?' + params.toString())
      if (!res.ok) throw new Error('Erreur chargement')
      const data = await res.json()
      setClients(data.clients || [])
      setStats(data.stats || null)
    } catch {
      showError('Erreur chargement des relances.')
    } finally {
      setLoading(false)
    }
  }, [filtre, showError])

  useEffect(() => { fetchRelances() }, [fetchRelances])

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.nom.toLowerCase().includes(q) || (c.telephone || '').includes(q)
  })

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(c => c.clientId)))
  }

  const envoyerRelances = async () => {
    if (selectedIds.size === 0) { showError('Sélectionnez au moins un client.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/relances/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIds: [...selectedIds],
          canal: 'EMAIL',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      showSuccess(`${data.succes}/${data.count} relance(s) envoyée(s).`)
      setSelectedIds(new Set())
      fetchRelances()
    } catch (e: any) {
      showError(e.message || 'Erreur envoi.')
    } finally {
      setSending(false)
    }
  }

  const trancheBadge = (t: string) => {
    if (t === '30J') return { label: '30 jours', color: 'bg-amber-500/30 text-amber-200' }
    if (t === '60J') return { label: '60 jours', color: 'bg-orange-500/30 text-orange-200' }
    if (t === '90J+') return { label: '90+ jours', color: 'bg-red-500/30 text-red-200' }
    return { label: t, color: 'bg-gray-500/30 text-gray-200' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <div className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-3 flex items-center gap-2 text-white font-bold text-lg">
            <Send className="h-6 w-6" />
            Relances Clients
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-white/20">
            <p className="text-sm text-white/70">Clients débiteurs</p>
            <p className="text-2xl font-bold mt-1 text-white">{stats?.total || 0}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-amber-300/40">
            <p className="text-sm text-white/70">Total dû</p>
            <p className="text-2xl font-bold mt-1 text-amber-200">{(stats?.totalDu || 0).toLocaleString('fr-FR')} F</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-orange-300/40">
            <p className="text-sm text-white/70">Prêts à relancer</p>
            <p className="text-2xl font-bold mt-1 text-orange-200">{stats?.eligible || 0}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-red-300/40">
            <p className="text-sm text-white/70">Dont 90j+</p>
            <p className="text-2xl font-bold mt-1 text-red-200">{stats?.parTranche?.['90J+'] || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div className="flex gap-2">
            {[{ v: 'TOUS', l: 'Tous' }, { v: '30J', l: '30 jours' }, { v: '60J', l: '60 jours' }, { v: '90J+', l: '90+ jours' }].map(f => (
              <button key={f.v} onClick={() => setFiltre(f.v)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${filtre === f.v ? 'bg-white text-blue-700' : 'bg-white/15 text-white/80 hover:bg-white/25'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* Send button */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-white/80">
            {selectedIds.size > 0
              ? `${selectedIds.size} client(s) sélectionné(s) — ${[...selectedIds].reduce((s, id) => {
                  const c = filtered.find(f => f.clientId === id)
                  return s + (c?.solde || 0)
                }, 0).toLocaleString('fr-FR')} F`
              : 'Cochez les clients à relancer'}
          </p>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())}
                className="rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium transition-colors"
              >
                <XCircle className="h-4 w-4 inline mr-1" /> Annuler
              </button>
            )}
            <button onClick={envoyerRelances} disabled={sending || selectedIds.size === 0}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-white/20 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold text-white transition-colors flex items-center gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {sending ? 'Envoi...' : `Envoyer la relance (Email)`}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/60">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Aucun client débiteur</p>
            <p className="text-sm mt-1">Tous les clients ont soldé leurs comptes.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-white/30" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Contact</th>
                    <th className="text-right px-4 py-3 font-medium">Solde</th>
                    <th className="text-center px-4 py-3 font-medium">Ancienneté</th>
                    <th className="text-center px-4 py-3 font-medium">Factures</th>
                    <th className="text-center px-4 py-3 font-medium">Dernière relance</th>
                    <th className="text-center px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map(c => {
                    const checked = selectedIds.has(c.clientId)
                    const badge = trancheBadge(c.tranche)
                    return (
                      <tr key={c.clientId}
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${checked ? 'bg-white/10' : ''}`}
                        onClick={() => toggleSelect(c.clientId)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelect(c.clientId)} className="rounded border-white/30" />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/clients/soldes/${c.clientId}`}
                            className="font-medium text-white hover:underline"
                          >
                            {c.nom}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {c.email && <span className="text-xs text-white/60">{c.email}</span>}
                            {c.telephone && <span className="text-xs text-white/50">{c.telephone}</span>}
                          </div>
                          {!c.email && !c.telephone && <span className="text-xs text-white/30 italic">Aucun</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-red-300">
                            {c.solde.toLocaleString('fr-FR')} F
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{c.nbFactures}</td>
                        <td className="px-4 py-3 text-center">
                          {c.derniereRelanceDate ? (
                            <span className="text-xs text-white/50">
                              {new Date(c.derniereRelanceDate).toLocaleDateString('fr-FR')}
                              <br />
                              <span className="text-[10px] uppercase">{c.derniereRelanceStatut}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-white/30 italic">Jamais</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.eligibleRelance ? (
                            <button onClick={e => { e.stopPropagation(); toggleSelect(c.clientId) }}
                              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded font-medium"
                            >
                              <Send className="h-3 w-3 inline mr-1" /> Relancer
                            </button>
                          ) : (
                            <span className="text-[10px] text-white/30">Déjà relancé</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
