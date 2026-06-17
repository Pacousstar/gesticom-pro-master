'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Plus, Trash2, ArrowLeftRight, UserCheck } from 'lucide-react'

interface CompteCourant {
  id: number
  code: string
  nom: string
  ncc: string | null
  clientId: number | null
  fournisseurId: number | null
  client: { id: number; nom: string; telephone: string | null } | null
  fournisseur: { id: number; nom: string; telephone: string | null } | null
  solde: number
}

interface Match {
  clientId: number
  clientNom: string
  fournisseurId: number
  fournisseurNom: string
  type: string
}

export default function ComptesCourantsPage() {
  const router = useRouter()
  const [comptes, setComptes] = useState<CompteCourant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [showDetect, setShowDetect] = useState(false)

  const fetchComptes = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/comptes-courants')
      if (res.ok) setComptes(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const fetchDetect = async () => {
    const res = await fetch('/api/comptes-courants/detect', { method: 'POST', body: '{}' })
    if (res.ok) setMatches(await res.json())
    setShowDetect(true)
  }

  const linkMatch = async (m: Match) => {
    const res = await fetch('/api/comptes-courants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: m.clientId, fournisseurId: m.fournisseurId, nom: m.clientNom }),
    })
    if (res.ok) {
      setMatches(matches.filter(x => x.clientId !== m.clientId || x.fournisseurId !== m.fournisseurId))
      fetchComptes()
    }
  }

  const deleteCompte = async (id: number) => {
    if (!confirm('Supprimer ce compte courant ?')) return
    await fetch(`/api/comptes-courants/${id}`, { method: 'DELETE' })
    fetchComptes()
  }

  useEffect(() => { fetchComptes() }, [])

  const fmt = (n: number) => `${n.toLocaleString('fr-FR')} FCFA`

  const filtered = comptes.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.ncc && c.ncc.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comptes Courants</h1>
        <div className="flex gap-2">
          <button onClick={fetchDetect} className="inline-flex items-center px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
            <UserCheck className="mr-2 h-4 w-4" />
            Détection auto
          </button>
          <button onClick={() => router.push('/dashboard/comptes-courants/nouveau')} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </button>
        </div>
      </div>

      {showDetect && matches.length > 0 && (
        <div className="border rounded-lg p-4 bg-white">
          <h3 className="text-sm font-semibold mb-3">Correspondances détectées</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Client</th>
                <th className="text-left py-2">Fournisseur</th>
                <th className="text-left py-2">Type</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={`${m.clientId}-${m.fournisseurId}`} className="border-b">
                  <td className="py-2">{m.clientNom}</td>
                  <td className="py-2">{m.fournisseurNom}</td>
                  <td className="py-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{m.type}</span>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => linkMatch(m)} className="px-3 py-1 border rounded text-xs hover:bg-gray-50">Lier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetect && matches.length === 0 && (
        <div className="border rounded-lg p-4 text-center text-sm text-gray-500 bg-white">
          Aucune nouvelle correspondance détectée.
        </div>
      )}

      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-gray-500 bg-white">
          Aucun compte courant trouvé.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cc => (
            <div key={cc.id} className="border rounded-lg p-6 bg-white hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/comptes-courants/${cc.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{cc.nom}</p>
                  <p className="text-xs text-gray-500">{cc.code}</p>
                  {cc.ncc && <p className="text-xs text-gray-500">NCC: {cc.ncc}</p>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${cc.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(Math.abs(cc.solde))}
                  </p>
                  <p className="text-xs text-gray-500">{cc.solde >= 0 ? 'Créance' : 'Dette'}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-xs text-gray-500">
                {cc.client && <span className="bg-blue-50 px-2 py-0.5 rounded">Client: {cc.client.nom}</span>}
                {cc.fournisseur && <span className="bg-orange-50 px-2 py-0.5 rounded">Fournisseur: {cc.fournisseur.nom}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="text-xs inline-flex items-center px-2 py-1 border rounded hover:bg-gray-50"
                  onClick={e => { e.stopPropagation(); router.push(`/dashboard/comptes-courants/${cc.id}`) }}>
                  <ArrowLeftRight className="mr-1 h-3 w-3" /> Détail
                </button>
                <button
                  className="text-xs inline-flex items-center px-2 py-1 border rounded text-red-500 hover:bg-red-50"
                  onClick={e => { e.stopPropagation(); deleteCompte(cc.id) }}>
                  <Trash2 className="mr-1 h-3 w-3" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
