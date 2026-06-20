'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Plus, Trash2, ArrowLeftRight, UserCheck, Printer, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

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
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Comptes Courants</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Gestion des comptes clients et fournisseurs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchDetect}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <UserCheck className="h-4 w-4" />
            Détection auto
          </button>
          <button onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <FileSpreadsheet className="h-4 w-4" />
            Export
          </button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20 transition-all">
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
          <button onClick={() => router.push('/dashboard/comptes-courants/nouveau')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 shadow-md transition-all">
            <Plus className="h-4 w-4" />
            Nouveau
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 no-print">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input placeholder="Rechercher par nom, code ou NCC..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
      </div>

      {/* Matches */}
      {showDetect && matches.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
          <h3 className="font-bold text-gray-900 mb-3">Correspondances détectées</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase">
                <th className="text-left py-2 font-semibold">Client</th>
                <th className="text-left py-2 font-semibold">Fournisseur</th>
                <th className="text-left py-2 font-semibold">Type</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={`${m.clientId}-${m.fournisseurId}`} className="border-b border-gray-100">
                  <td className="py-2 text-gray-700">{m.clientNom}</td>
                  <td className="py-2 text-gray-700">{m.fournisseurNom}</td>
                  <td className="py-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">{m.type}</span>
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => linkMatch(m)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm transition-all">Lier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetect && matches.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
          Aucune nouvelle correspondance détectée.
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-orange-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500 shadow-sm">
          Aucun compte courant trouvé.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cc => (
            <div key={cc.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
              onClick={() => router.push(`/dashboard/comptes-courants/${cc.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900 truncate">{cc.nom}</p>
                  <p className="text-xs text-gray-500">{cc.code}</p>
                  {cc.ncc && <p className="text-xs text-gray-400 truncate" title={`NCC: ${cc.ncc}`}>NCC: {cc.ncc}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-lg font-black ${cc.solde >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(Math.abs(cc.solde))}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${cc.solde >= 0 ? 'text-emerald-600/70' : 'text-red-500/70'}`}>
                    {cc.solde >= 0 ? 'Débiteur' : 'Créditeur'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cc.client && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium" title={`Client: ${cc.client.nom}`}>Client: {cc.client.nom}</span>}
                {cc.fournisseur && <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-medium" title={`Fournisseur: ${cc.fournisseur.nom}`}>Fournisseur: {cc.fournisseur.nom}</span>}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/comptes-courants/${cc.id}`) }}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-sm transition-all">
                  <ArrowLeftRight className="h-3 w-3" /> Détail
                </button>
                <button onClick={e => { e.stopPropagation(); deleteCompte(cc.id) }}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-lg transition-all">
                  <Trash2 className="h-3 w-3" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
