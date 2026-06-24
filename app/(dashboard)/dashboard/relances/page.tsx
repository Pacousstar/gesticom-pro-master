'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Search, ChevronDown, Mail, CheckCircle, XCircle,
  Send
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
  const [rlPage, setRlPage] = useState(1)
  const rlPerPage = 10

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
  useEffect(() => { setRlPage(1) }, [search, filtre])

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

  const [sendingOne, setSendingOne] = useState<number | null>(null)

  const relancerClient = async (clientId: number) => {
    setSendingOne(clientId)
    try {
      const res = await fetch(`/api/clients/${clientId}/relance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: 'EMAIL' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      showSuccess(`Relance envoyée à ${data.client}.`)
      fetchRelances()
    } catch (e: any) {
      showError(e.message || 'Erreur envoi.')
    } finally {
      setSendingOne(null)
    }
  }

  const trancheLabel = (t: string) => {
    if (t === '30J') return '30 jours'
    if (t === '60J') return '60 jours'
    if (t === '90J+') return '90+ jours'
    return t
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Relances Clients</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Gestion des relances et impayés</p>
        </div>
        <button onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20">
          <ChevronDown className="h-4 w-4 rotate-90" /> Retour
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 no-print">
        {[
          { label: "Clients débiteurs", val: (stats?.total || 0).toString(), color: "bg-indigo-600" },
          { label: "Total dû", val: `${(stats?.totalDu || 0).toLocaleString('fr-FR')} F`, color: "bg-amber-600" },
          { label: "Prêts à relancer", val: (stats?.eligible || 0).toString(), color: "bg-blue-600" },
          { label: "Dont 90j+", val: (stats?.parTranche?.['90J+'] || 0).toString(), color: "bg-rose-600" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl ${c.color} p-5 shadow-xl group`}>
            <div className="relative z-10 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
              <p className="text-2xl font-black tracking-tighter mt-1">{c.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {[{ v: 'TOUS', l: 'Tous' }, { v: '30J', l: '30 jours' }, { v: '60J', l: '60 jours' }, { v: '90J+', l: '90+ jours' }].map(f => (
            <button key={f.v} onClick={() => setFiltre(f.v)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                filtre === f.v ? 'bg-orange-500 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Send bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <p className="text-sm text-gray-700 dark:text-gray-300">
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
              className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
            >
              <XCircle className="h-4 w-4 inline mr-1" /> Annuler
            </button>
          )}
          <button onClick={envoyerRelances} disabled={sending || selectedIds.size === 0}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold text-white transition-all shadow-sm flex items-center gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sending ? 'Envoi...' : `Envoyer la relance (Email)`}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Aucun client débiteur</p>
          <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">Tous les clients ont soldé leurs comptes.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold w-10">
                    <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll} className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold">Contact</th>
                  <th className="text-right px-4 py-3 font-semibold">Solde</th>
                  <th className="text-center px-4 py-3 font-semibold">Ancienneté</th>
                  <th className="text-center px-4 py-3 font-semibold">Factures</th>
                  <th className="text-center px-4 py-3 font-semibold">Dernière relance</th>
                  <th className="text-center px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.slice((rlPage - 1) * rlPerPage, rlPage * rlPerPage).map(c => {
                  const checked = selectedIds.has(c.clientId)
                  const label = trancheLabel(c.tranche)
                  return (
                    <tr key={c.clientId}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${checked ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`}
                      onClick={() => toggleSelect(c.clientId)}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={checked}
                          onChange={() => toggleSelect(c.clientId)} className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clients/soldes/${c.clientId}`}
                          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-400 hover:underline"
                        >
                          {c.nom}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {c.email && c.email !== 'null' && <span className="text-xs text-gray-800 dark:text-gray-200">{c.email}</span>}
                          {c.telephone && c.telephone !== 'null' && <span className="text-xs text-gray-700 dark:text-gray-300">{c.telephone}</span>}
                        </div>
                        {(!c.email || c.email === 'null') && (!c.telephone || c.telephone === 'null') && <span className="text-xs text-gray-500 dark:text-gray-400 italic">Aucun</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {c.solde.toLocaleString('fr-FR')} F
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
                          c.tranche === '30J' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                          : c.tranche === '60J' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300'
                          : c.tranche === '90J+' ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                        }`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-800 dark:text-gray-200 font-medium">{c.nbFactures}</td>
                      <td className="px-4 py-3 text-center">
                        {c.derniereRelanceDate ? (
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            {new Date(c.derniereRelanceDate).toLocaleDateString('fr-FR')}
                            <br />
                            <span className="text-[10px] uppercase font-semibold text-gray-600 dark:text-gray-400">{c.derniereRelanceStatut}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400 italic">Jamais</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.eligibleRelance ? (
                          <button onClick={e => { e.stopPropagation(); relancerClient(c.clientId) }}
                            disabled={sendingOne === c.clientId}
                            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all"
                          >
                            {sendingOne === c.clientId
                              ? <Loader2 className="h-3 w-3 inline animate-spin" />
                              : <Send className="h-3 w-3 inline mr-1" />
                            }
                            {sendingOne === c.clientId ? 'Envoi...' : 'Relancer'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Déjà relancé</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > rlPerPage && (
            <div className="flex justify-center items-center gap-3 py-4 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setRlPage(p => Math.max(1, p - 1))} disabled={rlPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                ← Précédent
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {rlPage} / {Math.ceil(filtered.length / rlPerPage)}
              </span>
              <button onClick={() => setRlPage(p => Math.min(Math.ceil(filtered.length / rlPerPage), p + 1))}
                disabled={rlPage >= Math.ceil(filtered.length / rlPerPage)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                Suivant →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
