'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Search, ArrowLeft, RotateCcw, DollarSign, Calendar, FileText, X } from 'lucide-react'

type RetourLigne = {
  id: number
  produitId: number
  designation: string
  quantite: number
  prixUnitaire: number
  montant: number
  produit: { code: string; designation: string } | null
}

type Retour = {
  id: number
  numero: string
  date: string
  motif: string
  montantTotal: number
  vente: { id: number; numero: string }
  client: { id: number; nom: string } | null
  magasin: { id: number; nom: string }
  utilisateur: { nom: string } | null
  lignes: RetourLigne[]
  createdAt: string
}

export default function RetoursPage() {
  const router = useRouter()
  const pathname = usePathname()

  const [retours, setRetours] = useState<Retour[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedRetour, setSelectedRetour] = useState<Retour | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const fetchRetours = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/retours?page=${page}&limit=30`)
      const data = await res.json()
      setRetours(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch {
      console.error('Erreur chargement retours')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchRetours() }, [fetchRetours])

  const filtered = retours.filter(r => {
    if (dateDebut && r.date < dateDebut) return false
    if (dateFin && r.date > dateFin) return false
    const q = search.toLowerCase()
    if (!q) return true
    return r.numero.toLowerCase().includes(q) || r.vente.numero.toLowerCase().includes(q) || (r.client?.nom || '').toLowerCase().includes(q) || (r.motif || '').toLowerCase().includes(q)
  })

  const stats = {
    total: retours.length,
    montantTotal: retours.reduce((s, r) => s + r.montantTotal, 0),
    produitsRetournes: retours.reduce((s, r) => s + r.lignes.reduce((s2, l) => s2 + l.quantite, 0), 0),
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Retours</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Gestion des retours clients</p>
        </div>
        <button onClick={() => router.push('/dashboard/ventes')}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 border border-white/20">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
      </div>

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

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 no-print">
        {[
          { label: "Total retours", val: stats.total.toString(), icon: RotateCcw, color: "bg-indigo-600", sub: "Nombre de retours" },
          { label: "Montant total retourné", val: `${stats.montantTotal.toLocaleString('fr-FR')} F`, icon: DollarSign, color: "bg-amber-600", sub: "Valeur retournée" },
          { label: "Produits retournés", val: stats.produitsRetournes.toString(), icon: FileText, color: "bg-blue-600", sub: "Articles retournés" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl group`}>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center rounded-xl border border-gray-200 bg-gray-50 p-3 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par n° retour, facture ou client..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm"
          />
        </div>
        <div>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
        <div>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <RotateCcw className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">Aucun retour trouvé</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">N° retour</th>
                  <th className="text-left px-4 py-3 font-semibold">Facture</th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Motif</th>
                  <th className="text-right px-4 py-3 font-semibold">Montant</th>
                  <th className="text-center px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{r.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{r.vente.numero}</td>
                    <td className="px-4 py-3 text-gray-700">{r.client?.nom || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.date).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{r.motif || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.montantTotal.toLocaleString('fr-FR')} F</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setSelectedRetour(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-sm">
                        <FileText className="h-3.5 w-3.5" /> Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${
                page === p
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 shadow-sm'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>

      {selectedRetour && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRetour(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-rose-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <RotateCcw className="h-5 w-5" /> Retour {selectedRetour.numero}
              </h2>
              <button onClick={() => setSelectedRetour(null)} className="rounded-lg hover:bg-white/20 p-1.5 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Facture</p>
                  <p className="font-medium text-gray-900">{selectedRetour.vente.numero}</p>
                </div>
                <div>
                  <p className="text-gray-500">Client</p>
                  <p className="font-medium text-gray-900">{selectedRetour.client?.nom || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium text-gray-900">{new Date(selectedRetour.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Magasin</p>
                  <p className="font-medium text-gray-900">{selectedRetour.magasin.nom}</p>
                </div>
              </div>
              {selectedRetour.motif && (
                <div>
                  <p className="text-sm text-gray-500">Motif</p>
                  <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-2.5 mt-1">{selectedRetour.motif}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Produits retournés</p>
                <div className="space-y-2">
                  {selectedRetour.lignes.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{l.produit?.designation || l.designation}</p>
                        <p className="text-xs text-gray-500">{l.prixUnitaire.toLocaleString('fr-FR')} F / unité</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">x{l.quantite}</p>
                        <p className="text-xs text-gray-600">{l.montant.toLocaleString('fr-FR')} F</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-rose-800">Total retourné</span>
                <span className="text-lg font-bold text-rose-900">{selectedRetour.montantTotal.toLocaleString('fr-FR')} F</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
