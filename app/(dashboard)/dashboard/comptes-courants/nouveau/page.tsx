'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, Save } from 'lucide-react'
import useSWR from 'swr'

interface ClientOption {
  id: number
  nom: string
  code: string | null
  telephone: string | null
  ncc: string | null
}

interface FournisseurOption {
  id: number
  nom: string
  code: string | null
  telephone: string | null
  ncc: string | null
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function NouveauCompteCourantPage() {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [ncc, setNcc] = useState('')
  const [clientId, setClientId] = useState<number | null>(null)
  const [fournisseurId, setFournisseurId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: clientsRaw } = useSWR('/api/clients', fetcher, { dedupingInterval: 2000 })
  const { data: fournisseursRaw } = useSWR('/api/fournisseurs', fetcher, { dedupingInterval: 2000 })
  const clients: ClientOption[] = clientsRaw?.data ?? []
  const fournisseurs: FournisseurOption[] = fournisseursRaw?.data ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
            <select value={clientId ?? ''} onChange={e => setClientId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
              <option value="" className="bg-gray-800">Aucun</option>
              {(clients || []).map(c => (
                <option key={c.id} value={c.id} className="bg-gray-800">{c.nom} ({c.code || c.telephone || 'Sans code'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Lier à un fournisseur (optionnel)</label>
            <select value={fournisseurId ?? ''} onChange={e => setFournisseurId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white">
              <option value="" className="bg-gray-800">Aucun</option>
              {(fournisseurs || []).map(f => (
                <option key={f.id} value={f.id} className="bg-gray-800">{f.nom} ({f.code || f.telephone || 'Sans code'})</option>
              ))}
            </select>
          </div>

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
