'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users, Truck, Search, Calendar, ArrowUpRight, ArrowDownRight, FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

type Tier = {
  id: number
  nom: string
  code: string | null
  type?: string
  dette: number
  typeTier: 'CLIENT' | 'FOURNISSEUR'
}

export default function SoldesTiersPage() {
  const { error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Tier[]>([])
  const [fournisseurs, setFournisseurs] = useState<Tier[]>([])
  const [dateDebut, setDateDebut] = useState<string>('')
  const [dateFin, setDateFin] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENT' | 'FOURNISSEUR'>('ALL')

  useEffect(() => {
    fetchData()
  }, [dateDebut, dateFin])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)

      const [clientsRes, fournisseursRes] = await Promise.all([
        fetch(`/api/clients?limit=1000&${params.toString()}`),
        fetch(`/api/fournisseurs?limit=1000&${params.toString()}`)
      ])

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json()
        const clientsWithType = (clientsData.data || []).map((c: any) => ({
          ...c,
          typeTier: 'CLIENT' as const,
          dette: c.dette || 0
        }))
        setClients(clientsWithType)
      }

      if (fournisseursRes.ok) {
        const fournData = await fournisseursRes.json()
        const fournWithType = (fournData.data || []).map((f: any) => ({
          ...f,
          typeTier: 'FOURNISSEUR' as const,
          dette: f.dette || 0
        }))
        setFournisseurs(fournWithType)
      }
    } catch (e) {
      showError("Erreur chargement données.")
    } finally {
      setLoading(false)
    }
  }

  const allTiers = useMemo(() => {
    const combined = [...clients, ...fournisseurs]
    let filtered = combined

    if (filterType !== 'ALL') {
      filtered = filtered.filter(t => t.typeTier === filterType)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t => 
        t.nom.toLowerCase().includes(term) || 
        (t.code && t.code.toLowerCase().includes(term))
      )
    }

    return filtered.sort((a, b) => Math.abs(b.dette) - Math.abs(a.dette))
  }, [clients, fournisseurs, filterType, searchTerm])

  const totals = useMemo(() => {
    const detteClients = clients.reduce((sum, c) => sum + (c.dette > 0 ? c.dette : 0), 0)
    const avoirClients = clients.reduce((sum, c) => sum + (c.dette < 0 ? Math.abs(c.dette) : 0), 0)
    const detteFourn = fournisseurs.reduce((sum, f) => sum + (f.dette > 0 ? f.dette : 0), 0)
    const avoirFourn = fournisseurs.reduce((sum, f) => sum + (f.dette < 0 ? Math.abs(f.dette) : 0), 0)

    return {
      detteClients,
      avoirClients,
      detteFourn,
      avoirFourn,
      totalDette: detteClients + detteFourn,
      totalAvoir: avoirClients + avoirFourn,
      netGlobal: (detteClients - avoirClients) - (detteFourn - avoirFourn)
    }
  }, [clients, fournisseurs])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Soldes Globaux - Tous les Tiers</h1>
          <p className="text-gray-500 text-sm">Vue consolidée Clients + Fournisseurs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-600 uppercase">Dette Clients</p>
          <p className="text-2xl font-black text-red-700">{totals.detteClients.toLocaleString()} F</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-600 uppercase">Avoir Clients</p>
          <p className="text-2xl font-black text-emerald-700">{totals.avoirClients.toLocaleString()} F</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs font-bold text-orange-600 uppercase">Dette Fournisseurs</p>
          <p className="text-2xl font-black text-orange-700">{totals.detteFourn.toLocaleString()} F</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-600 uppercase">Avoir Fournisseurs</p>
          <p className="text-2xl font-black text-blue-700">{totals.avoirFourn.toLocaleString()} F</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-xl p-4 border-2 ${totals.netGlobal > 0 ? 'bg-red-100 border-red-300' : totals.netGlobal < 0 ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300'}`}>
          <p className="text-xs font-bold uppercase">Position Nette Globale</p>
          <p className={`text-3xl font-black ${totals.netGlobal > 0 ? 'text-red-700' : totals.netGlobal < 0 ? 'text-green-700' : 'text-gray-700'}`}>
            {Math.abs(totals.netGlobal).toLocaleString()} F
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {totals.netGlobal > 0 ? 'Dette nette envers les tiers' : totals.netGlobal < 0 ? 'Créance nette sur les tiers' : 'Équilibré'}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-white">
          <p className="text-xs font-bold text-gray-400 uppercase">Total Tiers</p>
          <p className="text-3xl font-black">{clients.length + fournisseurs.length}</p>
          <p className="text-xs text-gray-400 mt-1">{clients.length} clients, {fournisseurs.length} fournisseurs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher</label>
          <input
            type="text"
            placeholder="Nom ou code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
            <option value="ALL">Tous les tiers</option>
            <option value="CLIENT">Clients seulement</option>
            <option value="FOURNISSEUR">Fournisseurs seulement</option>
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Nom</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Montant</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {allTiers.map((tier) => (
              <tr key={`${tier.typeTier}-${tier.id}`} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {tier.typeTier === 'CLIENT' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      <Users className="h-3 w-3" /> Client
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                      <Truck className="h-3 w-3" /> Fournisseur
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{tier.code || '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{tier.nom}</td>
                <td className="px-4 py-3 text-right font-black">
                  {Math.abs(tier.dette).toLocaleString()} F
                </td>
                <td className="px-4 py-3 text-center">
                  {tier.dette > 0.01 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-bold">
                      <ArrowUpRight className="h-3 w-3" /> DOIT
                    </span>
                  ) : tier.dette < -0.01 ? (
                    <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
                      <ArrowDownRight className="h-3 w-3" /> AVOIR
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">SOLDE</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => window.location.href = tier.typeTier === 'CLIENT' 
                      ? `/dashboard/clients/releves?id=${tier.id}` 
                      : `/dashboard/fournisseurs/releves?id=${tier.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Voir détail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}