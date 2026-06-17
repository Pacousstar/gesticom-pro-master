'use client'

import { useState, useEffect } from 'react'
import { Search, Users, Plus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

type Client = {
  id: number
  code: string
  nom: string
  telephone: string | null
  type: string
  solde: number | null
}

export default function MobileClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ nom: '', telephone: '', type: 'CASH' })
  const [creating, setCreating] = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const c = d.data && Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : [])
        setClients(c)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const searchLower = search.toLowerCase()
  const filtered = clients.filter(c =>
    !search || c.nom.toLowerCase().includes(searchLower) ||
    (c.code && c.code.toLowerCase().includes(searchLower)) ||
    (c.telephone && c.telephone.includes(search))
  )

  async function handleCreate() {
    if (!form.nom.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toastError(data?.error || data?.message || 'Erreur création client')
        return
      }
      setClients(prev => [...prev, data])
      setShowCreate(false)
      setForm({ nom: '', telephone: '', type: 'CASH' })
      toastSuccess('Client créé')
    } catch {
      toastError('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-400" />
          <span className="font-black text-sm">Clients</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 bg-orange-600 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" /> Nouveau
        </button>
      </div>

      <div className="px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 font-bold"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{c.nom}</p>
                <p className="text-xs text-gray-400">{c.code || ''} {c.telephone ? `— ${c.telephone}` : ''}</p>
              </div>
              <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                c.type === 'CREDIT' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {c.type}
              </span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Aucun client trouvé</p>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="absolute inset-0 bg-black/80 z-10 flex flex-col justify-end">
          <div className="bg-gray-900 rounded-t-3xl p-6 border-t border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <p className="font-black text-white text-lg">Nouveau client</p>
              <button onClick={() => setShowCreate(false)} className="p-2">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Nom *</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-white font-bold"
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Téléphone</label>
                <input
                  type="text"
                  value={form.telephone}
                  onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-white font-bold"
                  placeholder="+237 6XX XXX XXX"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1 block">Type</label>
                <div className="flex gap-2">
                  {['CASH', 'CREDIT'].map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                        form.type === t ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {t === 'CASH' ? 'Comptant' : 'Crédit'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !form.nom.trim()}
                className="w-full rounded-xl bg-orange-600 py-3 font-bold text-white text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  'Créer le client'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
