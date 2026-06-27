'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Search, ArrowLeft, Package, Clock, CheckCircle, AlertTriangle, Truck, X } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'

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
  montantRetourne?: number
  montantNet?: number
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
  const { error: showError } = useToast()

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
        if (found) { openModal(found); window.history.replaceState(null, '', pathname) }
      }
    } catch {
      showError('Erreur lors du chargement des commandes')
    } finally {
      setLoading(false)
    }
  }, [venteIdParam, pathname])

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
        showError(d.error || 'Erreur lors de la livraison')
        return
      }
      setSuccessMsg(`Livraison effectuée sur ${selectedVente.numero}`)
      setModalOpen(false)
      fetchVentes()
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e: unknown) {
      showError(formatApiError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Commandes</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Gestion des commandes clients</p>
        </div>
        <button onClick={() => router.push('/dashboard/ventes')}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>

        {successMsg && (
          <div className="rounded-xl bg-emerald-600/90 px-4 py-3 flex items-center gap-2 text-white font-medium shadow-lg">
            <CheckCircle className="h-5 w-5 shrink-0" /> {successMsg}
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
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 no-print">
          {[
            { label: "Total", val: stats.total.toString(), icon: Package, color: "bg-indigo-600" },
            { label: "En attente", val: stats.pending.toString(), icon: Clock, color: "bg-amber-600" },
            { label: "Partiel", val: stats.partial.toString(), icon: AlertTriangle, color: "bg-blue-600" },
            { label: "Livré", val: stats.completed.toString(), icon: Truck, color: "bg-emerald-600" },
          ].map((c, i) => (
            <div key={i} className={`relative overflow-hidden rounded-2xl ${c.color} p-5 shadow-xl group`}>
              <div className="relative z-10 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                <p className="text-2xl font-black tracking-tighter mt-1">{c.val}</p>
              </div>
              <c.icon className="absolute right-4 bottom-3 h-10 w-10 text-white opacity-10 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center rounded-xl border border-gray-200 bg-gray-50 p-3 no-print">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par n° commande ou client..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm"
            />
          </div>
          <div>
            <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setCurrentPage(1) }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
          </div>
          <div>
            <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setCurrentPage(1) }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
          </div>
          <div className="flex gap-2">
            {(['pending', 'partial', 'done', 'all'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  viewMode === m
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 shadow-sm'
                }`}>
                {m === 'all' ? 'Tous' : m === 'pending' ? 'En attente' : m === 'partial' ? 'Partiel' : 'Livré'}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">Aucune commande trouvée</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">N° commande</th>
                    <th className="text-left px-4 py-3 font-semibold">Client</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-right px-4 py-3 font-semibold">Montant</th>
                    <th className="text-right px-4 py-3 font-semibold text-amber-600">Retourné</th>
                    <th className="text-right px-4 py-3 font-semibold">Net</th>
                    <th className="text-center px-4 py-3 font-semibold">Progrès</th>
                    <th className="text-center px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map(v => {
                    const tq = v.lignes.reduce((s, l) => s + l.quantite, 0)
                    const tl = v.lignes.reduce((s, l) => s + (l.quantiteLivree || 0), 0)
                    const pct = tq > 0 ? Math.round(tl / tq * 100) : 0
                    const pctColor = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-300'
                    const reste = tq - tl
                    return (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900">{v.numero}</td>
                        <td className="px-4 py-3 text-gray-700">{v.client?.nom || v.clientLibre || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(v.date).toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{v.montantTotal.toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-600">{(v.montantRetourne || 0).toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{(v.montantNet ?? v.montantTotal).toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 justify-center">
                            <div className="w-24 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs bg-gray-100 text-gray-700 font-bold px-2 py-0.5 rounded">{tl}/{tq}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {reste > 0 ? (
                            <button onClick={() => openModal(v)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm">
                              <Truck className="h-3.5 w-3.5" /> Livrer
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">Livrée</span>
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
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${
                  currentPage === p
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 shadow-sm'
                }`}>
                {p}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white">{filtered.length} commande(s) — Page {currentPage}/{totalFilteredPages}</p>
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
    </>
  )
}
