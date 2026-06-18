'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Plus, Trash2, ArrowLeftRight, UserCheck, Printer, FileSpreadsheet } from 'lucide-react'

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

  const handleExportExcel = () => {
    const csv = [
      ['Code', 'Nom', 'NCC', 'Client', 'Fournisseur', 'Solde'].join(','),
      ...filtered.map(c => [
        c.code,
        `"${c.nom}"`,
        c.ncc || '',
        c.client?.nom || '',
        c.fournisseur?.nom || '',
        c.solde,
      ].join(','))
    ].join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ComptesCourants_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Comptes Courants</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchDetect}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors">
            <UserCheck className="mr-2 h-4 w-4" />
            Détection auto
          </button>
          <button onClick={handleExportExcel}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export
          </button>
          <button onClick={() => window.print()}
            className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm text-white transition-colors">
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </button>
          <button onClick={() => router.push('/dashboard/comptes-courants/nouveau')}
            className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm transition-colors">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
          className="pl-9 w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500" />
      </div>

      {/* Matches */}
      {showDetect && matches.length > 0 && (
        <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-4">
          <h3 className="font-bold mb-3">Correspondances détectées</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="text-left py-2">Client</th>
                <th className="text-left py-2">Fournisseur</th>
                <th className="text-left py-2">Type</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={`${m.clientId}-${m.fournisseurId}`} className="border-b border-white/5">
                  <td className="py-2">{m.clientNom}</td>
                  <td className="py-2">{m.fournisseurNom}</td>
                  <td className="py-2">
                    <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">{m.type}</span>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => linkMatch(m)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors">Lier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetect && matches.length === 0 && (
        <div className="bg-white/5 rounded-xl p-4 text-center text-sm text-gray-400 border border-white/10">
          Aucune nouvelle correspondance détectée.
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-12 text-center text-gray-400 border border-white/10">
          Aucun compte courant trouvé.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cc => (
            <div key={cc.id} className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => router.push(`/dashboard/comptes-courants/${cc.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">{cc.nom}</p>
                  <p className="text-xs text-gray-400">{cc.code}</p>
                  {cc.ncc && <p className="text-xs text-gray-500 truncate" title={`NCC: ${cc.ncc}`}>NCC: {cc.ncc}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-bold ${cc.solde >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(Math.abs(cc.solde))}
                  </p>
                  <p className={`text-[11px] ${cc.solde >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                    {cc.solde >= 0 ? 'Débiteur' : 'Créditeur'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cc.client && <span className="text-[10px] bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded truncate max-w-full" title={`Client: ${cc.client.nom}`}>Client: {cc.client.nom}</span>}
                {cc.fournisseur && <span className="text-[10px] bg-orange-600/20 text-orange-300 px-2 py-0.5 rounded truncate max-w-full" title={`Fournisseur: ${cc.fournisseur.nom}`}>Fournisseur: {cc.fournisseur.nom}</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/comptes-courants/${cc.id}`) }}
                  className="text-xs inline-flex items-center px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors">
                  <ArrowLeftRight className="mr-1 h-3 w-3" /> Détail
                </button>
                <button onClick={e => { e.stopPropagation(); deleteCompte(cc.id) }}
                  className="text-xs inline-flex items-center px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded transition-colors">
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
