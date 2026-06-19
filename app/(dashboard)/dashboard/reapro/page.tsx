'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Search, Filter, ShoppingCart, AlertTriangle,
  Package, Truck, CheckCircle, XCircle, Building2,
  ChevronDown, ChevronUp, FileText, Plus
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

type Fournisseur = { id: number; nom: string }
type Magasin = { id: number; code: string; nom: string }

type Suggestion = {
  produitId: number
  code: string
  designation: string
  categorie: string
  stock: number
  seuil: number
  stockParMagasin: Record<number, number>
  prixAchat: number
  fournisseur: Fournisseur | null
  ventes30j: number
  moyenneQuotidienne: number
  quantiteSuggeree: number
  coutEstime: number
}

export default function ReaproPage() {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState('')
  const [magasinId, setMagasinId] = useState('')
  const [categorie, setCategorie] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showGenerated, setShowGenerated] = useState<any[] | null>(null)

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (magasinId) params.set('magasinId', magasinId)
      if (categorie) params.set('categorie', categorie)
      if (search) params.set('search', search)

      const res = await fetch('/api/reapro/suggestions?' + params.toString())
      if (!res.ok) throw new Error('Erreur chargement')
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setMagasins(data.magasins || [])
      setCategories(data.categories || [])
    } catch {
      showError('Erreur lors du chargement des suggestions.')
    } finally {
      setLoading(false)
    }
  }, [magasinId, categorie, search, showError])

  useEffect(() => { fetchSuggestions() }, [fetchSuggestions])

  const filtered = suggestions.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.code.toLowerCase().includes(q) || s.designation.toLowerCase().includes(q)
  })

  const totalCout = filtered.reduce((s, sg) => s + sg.coutEstime, 0)
  const totalQte = filtered.reduce((s, sg) => s + sg.quantiteSuggeree, 0)

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(s => s.produitId)))
  }

  const genererBons = async () => {
    if (!magasinId) { showError('Sélectionnez un magasin de destination.'); return }
    if (selectedIds.size === 0) { showError('Sélectionnez au moins un produit.'); return }

    const selected = filtered.filter(s => selectedIds.has(s.produitId))
    setGenerating(true)
    try {
      const lignes = selected.map(s => ({
        produitId: s.produitId,
        designation: s.designation,
        quantite: s.quantiteSuggeree,
        prixUnitaire: s.prixAchat,
        montant: s.coutEstime,
      }))

      const res = await fetch('/api/reapro/generer-bons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magasinId: Number(magasinId), lignes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')

      setShowGenerated(data.commandes || [])
      setSelectedIds(new Set())
      showSuccess(`${data.count} bon(s) de commande généré(s).`)
      fetchSuggestions()
    } catch (e: any) {
      showError(e.message || 'Erreur lors de la génération.')
    } finally {
      setGenerating(false)
    }
  }

  const pctColor = (stock: number, seuil: number) => {
    const ratio = stock / Math.max(seuil, 1)
    if (ratio === 0) return 'bg-red-500'
    if (ratio < 0.5) return 'bg-orange-500'
    return 'bg-amber-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-white/10 hover:bg-white/20 p-2 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <div className="rounded-xl bg-white/20 backdrop-blur-sm px-4 py-3 flex items-center gap-2 text-white font-bold text-lg">
            <ShoppingCart className="h-6 w-6" />
            Bons de Réapprovisionnement
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-white/20">
            <p className="text-sm text-white/70">Produits sous seuil</p>
            <p className="text-2xl font-bold mt-1 text-white">{suggestions.length}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-amber-300/40">
            <p className="text-sm text-white/70">Qté suggérée totale</p>
            <p className="text-2xl font-bold mt-1 text-amber-200">{totalQte}</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-orange-300/40">
            <p className="text-sm text-white/70">Coût estimé total</p>
            <p className="text-2xl font-bold mt-1 text-orange-200">{totalCout.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="rounded-xl bg-white/15 backdrop-blur-sm p-4 border border-green-300/40">
            <p className="text-sm text-white/70">Fournisseurs concernés</p>
            <p className="text-2xl font-bold mt-1 text-green-200">
              {new Set(filtered.map(s => s.fournisseur?.nom).filter(Boolean)).size}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <select value={magasinId} onChange={e => setMagasinId(e.target.value)}
            className="rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="">Tous les magasins</option>
            {magasins.map(m => (
              <option key={m.id} value={String(m.id)} className="text-gray-900">{m.nom}</option>
            ))}
          </select>
          <select value={categorie} onChange={e => setCategorie(e.target.value)}
            className="rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <option value="">Toutes catégories</option>
            {categories.map(c => (
              <option key={c} value={c} className="text-gray-900">{c}</option>
            ))}
          </select>
        </div>

        {/* Generate button */}
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-white/80">
            {selectedIds.size > 0
              ? `${selectedIds.size} produit(s) sélectionné(s) — ${[...selectedIds].reduce((s, id) => {
                  const sg = filtered.find(f => f.produitId === id)
                  return s + (sg?.coutEstime || 0)
                }, 0).toLocaleString('fr-FR')} F estimés`
              : 'Cochez les produits à réapprovisionner'}
          </p>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())}
                className="rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium transition-colors"
              >
                <XCircle className="h-4 w-4 inline mr-1" /> Annuler
              </button>
            )}
            <button onClick={genererBons} disabled={generating || selectedIds.size === 0 || !magasinId}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/20 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold text-white transition-colors flex items-center gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? 'Génération...' : 'Générer les bons de commande'}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/60">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Aucun produit sous seuil critique</p>
            <p className="text-sm mt-1">Tous les stocks sont suffisants.</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/60 text-xs uppercase">
                    <th className="text-left px-4 py-3 font-medium w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-white/30" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Produit</th>
                    <th className="text-left px-4 py-3 font-medium">Catégorie</th>
                    <th className="text-center px-4 py-3 font-medium">Stock</th>
                    <th className="text-center px-4 py-3 font-medium">Seuil</th>
                    <th className="text-center px-4 py-3 font-medium">Ventes 30j</th>
                    <th className="text-center px-4 py-3 font-medium">Qté suggérée</th>
                    <th className="text-right px-4 py-3 font-medium">Prix Achat</th>
                    <th className="text-right px-4 py-3 font-medium">Coût estimé</th>
                    <th className="text-left px-4 py-3 font-medium">Fournisseur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map(s => {
                    const checked = selectedIds.has(s.produitId)
                    return (
                      <tr key={s.produitId}
                        className={`hover:bg-white/5 transition-colors cursor-pointer ${checked ? 'bg-white/10' : ''}`}
                        onClick={() => toggleSelect(s.produitId)}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelect(s.produitId)} className="rounded border-white/30" />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{s.designation}</p>
                          <p className="text-[10px] text-white/50 font-mono">{s.code}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/60 bg-white/10 px-1.5 py-0.5 rounded">{s.categorie}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-white/20 rounded-full h-2 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pctColor(s.stock, s.seuil)}`}
                                style={{ width: `${Math.min(100, (s.stock / Math.max(s.seuil, 1)) * 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-8 text-right ${s.stock <= s.seuil ? 'text-red-300' : 'text-white/80'}`}>
                              {s.stock}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-white/70">{s.seuil}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-bold text-blue-200">{s.ventes30j}</span>
                          <span className="text-[10px] text-white/40 ml-1">/30j</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] rounded-lg bg-amber-500/30 text-amber-200 font-bold px-2 py-1 text-sm">
                            {s.quantiteSuggeree}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-white/80">{s.prixAchat.toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right text-white font-bold">{s.coutEstime.toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-white/70">
                            {s.fournisseur?.nom || <span className="text-white/30 italic">—</span>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Generated confirmation */}
        {showGenerated && showGenerated.length > 0 && (
          <div className="rounded-xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-emerald-200 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> {showGenerated.length} bon(s) de commande créé(s)
              </h3>
              <button onClick={() => setShowGenerated(null)}
                className="text-white/50 hover:text-white text-xs font-bold">✕ Fermer</button>
            </div>
            <div className="space-y-2">
              {showGenerated.map((c: any) => (
                <div key={c.id}
                  className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-2"
                >
                  <div>
                    <Link href={`/dashboard/commandes-fournisseurs`}
                      className="text-white font-bold hover:underline text-sm"
                    >
                      {c.numero}
                    </Link>
                    <span className="text-xs text-white/50 ml-2">
                      {c.fournisseur?.nom || 'Sans fournisseur'} — {c.lignes?.length || 0} ligne(s)
                    </span>
                  </div>
                  <span className="text-white font-bold text-sm">
                    {(c.montantTotal || 0).toLocaleString('fr-FR')} F
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-white/40">
          {suggestions.length} produit(s) sous seuil — Les quantités sont calculées à partir des ventes des 30 derniers jours
        </p>
      </div>
    </div>
  )
}
