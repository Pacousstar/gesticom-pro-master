'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Save, AlertCircle, Search, X } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function RechercheSelect({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: { id: number; nom: string; code: string | null; telephone: string | null }[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      i =>
        i.nom.toLowerCase().includes(q) ||
        (i.code?.toLowerCase() || '').includes(q) ||
        (i.telephone?.toLowerCase() || '').includes(q)
    )
  }, [items, search])

  const selected = value ? items.find(i => i.id === value) : null

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center justify-between w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
          <span>{selected.nom} ({selected.code || selected.telephone || 'Sans code'})</span>
          <button type="button" onClick={() => { onChange(null); setSearch('') }}
            className="text-gray-400 hover:text-white ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-white/10 border border-white/20 rounded-md pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500"
          />
        </div>
      )}
      {open && !selected && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-gray-800 border border-white/20 rounded-md max-h-60 overflow-y-auto shadow-xl">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearch('') }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
            >
              Aucun
            </button>
            {filtered.map(i => (
              <button
                key={i.id}
                type="button"
                onClick={() => { onChange(i.id); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 border-t border-white/5"
              >
                {i.nom} <span className="text-gray-400">({i.code || i.telephone || 'Sans code'})</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Aucun résultat</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function NouveauCompteCourantPage() {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [ncc, setNcc] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [fournisseurId, setFournisseurId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: clientsRaw } = useSWR('/api/clients', fetcher, { dedupingInterval: 2000 })
  const { data: fournisseursRaw } = useSWR('/api/fournisseurs', fetcher, { dedupingInterval: 2000 })
  const clients: { id: number; nom: string; code: string | null; telephone: string | null }[] = clientsRaw?.data ?? []
  const fournisseurs: { id: number; nom: string; code: string | null; telephone: string | null }[] = fournisseursRaw?.data ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nom.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/comptes-courants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim(), ncc: ncc.trim() || null, clientId, fournisseurId }),
      })
      if (res.ok) {
        router.push('/dashboard/comptes-courants')
      } else {
        const err = await res.json()
        setError(err.error || "Erreur lors de l'enregistrement.")
      }
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (nom) return
    if (clientId && clients) {
      const c = clients.find(x => x.id === clientId)
      if (c) setNom(c.nom)
    }
  }, [clientId, clients])

  useEffect(() => {
    if (nom) return
    if (fournisseurId && fournisseurs) {
      const f = fournisseurs.find(x => x.id === fournisseurId)
      if (f) setNom(f.nom)
    }
  }, [fournisseurId, fournisseurs])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/comptes-courants')}
            className="inline-flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold text-white">Nouveau compte courant</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-white/5 backdrop-blur rounded-xl border border-white/10 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} required
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500"
              placeholder="Nom du tiers" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">NCC (numéro compte courant)</label>
            <input value={ncc} onChange={e => setNcc(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500"
              placeholder="Optionnel" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Lier à un client (optionnel)</label>
            <RechercheSelect
              items={clients}
              value={clientId}
              onChange={setClientId}
              placeholder="Rechercher un client..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Lier à un fournisseur (optionnel)</label>
            <RechercheSelect
              items={fournisseurs}
              value={fournisseurId}
              onChange={setFournisseurId}
              placeholder="Rechercher un fournisseur..."
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <button type="submit" disabled={saving || !nom.trim()}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              Enregistrer
            </button>
            <button type="button" onClick={() => router.push('/dashboard/comptes-courants')}
              className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm transition-colors">
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
