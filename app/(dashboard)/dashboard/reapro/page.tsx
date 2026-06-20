'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Search, ShoppingCart, AlertTriangle,
  Package, Truck, CheckCircle, XCircle, Building2,
  ChevronDown, FileText, Filter, Warehouse, Tag, Clock, DollarSign
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

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
  const [destinationMagasinId, setDestinationMagasinId] = useState('')
  const [showGenerated, setShowGenerated] = useState<any[] | null>(null)
  const [rpPage, setRpPage] = useState(1)

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

  const itemsPerPage = 10
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((rpPage - 1) * itemsPerPage, rpPage * itemsPerPage)

  useEffect(() => {
    setRpPage(1)
  }, [search, magasinId, categorie])

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
    if (!destinationMagasinId) { showError('Sélectionnez un magasin de destination.'); return }
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
        body: JSON.stringify({ magasinId: Number(destinationMagasinId), lignes }),
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

  const formatFcfa = (val: number) => val.toLocaleString('fr-FR') + ' F'

  return (
    <div className="pb-12">
      <div className="print:hidden space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl opacity-50" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Bons de Réapprovisionnement</h1>
              <p className="mt-2 text-white/90 font-medium max-w-2xl">
                Gérez les réapprovisionnements automatiques basés sur les seuils de stock et les ventes.
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] ml-6">Analyse des stocks : {suggestions.length} produits sous seuil</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Produits sous seuil", val: String(suggestions.length), sub: "Articles à réapprovisionner", icon: AlertTriangle, color: "bg-rose-600" },
              { label: "Qté suggérée totale", val: String(totalQte), sub: "Unités recommandées", icon: Package, color: "bg-amber-600" },
              { label: "Coût estimé total", val: formatFcfa(totalCout), sub: "Budget nécessaire", icon: DollarSign, color: "bg-blue-600" },
              { label: "Fournisseurs concernés", val: String(new Set(filtered.map(s => s.fournisseur?.nom).filter(Boolean)).size), sub: "Partenaires à solliciter", icon: Building2, color: "bg-indigo-600" },
            ].map((c, i) => (
              <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl hover:scale-[1.02] transition-transform group`}>
                <div className="relative z-10 text-white flex flex-col justify-between h-full">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
                    <p className="text-[9px] font-bold opacity-60 uppercase">{c.sub}</p>
                  </div>
                </div>
                <c.icon className="absolute right-4 bottom-4 h-12 w-12 text-white opacity-10 group-hover:scale-110 transition-transform" />
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex flex-wrap items-end gap-4 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full rounded-2xl border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
            </div>
            <select value={magasinId} onChange={e => setMagasinId(e.target.value)}
              className="rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            >
              <option value="">Tous les magasins</option>
              {magasins.map(m => (
                <option key={m.id} value={String(m.id)}>{m.nom}</option>
              ))}
            </select>
            <select value={categorie} onChange={e => setCategorie(e.target.value)}
              className="rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            >
              <option value="">Toutes catégories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Generate action bar */}
        <div className="rounded-[2rem] bg-white p-6 shadow-xl border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2.5 ${selectedIds.size > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-800 uppercase tracking-tighter">
                {selectedIds.size > 0
                  ? `${selectedIds.size} produit(s) sélectionné(s)`
                  : 'Cochez les produits à réapprovisionner'}
              </p>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                {selectedIds.size > 0
                  ? `${[...selectedIds].reduce((s, id) => { const sg = filtered.find(f => f.produitId === id); return s + (sg?.coutEstime || 0) }, 0).toLocaleString('fr-FR')} F estimés — ${[...selectedIds].reduce((s, id) => { const sg = filtered.find(f => f.produitId === id); return s + (sg?.quantiteSuggeree || 0) }, 0)} unités`
                  : 'Sélectionnez dans le tableau ci-dessous'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select value={destinationMagasinId} onChange={e => setDestinationMagasinId(e.target.value)}
              className="flex-1 md:flex-none rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
            >
              <option value="">Magasin destination *</option>
              {magasins.map(m => (
                <option key={m.id} value={String(m.id)}>{m.nom}</option>
              ))}
            </select>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())}
                className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
              >
                <XCircle className="h-4 w-4 inline mr-1" /> Annuler
              </button>
            )}
            <button onClick={genererBons} disabled={generating || selectedIds.size === 0 || !destinationMagasinId}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-xl active:scale-95 uppercase tracking-widest"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? 'Génération...' : 'Générer les bons de commande'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-2xl border border-gray-100">
          <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-3">
              <Truck className="h-5 w-5 text-emerald-500" />
              Suggestions de réapprovisionnement
            </h2>
            <div className="flex gap-2">
              <span className="bg-emerald-100 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                {filtered.length} Produits
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
              <p className="text-xs font-black uppercase tracking-widest italic text-gray-500">Chargement des données...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-20">
              <Package className="h-16 w-16" />
              <p className="text-sm font-black uppercase tracking-widest italic">Aucun produit sous seuil critique</p>
              <p className="text-xs font-bold text-gray-400">Tous les stocks sont suffisants.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-left">
                    <th className="px-8 py-5 w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll} className="rounded border-gray-300 accent-emerald-600" />
                    </th>
                    <th className="px-8 py-5">Produit</th>
                    <th className="px-8 py-5">Catégorie</th>
                    <th className="px-8 py-5 text-center">Stock</th>
                    <th className="px-8 py-5 text-center">Seuil</th>
                    <th className="px-8 py-5 text-center">Ventes 30j</th>
                    <th className="px-8 py-5 text-center">Qté suggérée</th>
                    <th className="px-8 py-5 text-right">Prix Achat</th>
                    <th className="px-8 py-5 text-right">Coût estimé</th>
                    <th className="px-8 py-5">Fournisseur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.map(s => {
                    const checked = selectedIds.has(s.produitId)
                    return (
                      <tr key={s.produitId}
                        className={`group hover:bg-emerald-50/30 transition-colors cursor-pointer ${checked ? 'bg-emerald-50/50' : ''}`}
                        onClick={() => toggleSelect(s.produitId)}
                      >
                        <td className="px-8 py-5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleSelect(s.produitId)} className="rounded border-gray-300 accent-emerald-600" />
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-mono text-xs font-black text-emerald-600">{s.code}</p>
                          <p className="text-sm font-bold text-gray-800 uppercase tracking-tighter">{s.designation}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {s.categorie}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pctColor(s.stock, s.seuil)}`}
                                style={{ width: `${Math.min(100, (s.stock / Math.max(s.seuil, 1)) * 100)}%` }} />
                            </div>
                            <span className={`text-xs font-black w-8 text-right ${s.stock <= s.seuil ? 'text-rose-600' : 'text-gray-600'}`}>
                              {s.stock}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-sm font-bold text-gray-700">{s.seuil}</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-black">
                            {s.ventes30j}
                            <span className="text-[9px] font-bold text-blue-400">/30j</span>
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] rounded-lg bg-amber-100 text-amber-700 font-black px-3 py-1 text-sm">
                            {s.quantiteSuggeree}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm font-bold text-gray-700">{s.prixAchat.toLocaleString('fr-FR')}</span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="text-sm font-black text-gray-900">{s.coutEstime.toLocaleString('fr-FR')} F</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-gray-700">
                            {s.fournisseur?.nom || <span className="text-gray-300 italic">—</span>}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="bg-gray-50/50 px-8 py-6 border-t border-gray-100">
              <Pagination
                currentPage={rpPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={setRpPage}
              />
            </div>
          )}
        </div>

        {/* Generated confirmation */}
        {showGenerated && showGenerated.length > 0 && (
          <div className="rounded-[2rem] bg-white shadow-xl border border-emerald-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2.5">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
                    {showGenerated.length} bon(s) de commande créé(s)
                  </h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Consultez les dans Commandes Fournisseurs
                  </p>
                </div>
              </div>
              <button onClick={() => setShowGenerated(null)}
                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest">
                ✕ Fermer
              </button>
            </div>
            <div className="space-y-2">
              {showGenerated.map((c: any) => (
                <div key={c.id}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-6 py-4 hover:bg-emerald-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-emerald-100 p-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <Link href={`/dashboard/commandes-fournisseurs`}
                        className="text-sm font-black text-emerald-700 hover:underline uppercase tracking-tighter"
                      >
                        {c.numero}
                      </Link>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {c.fournisseur?.nom || 'Sans fournisseur'} — {c.lignes?.length || 0} ligne(s)
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-gray-900">
                    {(c.montantTotal || 0).toLocaleString('fr-FR')} F
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-[2rem] bg-amber-50 border-2 border-amber-200 p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-100 p-2.5 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-800 uppercase tracking-tighter">
                {suggestions.length} produit(s) sous seuil
              </p>
              <p className="text-sm font-bold text-amber-700">
                Les quantités sont calculées à partir des ventes des 30 derniers jours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
