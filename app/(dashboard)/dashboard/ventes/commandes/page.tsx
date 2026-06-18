'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Search, ArrowLeft, Package, Clock, CheckCircle, AlertTriangle, Truck, X } from 'lucide-react'

type Ligne = {
  id: number
  produitId: number
  designation: string
  quantite: number
  quantiteLivree: number
  prixUnitaire: number
  montant: number
}

type Vente = {
  id: number
  numero: string
  date: string
  montantTotal: number
  dateLivraison: string | null
  client: { id: number; nom: string } | null
  clientLibre: string | null
  magasin: { code: string; nom: string }
  lignes: Ligne[]
}

type LivraisonLigne = { produitId: number; designation: string; quantite: number; max: number; prixUnitaire: number }

export default function CommandesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const venteIdParam = searchParams.get('venteId')

  const [ventes, setVentes] = useState<Vente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVente, setSelectedVente] = useState<Vente | null>(null)
  const [livraisonLignes, setLivraisonLignes] = useState<LivraisonLigne[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [viewMode, setViewMode] = useState<'all' | 'pending' | 'partial' | 'done'>('pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const itemsPerPage = 30

  const fetchVentes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ventes?typeVente=COMMANDE&limit=10000')
      const data = await res.json()
      const list: Vente[] = Array.isArray(data) ? data : data?.data || []
      setVentes(list)
      if (venteIdParam) {
        const found = list.find((v: Vente) => v.id === Number(venteIdParam))
        if (found) openModal(found)
      }
    } finally {
      setLoading(false)
    }
  }, [venteIdParam])

  useEffect(() => { fetchVentes() }, [fetchVentes])

  const stats = ventes.reduce((acc, v) => {
    acc.total++
    if (v.dateLivraison) acc.completed++
    else {
      const tl = v.lignes.reduce((s, l) => s + (l.quantiteLivree || 0), 0)
      if (tl > 0) acc.partial++
      else acc.pending++
    }
    return acc
  }, { total: 0, pending: 0, partial: 0, completed: 0 })

  const filtered = ventes.filter(v => {
    if (viewMode === 'pending' && (v.dateLivraison || v.lignes.some(l => (l.quantiteLivree || 0) > 0))) return false
    if (viewMode === 'partial' && (!v.lignes.some(l => (l.quantiteLivree || 0) > 0) || v.dateLivraison)) return false
    if (viewMode === 'done' && !v.dateLivraison) return false
    if (dateDebut && v.date < dateDebut) return false
    if (dateFin && v.date > dateFin) return false
    const q = search.toLowerCase()
    if (!q) return true
    return v.numero.toLowerCase().includes(q) || (v.client?.nom || '').toLowerCase().includes(q) || (v.clientLibre || '').toLowerCase().includes(q)
  })

  const totalFilteredPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const paged = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  function openModal(v: Vente) {
    setSelectedVente(v)
    setLivraisonLignes(
      v.lignes
        .filter(l => (l.quantiteLivree || 0) < l.quantite)
        .map(l => ({ produitId: l.produitId, designation: l.designation, quantite: 0, max: l.quantite - (l.quantiteLivree || 0), prixUnitaire: l.prixUnitaire }))
    )
    setModalOpen(true)
  }

  function updateQte(produitId: number, val: number) {
    setLivraisonLignes(prev => prev.map(l => l.produitId === produitId ? { ...l, quantite: Math.max(0, Math.min(val, l.max)) } : l))
  }

  async function handleSubmitLivraison() {
    if (!selectedVente) return
    const lignes = livraisonLignes.filter(l => l.quantite > 0)
    if (!lignes.length) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes/${selectedVente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LIVRER', lignes: lignes.map(l => ({ produitId: l.produitId, quantite: l.quantite })) }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || 'Erreur lors de la livraison')
        return
      }
      setSuccessMsg(`Livraison effectuée sur ${selectedVente.numero}`)
      setModalOpen(false)
      fetchVentes()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e: any) {
      alert(e.message || 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/ventes')} className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold">
              <Package className="h-6 w-6 inline mr-2" />
              Gestion des commandes
            </h1>
          </div>
        </div>

        {successMsg && (
          <div className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-3 flex items-center gap-2 text-white font-medium">
            <CheckCircle className="h-5 w-5" /> {successMsg}
          </div>
        )}

        {/* Sous-navigation ventes */}
        <div className="flex flex-wrap gap-1 no-print">
          {[
            { href: '/dashboard/ventes', label: 'Ventes' },
            { href: '/dashboard/ventes/toute', label: 'Toutes' },
            { href: '/dashboard/ventes/rapide', label: 'Rapide' },
            { href: '/dashboard/ventes/commandes', label: 'Commandes' },
            { href: '/dashboard/ventes/retours', label: 'Retours' },
            { href: '/dashboard/ventes/retraits', label: 'Retraits' },
            { href: '/dashboard/ventes/suivi', label: 'Suivi' },
            { href: '/dashboard/ventes/historiques', label: 'Historiques' },
          ].map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  active
                    ? 'bg-white text-blue-700 shadow-md'
                    : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-white/20">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">Total</p>
              <Package className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-2xl font-bold mt-1 text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-amber-300/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">En attente</p>
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-200">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-blue-300/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">Partiel</p>
              <AlertTriangle className="h-5 w-5 text-blue-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-200">{stats.partial}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-green-300/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/70">Livré</p>
              <Truck className="h-5 w-5 text-green-300" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-200">{stats.completed}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par n° commande ou client..."
              className="w-full rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div>
            <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setCurrentPage(1) }}
              className="rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
          </div>
          <div>
            <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setCurrentPage(1) }}
              className="rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]" />
          </div>
          <div className="flex gap-2">
            {(['pending', 'partial', 'done', 'all'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${viewMode === m ? 'bg-white text-blue-700' : 'bg-white/15 text-white/80 hover:bg-white/25'}`}>
                {m === 'all' ? 'Tous' : m === 'pending' ? 'En attente' : m === 'partial' ? 'Partiel' : 'Livré'}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/60">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Aucune commande trouvée</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium">N° commande</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Montant</th>
                    <th className="text-center px-4 py-3 font-medium">Progrès</th>
                    <th className="text-center px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paged.map(v => {
                    const tq = v.lignes.reduce((s, l) => s + l.quantite, 0)
                    const tl = v.lignes.reduce((s, l) => s + (l.quantiteLivree || 0), 0)
                    const pct = tq > 0 ? Math.round(tl / tq * 100) : 0
                    const pctColor = pct >= 100 ? 'bg-green-400' : pct > 0 ? 'bg-amber-400' : 'bg-gray-400'
                    const reste = tq - tl
                    return (
                      <tr key={v.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{v.numero}</td>
                        <td className="px-4 py-3 text-white/80">{v.client?.nom || v.clientLibre || 'N/A'}</td>
                        <td className="px-4 py-3 text-white/70">{new Date(v.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{v.montantTotal.toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 justify-center">
                            <div className="w-24 bg-white/30 rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-white font-bold w-16 text-right">{tl}/{tq}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {reste > 0 ? (
                            <button onClick={() => openModal(v)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white/25 hover:bg-white/40 px-3 py-1.5 text-xs font-bold text-white transition-colors border border-white/30">
                              <Truck className="h-3.5 w-3.5" /> Livrer
                            </button>
                          ) : (
                            <span className="text-xs text-green-300 font-bold bg-green-900/30 px-2 py-1 rounded-lg">Livrée</span>
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

        {totalFilteredPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalFilteredPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setCurrentPage(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${currentPage === p ? 'bg-white text-blue-700' : 'bg-white/15 text-white/80 hover:bg-white/25'}`}>
                {p}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white/40">{filtered.length} commande(s) — Page {currentPage}/{totalFilteredPages}</p>
      </div>

      {modalOpen && selectedVente && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Truck className="h-5 w-5" /> Livraison partielle — {selectedVente.numero}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg hover:bg-white/20 p-1.5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <strong>Client :</strong> {selectedVente.client?.nom || selectedVente.clientLibre || 'N/A'}
              </p>
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Produits à livrer</p>
                {livraisonLignes.map(l => (
                  <div key={l.produitId} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{l.designation}</p>
                      <p className="text-xs text-gray-500">Reste: {l.max} / Prix: {l.prixUnitaire.toLocaleString('fr-FR')} F</p>
                    </div>
                    <input type="number" min={0} max={l.max} value={l.quantite}
                      onChange={e => updateQte(l.produitId, Number(e.target.value))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:border-blue-500 focus:outline-none" />
                  </div>
                ))}
              </div>
              {livraisonLignes.filter(l => l.quantite > 0).length > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <strong>Total à livrer :</strong> {livraisonLignes.filter(l => l.quantite > 0).length} produit(s) —
                  {livraisonLignes.filter(l => l.quantite > 0).reduce((s, l) => s + l.quantite * l.prixUnitaire, 0).toLocaleString('fr-FR')} F
                </div>
              )}
              <button onClick={handleSubmitLivraison} disabled={submitting || livraisonLignes.filter(l => l.quantite > 0).length === 0}
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 transition-colors flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
                {submitting ? 'Livraison en cours...' : 'Confirmer la livraison'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
