'use client'

import { useState, useEffect } from 'react'
import { Archive, Plus, Loader2, Trash2, Search, Filter, X, Printer, ShoppingBag, Wallet, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { paginateForPrint } from '@/lib/print-helpers'
import { formatDate } from '@/lib/format-date'
import { montantLigneTTC } from '@/lib/calculs-commerciaux'

type Client = { id: number; nom: string }
type Magasin = { id: number; code: string; nom: string }
type Produit = { id: number; code: string; designation: string; prixVente?: number | null }
type Ligne = { produitId: number; designation: string; quantite: number; prixUnitaire: number; tva?: number; remise?: number }

const LABEL_HISTORIQUE = 'ANCIEN-'

export default function AnciennesVentesPage() {
  const [ventes, setVentes] = useState<any[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [detailVente, setDetailVente] = useState<any | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<any | null>(null)
  const [totals, setTotals] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [allVentesForPrint, setAllVentesForPrint] = useState<any[]>([])
  const { success: showSuccess, error: showError } = useToast()
  const pathname = usePathname()
  const router = useRouter()

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    magasinId: '',
    clientId: '',
    clientLibre: '',
    modePaiement: 'ESPECES',
    observation: '',
    lignes: [] as Ligne[],
  })
  const [ajoutProduit, setAjoutProduit] = useState({
    produitId: '', quantite: '1', prixUnitaire: '', tva: '', remise: '', remiseType: 'MONTANT' as 'MONTANT' | 'POURCENT', recherche: ''
  })

  const kpiTotals = {
    total: pagination?.total || ventes.length,
    montantTotal: totals?.montantTotal || ventes.reduce((s, v) => s + Number(v.montantTotal || 0), 0),
    montantPaye: totals?.montantPaye || ventes.reduce((s, v) => s + Number(v.montantPaye || 0), 0),
    reste: (totals?.montantTotal || ventes.reduce((s, v) => s + Number(v.montantTotal || 0), 0)) - (totals?.montantPaye || ventes.reduce((s, v) => s + Number(v.montantPaye || 0), 0)),
  }

  const fetchVentes = (page?: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page ?? currentPage), limit: '20' })
    if (dateDebut) params.set('dateDebut', dateDebut)
    if (dateFin) params.set('dateFin', dateFin)
    if (filterClientId) params.set('clientId', filterClientId)
    fetch('/api/ventes-historiques?' + params.toString())
      .then((r) => (r.ok ? r.json() : { data: [], pagination: null, totals: null }))
      .then((response) => {
        setVentes(response.data || [])
        setPagination(response.pagination || null)
        setTotals(response.totals || null)
      })
      .finally(() => setLoading(false))
  }

  const handlePrintAll = async () => {
    setIsPrinting(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '10000' })
      if (dateDebut) params.set('dateDebut', dateDebut)
      if (dateFin) params.set('dateFin', dateFin)
      if (filterClientId) params.set('clientId', filterClientId)
      const res = await fetch('/api/ventes-historiques?' + params.toString())
      if (res.ok) {
        const d = await res.json()
        setAllVentesForPrint(d.data || [])
        setTimeout(() => { window.print(); setIsPrinting(false) }, 500)
      } else {
        setIsPrinting(false)
      }
    } catch (e) {
      console.error(e)
      setIsPrinting(false)
    }
  }

  useEffect(() => {
    fetchVentes()
  }, [currentPage])

  useEffect(() => {
    Promise.all([
      fetch('/api/magasins').then(r => r.ok ? r.json() : []),
      fetch('/api/clients').then(async r => {
        if (!r.ok) return []
        const d = await r.json()
        return Array.isArray(d) ? d : (d.data || [])
      }),
      fetch('/api/produits?complet=1').then(async r => {
        if (!r.ok) return []
        const d = await r.json()
        return Array.isArray(d) ? d : (d.data || [])
      }),
    ]).then(([m, c, p]) => {
      setMagasins(Array.isArray(m) ? m : [])
      setClients(Array.isArray(c) ? c : [])
      setProduits(Array.isArray(p) ? p : [])
    })
  }, [])

  const addLigne = () => {
    const pid = Number(ajoutProduit.produitId)
    const q = Math.max(1, Number(ajoutProduit.quantite) || 1)
    const pu = Math.max(0, Number(ajoutProduit.prixUnitaire) || 0)
    const tva = Number(ajoutProduit.tva) || 0
    let remise = Number(ajoutProduit.remise) || 0
    if (ajoutProduit.remiseType === 'POURCENT' && remise > 0) {
      remise = Math.round((q * pu) * remise / 100)
    }
    const p = produits.find(x => x.id === pid)
    if (!pid && !ajoutProduit.recherche) return
    const designation = p?.designation || ajoutProduit.recherche
    if (!designation) return
    setFormData(f => ({
      ...f,
      lignes: [...f.lignes, { produitId: pid || 0, designation, quantite: q, prixUnitaire: pu, tva, remise }]
    }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tva: '', remise: '', remiseType: 'MONTANT', recherche: '' })
  }

  const total = formData.lignes.reduce(
    (acc, l) =>
      acc +
      montantLigneTTC({
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        remiseLigne: Number(l.remise) || 0,
        tvaPourcent: l.tva || 0,
      }),
    0
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.magasinId) { showError('Choisissez un magasin.'); return }
    if (!formData.lignes.length) { showError('Ajoutez au moins une ligne.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/ventes-historiques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          magasinId: Number(formData.magasinId),
          clientId: formData.clientId ? Number(formData.clientId) : null,
          clientLibre: formData.clientLibre.trim() || null,
          modePaiement: formData.modePaiement,
          observation: formData.observation || null,
          lignes: formData.lignes,
        }),
      })
      if (res.ok) {
        showSuccess('Ancienne vente enregistrée avec succès (Impact stock et comptabilité).')
        setForm(false)
        setFormData({
          date: new Date().toISOString().split('T')[0],
          magasinId: '',
          clientId: '',
          clientLibre: '',
          modePaiement: 'ESPECES',
          observation: '',
          lignes: [],
        })
        fetchVentes(1)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de l\'enregistrement.')
      }
    } catch {
      showError('Erreur réseau.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredVentes = ventes.filter(v => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      v.numero?.toLowerCase().includes(s) ||
      v.client?.nom?.toLowerCase().includes(s) ||
      v.clientLibre?.toLowerCase().includes(s) ||
      (v.magasin?.nom?.toLowerCase().includes(s) || false) ||
      (v.magasinId?.toString().includes(s) || false)
    )
  })

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Anciennes Ventes</h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Ventes et factures antérieures à GestiCom</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={isPrinting}
            className="no-print flex items-center gap-2 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
            title="Imprimer la liste des anciennes ventes"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'Préparation...' : 'Imprimer'}
          </button>
          <button
            onClick={() => setForm(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 shadow-md transition-all"
          >
            <Plus className="h-4 w-4" /> Ancienne vente
          </button>
        </div>
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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 no-print">
        {[
          { label: "Total ventes", val: kpiTotals.total.toString(), icon: Archive, color: "bg-indigo-600" },
          { label: "Montant total", val: `${kpiTotals.montantTotal.toLocaleString('fr-FR')} F`, icon: ShoppingBag, color: "bg-emerald-600" },
          { label: "Encaissé", val: `${kpiTotals.montantPaye.toLocaleString('fr-FR')} F`, icon: Wallet, color: "bg-blue-600" },
          { label: "Reste à encaisser", val: `${kpiTotals.reste.toLocaleString('fr-FR')} F`, icon: AlertTriangle, color: "bg-amber-600" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-[2rem] ${c.color} p-6 h-32 shadow-xl group`}>
            <div className="relative z-10 text-white flex flex-col justify-between h-full">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{c.label}</p>
              <div>
                <h3 className="text-2xl font-black tracking-tighter">{c.val}</h3>
              </div>
            </div>
            <c.icon className="absolute right-4 bottom-4 h-12 w-12 text-white opacity-10 group-hover:scale-110 transition-transform" />
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 no-print">
        <div>
          <label className="block text-xs font-medium text-gray-700">Du</label>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            className="mt-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Au</label>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            className="mt-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Client</label>
          <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)}
            className="mt-1 rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm min-w-[150px]">
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <button onClick={() => { setCurrentPage(1); fetchVentes(1); }}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-orange-600 shadow-md flex items-center gap-1">
          <Filter className="h-4 w-4" />Filtrer
        </button>
        <button onClick={() => { setDateDebut(''); setDateFin(''); setFilterClientId(''); setCurrentPage(1); fetchVentes(1); }}
          className="rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 shadow-sm">
          Réinitialiser
        </button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher par N°, client, magasin..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none shadow-sm" />
      </div>

      {/* Encart d'alerte */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
        <Archive className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-500" />
        <span>
          <strong>Note :</strong> Les enregistrements dans ce menu <strong>impactent le stock et la comptabilité</strong>.
          Ils servent à rattraper les ventes/factures existantes avant l'adoption de GestiCom tout en maintenant l'intégrité de vos comptes.
        </span>
      </div>

      {/* Formulaire Nouvelle ancienne vente */}
      {form && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-600" />
            Enregistrer une ancienne vente/facture
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date de la vente *</label>
                <input type="date" required value={formData.date}
                  onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Magasin *</label>
                <select required value={formData.magasinId}
                  onChange={e => setFormData(f => ({ ...f, magasinId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none">
                  <option value="">—</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.code} – {m.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Client *</label>
                <select required value={formData.clientId}
                  onChange={e => setFormData(f => ({ ...f, clientId: e.target.value, clientLibre: '' }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none">
                  <option value="">—</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mode de paiement</label>
                <select value={formData.modePaiement}
                  onChange={e => setFormData(f => ({ ...f, modePaiement: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none">
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CREDIT">Crédit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Observation</label>
                <input value={formData.observation}
                  onChange={e => setFormData(f => ({ ...f, observation: e.target.value }))}
                  placeholder="Numéro facture, référence..."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-500 focus:outline-none" />
              </div>
            </div>

            {/* Lignes */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Lignes de produits</h3>
              <div className="mb-3 flex flex-wrap gap-2 items-center relative z-10">
                <div className="relative flex-1 min-w-[300px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Rechercher un produit (code ou nom)..."
                    value={ajoutProduit.recherche} onChange={e => setAjoutProduit(a => ({ ...a, recherche: e.target.value, produitId: '' }))}
                    className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none shadow-sm" />
                  {ajoutProduit.recherche.length > 0 && !ajoutProduit.produitId && (
                    <div className="absolute top-full left-0 mt-1 z-50 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
                      {produits.filter(p => {
                        const s = ajoutProduit.recherche.toLowerCase()
                        return p && p.id && (p.designation?.toLowerCase().includes(s) || p.code?.toLowerCase().includes(s))
                      }).map(p => (
                        <button key={p.id} type="button" 
                          onClick={() => setAjoutProduit(a => ({ ...a, produitId: String(p.id), recherche: p.designation, prixUnitaire: String(p.prixVente || '') }))}
                          className="w-full px-4 py-2 text-left hover:bg-amber-50 text-sm border-b last:border-b-0 transition-colors">
                          <span className="font-semibold text-gray-900">{p.designation}</span> <span className="text-gray-400 font-mono text-xs ml-2">{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {ajoutProduit.produitId && (
                    <button type="button" onClick={() => setAjoutProduit(a => ({ ...a, produitId: '', recherche: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold px-2">✕</button>
                  )}
                </div>
                
                <input type="number" min="1" placeholder="Qté" value={ajoutProduit.quantite}
                  onChange={e => setAjoutProduit(a => ({ ...a, quantite: e.target.value }))}
                  className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                <input type="number" min="0" placeholder="P.U." value={ajoutProduit.prixUnitaire}
                  onChange={e => setAjoutProduit(a => ({ ...a, prixUnitaire: e.target.value }))}
                  className="w-24 rounded border border-gray-200 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                <input type="number" min="0" placeholder="TVA %" value={ajoutProduit.tva}
                  onChange={e => setAjoutProduit(a => ({ ...a, tva: e.target.value }))}
                  className="w-16 rounded border border-gray-200 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none bg-amber-50/50" />
                <div className="flex items-center">
                  <input type="number" min="0" placeholder="Remise" value={ajoutProduit.remise}
                    onChange={e => setAjoutProduit(a => ({ ...a, remise: e.target.value }))}
                    className="w-16 rounded-l border border-gray-200 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none" />
                  <button type="button"
                    onClick={() => setAjoutProduit(a => ({ ...a, remiseType: a.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT' }))}
                    className={`px-2 py-2 border border-l-0 border-gray-200 text-xs font-bold rounded-r transition-colors ${ajoutProduit.remiseType === 'POURCENT' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {ajoutProduit.remiseType === 'MONTANT' ? 'F' : '%'}
                  </button>
                </div>
                <button type="button" onClick={addLigne}
                  disabled={!ajoutProduit.produitId}
                  className="rounded-lg border-2 border-amber-400 bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  Ajouter
                </button>
              </div>
              {formData.lignes.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-600">
                        <th className="pb-2">Désignation</th>
                        <th className="pb-2 text-right">Qté</th>
                        <th className="pb-2 text-right">P.U.</th>
                        <th className="pb-2 text-right">TVA</th>
                        <th className="pb-2 text-right text-red-500">Remise</th>
                        <th className="pb-2 text-right">TTC</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lignes.map((l, i) => {
                        const ttc = montantLigneTTC({
                          quantite: l.quantite,
                          prixUnitaire: l.prixUnitaire,
                          remiseLigne: Number(l.remise) || 0,
                          tvaPourcent: l.tva || 0,
                        })
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2">{l.designation}</td>
                            <td className="text-right">{l.quantite}</td>
                            <td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{l.tva || 0}%</td>
                            <td className="text-right text-red-500">{l.remise ? `-${l.remise} F` : '—'}</td>
                            <td className="text-right font-medium">{ttc.toLocaleString('fr-FR')} F</td>
                            <td>
                              <button type="button" onClick={() => setFormData(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }))}
                                className="rounded p-1 text-red-600 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="mt-3 text-right text-base font-bold text-gray-900">
                    Total TTC : {Math.round(total).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 shadow-md transition-all">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Valider l'enregistrement
              </button>
              <button type="button" onClick={() => setForm(false)}
                className="rounded-lg border-2 border-gray-400 bg-gray-200 px-4 py-2 font-medium text-gray-900 hover:bg-gray-300">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* La liste des 149 anciennes ventes a été masquée selon la demande. */}

      {/* Détail vente */}
      {detailVente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailVente(null)}>
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Détail — {detailVente.numero}</h3>
              <button onClick={() => setDetailVente(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              ✅ Enregistrement validé — Impact stock et comptabilité effectué.
            </p>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Date :</strong> {formatDate(detailVente.date, { includeTime: true })}</p>
              <p><strong>Client :</strong> {detailVente.client?.nom || detailVente.clientLibre || '—'}</p>
              <p><strong>Magasin :</strong> {(detailVente.magasin as any)?.code || detailVente.magasinId || '—'}</p>
              <p><strong>Paiement :</strong> {detailVente.modePaiement}</p>
              {detailVente.observation && <p><strong>Observation :</strong> {detailVente.observation}</p>}
            </div>
            {detailVente.lignes?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-1">Désignation</th>
                      <th className="pb-1 text-right">Qté</th>
                      <th className="pb-1 text-right">P.U.</th>
                      <th className="pb-1 text-right">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailVente.lignes.map((l: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1">{l.designation}</td>
                        <td className="text-right">{l.quantite}</td>
                        <td className="text-right">{Number(l.prixUnitaire).toLocaleString('fr-FR')} F</td>
                        <td className="text-right font-medium">{Number(l.montant).toLocaleString('fr-FR')} F</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-right font-bold text-gray-900">
                  Total : {Number(detailVente.montantTotal).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* RENDU IMPRESSION */}
      <div className="hidden print:block">
        {(() => {
          if (!allVentesForPrint.length) return null
          const today = new Date().toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric'
          })
          const pages = paginateForPrint(allVentesForPrint, { otherPagesSize: 20 })
          return pages.map((pageData, pageIdx) => (
            <div key={pageIdx} className="print-page">
              <ListPrintWrapper
                title="Anciennes Ventes"
                subtitle={`GestiCom Pro • ${today}`}
                pageNumber={pageIdx + 1}
                totalPages={pages.length}
              >
                <table className="min-w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-1 text-left">N°</th>
                      <th className="border p-1 text-left">Date</th>
                      <th className="border p-1 text-left">Client</th>
                      <th className="border p-1 text-left">Magasin</th>
                      <th className="border p-1 text-right">Montant</th>
                      <th className="border p-1 text-left">Paiement</th>
                      <th className="border p-1 text-left">Statut</th>
                      <th className="border p-1 text-right">Payé</th>
                      <th className="border p-1 text-right">Reste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((v: any) => {
                      const rp = Math.max(0, Number(v.montantTotal) - (Number(v.montantPaye) || 0))
                      return (
                        <tr key={v.id || v.numero}>
                          <td className="border p-1">{v.numero}</td>
                          <td className="border p-1">{formatDate(v.date, { includeTime: false })}</td>
                          <td className="border p-1">{v.client?.nom || v.clientLibre || '—'}</td>
                          <td className="border p-1">{(v.magasin as any)?.code || v.magasinId || '—'}</td>
                          <td className="border p-1 text-right">{Number(v.montantTotal).toLocaleString('fr-FR')} F</td>
                          <td className="border p-1">{v.modePaiement}</td>
                          <td className="border p-1">{v.statutPaiement === 'PAYE' ? 'Payé' : v.statutPaiement === 'PARTIEL' ? 'Partiel' : 'Crédit'}</td>
                          <td className="border p-1 text-right">{(v.montantPaye || 0).toLocaleString('fr-FR')} F</td>
                          <td className="border p-1 text-right">{rp > 0 ? rp.toLocaleString('fr-FR') + ' F' : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ListPrintWrapper>
            </div>
          ))
        })()}
      </div>
    </div>
    </>
  )
}
