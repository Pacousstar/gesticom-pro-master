'use client'

import { useState, useEffect } from 'react'
import { Archive, Plus, Loader2, Trash2, Eye, Search, Filter, FileSpreadsheet, X, ShoppingCart } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/lib/format-date'
import Pagination from '@/components/ui/Pagination'

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
  const { success: showSuccess, error: showError } = useToast()

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
    produitId: '', quantite: '1', prixUnitaire: '', tva: '', remise: '', recherche: ''
  })

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
    const remise = Number(ajoutProduit.remise) || 0
    const p = produits.find(x => x.id === pid)
    if (!pid && !ajoutProduit.recherche) return
    const designation = p?.designation || ajoutProduit.recherche
    if (!designation) return
    setFormData(f => ({
      ...f,
      lignes: [...f.lignes, { produitId: pid || 0, designation, quantite: q, prixUnitaire: pu, tva, remise }]
    }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', tva: '', remise: '', recherche: '' })
  }

  const total = formData.lignes.reduce((acc, l) => {
    const ht = l.quantite * l.prixUnitaire
    const ttc = ht * (1 + (l.tva || 0) / 100) - (l.remise || 0)
    return acc + ttc
  }, 0)

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
      v.magasin?.nom?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Archive className="h-8 w-8" />
            Anciennes Ventes
          </h1>
          <p className="mt-1 text-white/80 text-sm">
            📋 Ventes/Factures antérieures à GestiCom — <span className="font-semibold text-emerald-300">Enregistrement authentique avec impact sur le stock, les soldes et la comptabilité.</span>
          </p>
        </div>
        <button
          onClick={() => setForm(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 shadow"
        >
          <Plus className="h-4 w-4" /> Ancienne vente
        </button>
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">Du</label>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Au</label>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Client</label>
          <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)}
            className="mt-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm min-w-[150px]">
            <option value="">Tous les clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <button onClick={() => { setCurrentPage(1); fetchVentes(1); }}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600">
          <Filter className="h-4 w-4 inline mr-1" />Filtrer
        </button>
        <button onClick={() => { setDateDebut(''); setDateFin(''); setFilterClientId(''); setCurrentPage(1); fetchVentes(1); }}
          className="rounded-lg border-2 border-amber-400 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200">
          Réinitialiser
        </button>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher par N°, client, magasin..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none shadow-sm" />
      </div>

      {/* Encart d'alerte */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-3">
        <Archive className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-500" />
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
                        return p.designation.toLowerCase().includes(s) || p.code.toLowerCase().includes(s)
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
                <input type="number" min="0" placeholder="Remise F" value={ajoutProduit.remise}
                  onChange={e => setAjoutProduit(a => ({ ...a, remise: e.target.value }))}
                  className="w-20 rounded border border-gray-200 px-2 py-2 text-sm focus:border-amber-500 focus:outline-none" />
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
                        const ttc = (l.quantite * l.prixUnitaire) * (1 + (l.tva || 0) / 100) - (l.remise || 0)
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2">{l.designation}</td>
                            <td className="text-right">{l.quantite}</td>
                            <td className="text-right">{l.prixUnitaire.toLocaleString('fr-FR')} F</td>
                            <td className="text-right">{l.tva || 0}%</td>
                            <td className="text-right text-red-500">{l.remise ? `-${l.remise} F` : '—'}</td>
                            <td className="text-right font-medium">{Math.round(ttc).toLocaleString('fr-FR')} F</td>
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
              <p><strong>Date :</strong> {formatDate(detailVente.date)}</p>
              <p><strong>Client :</strong> {detailVente.client?.nom || detailVente.clientLibre || '—'}</p>
              <p><strong>Magasin :</strong> {detailVente.magasin?.code}</p>
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
    </div>
  )
}
