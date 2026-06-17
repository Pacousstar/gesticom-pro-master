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

  const { data: clients } = useSWR<ClientOption[]>('/api/clients', fetcher)
  const { data: fournisseurs } = useSWR<FournisseurOption[]>('/api/fournisseurs', fetcher)

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

  // Auto-remplir le nom si client ou fournisseur sélectionné
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
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/comptes-courants')} className="inline-flex items-center px-3 py-2 border rounded-md text-sm hover:bg-gray-50">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </button>
        <h1 className="text-2xl font-bold">Nouveau compte courant</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input value={nom} onChange={e => setNom(e.target.value)} required
            className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Nom du tiers" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">NCC (numéro compte courant)</label>
          <input value={ncc} onChange={e => setNcc(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Optionnel" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lier à un client (optionnel)</label>
          <select value={clientId ?? ''} onChange={e => setClientId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {(clients || []).map(c => (
              <option key={c.id} value={c.id}>{c.nom} ({c.code || c.telephone || 'Sans code'})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Lier à un fournisseur (optionnel)</label>
          <select value={fournisseurId ?? ''} onChange={e => setFournisseurId(e.target.value ? Number(e.target.value) : null)}
            className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Aucun</option>
            {(fournisseurs || []).map(f => (
              <option key={f.id} value={f.id}>{f.nom} ({f.code || f.telephone || 'Sans code'})</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-4">
          <button type="submit" disabled={saving || !nom.trim()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
