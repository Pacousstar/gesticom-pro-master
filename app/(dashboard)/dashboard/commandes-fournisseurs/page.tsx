'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingBag, Plus, Loader2, Trash2, Eye, FileSpreadsheet, Printer, X,
  Search, Scan, Camera, Edit2, Pencil, Trash, CreditCard, Wallet, UserPlus,
  AlertTriangle, Calculator, FileText, ChevronRight, HelpCircle, XCircle, ShoppingCart, Percent,
  CheckCircle2, ArrowRightLeft, Truck
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { MESSAGES } from '@/lib/messages'
import Pagination from '@/components/ui/Pagination'
import { printDocument, generateLignesHTML, type TemplateData } from '@/lib/print-templates'
import PrintPreview from '@/components/print/PrintPreview'
import { fournisseurSchema } from '@/lib/validations'
import { validateForm } from '@/lib/validation-helpers'

type Magasin = { id: number; code: string; nom: string }
type Fournisseur = { id: number; nom: string; telephone?: string; localisation?: string; ncc?: string }
type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  categorie?: string; 
  prixAchat: number | null;
  stocks: Array<{ magasinId: number; quantite: number }>;
}
type Ligne = { produitId: number; designation: string; quantite: number; prixUnitaire: number; montant: number }

export default function CommandesFournisseursPage() {
  const [magasins, setMagasins] = useState<Magasin[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [commandes, setCommandes] = useState<Array<{
    id: number
    numero: string
    date: string
    montantTotal: number
    statut: string
    observation?: string
    magasin: { code: string, nom: string }
    fournisseur: { nom: string, telephone?: string, localisation?: string, ncc?: string } | null
    fournisseurLibre: string | null
    lignes: Ligne[]
  }>>([])
  
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const { success: showSuccess, error: showError } = useToast()
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null)
  
  const [detailCommande, setDetailCommande] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
  const [transforming, setTransforming] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [printData, setPrintData] = useState<TemplateData | null>(null)
  const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null)
  
  const [showCreateFournisseur, setShowCreateFournisseur] = useState(false)
  const [fournisseurForm, setFournisseurForm] = useState({
    nom: '',
    telephone: '',
    email: '',
    soldeInitial: '',
    avoirInitial: ''
  })
  const [savingFournisseur, setSavingFournisseur] = useState(false)

  useEffect(() => {
    fetch('/api/print-templates?type=BON_COMMANDE&actif=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((templates: any[]) => {
        const active = templates.find(t => t.actif)
        if (active) setDefaultTemplateId(active.id)
      })
  }, [])

  const handleEdit = (c: any) => {
    setEditingId(c.id)
    setFormData({
      date: new Date(c.date).toLocaleDateString('en-CA'),
      magasinId: String(c.magasinId),
      fournisseurId: String(c.fournisseurId || ''),
      fournisseurLibre: c.fournisseurLibre || '',
      observation: c.observation || '',
      lignes: c.lignes.map((l: any) => ({
        produitId: l.produitId,
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montant: l.quantite * l.prixUnitaire
      }))
    })
    setFormFournisseurSearch(c.fournisseur?.nom || '')
    setForm(true)
    setDetailCommande(null)
  }

  const imprimerCommande = (c: any) => {
    const templateData: TemplateData = {
      NUMERO: c.numero,
      DATE: new Date(c.date).toLocaleDateString('fr-FR'),
      HEURE: new Date(c.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      MAGASIN_CODE: c.magasin.code,
      MAGASIN_NOM: c.magasin.nom,
      FOURNISSEUR_NOM: c.fournisseur?.nom || c.fournisseurLibre || 'Client Libre',
      FOURNISSEUR_TELEPHONE: c.fournisseur?.telephone || undefined,
      CLIENT_NOM: c.fournisseur?.nom || c.fournisseurLibre || 'Client Libre',
      CLIENT_CONTACT: c.fournisseur?.telephone || undefined,
      CLIENT_LOCALISATION: c.fournisseur?.localisation || undefined,
      CLIENT_NCC: c.fournisseur?.ncc || undefined,
      LIGNES: generateLignesHTML(c.lignes),
      TOTAL: `${c.montantTotal.toLocaleString()} FCFA`,
      OBSERVATION: c.observation || undefined,
    }
    setPrintData(templateData)
    setPrintPreviewOpen(true)
  }

  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA'),
    magasinId: '',
    fournisseurId: '',
    fournisseurLibre: '',
    observation: '',
    lignes: [] as Ligne[],
  })

  const [ajoutProduit, setAjoutProduit] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    recherche: ''
  })

  const [formFournisseurSearch, setFormFournisseurSearch] = useState('')
  const [showFournisseurList, setShowFournisseurList] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/magasins').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/fournisseurs?limit=1000').then((r) => (r.ok ? r.json() : { data: [] })).then((res) => setFournisseurs(Array.isArray(res) ? res : res.data || [])),
      fetch('/api/produits?complet=1').then((r) => (r.ok ? r.json() : [])).then((res) => setProduits(Array.isArray(res) ? res : [])),
    ]).then(([m]) => {
      setMagasins(m)
    })
    fetchCommandes()
  }, [])

  const handleCreateFournisseur = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingFournisseur(true)
    setErr('')

    const validationData = {
      nom: fournisseurForm.nom.trim(),
      telephone: fournisseurForm.telephone.trim() || null,
      email: fournisseurForm.email.trim() || null,
      ncc: null,
    }

    const validation = validateForm(fournisseurSchema, validationData)
    if (!validation.success) {
      setErr(validation.error)
      showError(validation.error)
      setSavingFournisseur(false)
      return
    }

    try {
      const res = await fetch('/api/fournisseurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validationData,
          soldeInitial: Number(fournisseurForm.soldeInitial) || 0,
          avoirInitial: Number(fournisseurForm.avoirInitial) || 0,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowCreateFournisseur(false)
        setFournisseurs((prev) => [...prev, data])
        setFormData((f) => ({ ...f, fournisseurId: String(data.id) }))
        setFormFournisseurSearch(data.nom)
        setFournisseurForm({
          nom: '',
          telephone: '',
          email: '',
          soldeInitial: '',
          avoirInitial: ''
        })
        showSuccess('Fournisseur créé avec succès.')
      } else {
        const errorMsg = formatApiError(data.error || 'Erreur lors de la création.')
        setErr(errorMsg)
        showError(errorMsg)
      }
    } catch (e) {
      const errorMsg = formatApiError(e)
      setErr(errorMsg)
      showError(errorMsg)
    } finally {
      setSavingFournisseur(false)
    }
  }

  const fetchCommandes = (page?: number) => {
    setLoading(true)
    const p = page ?? currentPage
    fetch(`/api/commandes-fournisseurs?page=${p}&limit=20`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        setCommandes(res.data)
        setPagination(res.pagination)
      })
      .finally(() => setLoading(false))
  }

  const addLigne = () => {
    const pid = Number(ajoutProduit.produitId)
    const p = produits.find((x) => x.id === pid)
    if (!p) return
    const qte = Number(ajoutProduit.quantite) || 0
    const pu = Number(ajoutProduit.prixUnitaire) || 0
    if (qte <= 0) return

    setFormData((f) => ({
      ...f,
      lignes: [...f.lignes, {
        produitId: p.id,
        designation: p.designation,
        quantite: qte,
        prixUnitaire: pu,
        montant: qte * pu
      }]
    }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', recherche: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.magasinId || !formData.lignes.length) {
      showError('Magasin et articles requis.')
      return
    }
    setSubmitting(true)
    try {
      const url = editingId ? `/api/commandes-fournisseurs/${editingId}` : '/api/commandes-fournisseurs'
      const method = editingId ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          montantTotal: formData.lignes.reduce((acc, l) => acc + l.montant, 0)
        })
      })
      
      if (res.ok) {
        showSuccess(editingId ? 'Bon de commande modifié.' : 'Bon de commande créé.')
        setForm(false)
        setEditingId(null)
        setFormData({
          date: new Date().toLocaleDateString('en-CA'),
          magasinId: '',
          fournisseurId: '',
          fournisseurLibre: '',
          observation: '',
          lignes: [],
        })
        setFormFournisseurSearch('')
        fetchCommandes(1)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de l\'enregistrement.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleTransformer = async (id: number) => {
    if (!confirm('Voulez-vous transformer ce bon de commande en achat réel ? Cela augmentera vos stocks.')) return
    setTransforming(id)
    try {
      const res = await fetch(`/api/commandes-fournisseurs/${id}/transformer-en-achat`, { method: 'POST' })
      if (res.ok) {
        showSuccess('Commande transformée en achat avec succès.')
        fetchCommandes()
        setDetailCommande(null)
      } else {
        const d = await res.json()
        showError(d.error || 'Erreur lors de la transformation.')
      }
    } finally {
      setTransforming(null)
    }
  }

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'BROUILLON': return 'bg-gray-100 text-gray-800'
      case 'ENVOYEE': return 'bg-blue-100 text-blue-800'
      case 'RECUE': return 'bg-emerald-100 text-emerald-800'
      case 'ANNULEE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3 italic">
             <Truck className="h-8 w-8 text-orange-400" />
             Bons de Commande
          </h1>
          <p className="mt-1 text-white/80 font-bold uppercase text-[10px] tracking-widest">Flux d'approvisionnements et intentions d'achat</p>
        </div>
        <button
          onClick={() => setForm(true)}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700 shadow-lg transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          NOUVEAU BON DE COMMANDE
        </button>
      </div>

      {form && (
        <div className="rounded-xl border border-orange-200 bg-white p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Modifier' : 'Nouveau'} Bon de Commande</h2>
            <button onClick={() => { setForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600"><X /></button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Magasin de réception</label>
                <select
                  required
                  value={formData.magasinId}
                  onChange={(e) => setFormData(f => ({ ...f, magasinId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <option value="">Choisir...</option>
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <div className="relative">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Fournisseur (Précis)</label>
                  <div className="relative group flex items-center gap-2">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Chercher fournisseur par nom..."
                        value={formFournisseurSearch}
                        onFocus={() => setShowFournisseurList(true)}
                        onChange={(e) => {
                          setFormFournisseurSearch(e.target.value)
                          if (!e.target.value) setFormData(f => ({ ...f, fournisseurId: '' }))
                        }}
                        onBlur={() => setTimeout(() => setShowFournisseurList(false), 200)}
                        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm font-bold text-slate-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                      />
                      {formData.fournisseurId && (
                        <button 
                          type="button"
                          onClick={() => { setFormData(f => ({ ...f, fournisseurId: '' })); setFormFournisseurSearch('') }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 bg-white px-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateFournisseur(true)}
                      className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm"
                      title="Nouveau Fournisseur"
                    >
                      <UserPlus className="h-5 w-5" />
                    </button>
                  </div>
                {showFournisseurList && (
                  <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-1">
                    <div className="sticky top-0 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600 uppercase mb-1 rounded">
                      {formFournisseurSearch ? 'Résultats de recherche' : 'Tous les fournisseurs'}
                    </div>
                    {fournisseurs
                      .filter(f => f.nom.toLowerCase().includes(formFournisseurSearch.toLowerCase()))
                      .map(f => (
                        <div
                          key={f.id}
                          className="cursor-pointer px-4 py-3 text-sm hover:bg-orange-50 font-bold text-slate-900 border-b border-gray-50 last:border-0 transition-colors rounded-lg"
                          onClick={() => {
                            setFormData(fod => ({ ...fod, fournisseurId: String(f.id) }))
                            setFormFournisseurSearch(f.nom)
                            setShowFournisseurList(false)
                          }}
                        >
                          {f.nom}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="text-sm font-bold text-gray-600 uppercase mb-3">Articles à commander</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[250px]">
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                      <Search className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Chercher produit par Désignation ou Code..."
                      value={ajoutProduit.recherche || ''}
                      onChange={(e) => setAjoutProduit(a => ({ ...a, recherche: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none transition-all shadow-sm"
                    />
                    {ajoutProduit.recherche.length > 0 && !ajoutProduit.produitId && (
                      <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-1">
                        {produits
                          .filter(p => {
                            const search = ajoutProduit.recherche.toLowerCase()
                            return p.code.toLowerCase().includes(search) || p.designation.toLowerCase().includes(search)
                          })
                          .map((p) => {
                            const s = p.stocks?.find(st => st.magasinId === Number(formData.magasinId))?.quantite || 0
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setAjoutProduit(a => ({ ...a, produitId: String(p.id), recherche: p.designation, prixUnitaire: String(p.prixAchat || '') }))
                                }}
                                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-emerald-50 transition-all border-b border-gray-50 last:border-0 rounded-lg"
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 uppercase">{p.designation}</span>
                                  <span className="text-[10px] text-gray-400 font-mono italic">{p.code}</span>
                                </div>
                                <div className={`text-[10px] font-black px-2 py-1 rounded-full ${s > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  STOCK: {s}
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    )}
                    {ajoutProduit.produitId && (
                      <button 
                        onClick={() => setAjoutProduit(a => ({ ...a, produitId: '', recherche: '' }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="number"
                  placeholder="Qté"
                  className="w-24 rounded-lg border border-gray-200 px-3 py-2"
                  value={ajoutProduit.quantite}
                  onChange={(e) => setAjoutProduit(a => ({ ...a, quantite: e.target.value }))}
                />
                <input
                  type="number"
                  placeholder="Prix Achat"
                  className="w-32 rounded-lg border border-gray-200 px-3 py-2"
                  value={ajoutProduit.prixUnitaire}
                  onChange={(e) => setAjoutProduit(a => ({ ...a, prixUnitaire: e.target.value }))}
                />
                <button type="button" onClick={addLigne} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">Ajouter</button>
              </div>

              {formData.lignes.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2">Article</th>
                      <th className="py-2 text-right">Qté</th>
                      <th className="py-2 text-right">P.U</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lignes.map((l, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-2">{l.designation}</td>
                        <td className="py-2 text-right">{l.quantite}</td>
                        <td className="py-2 text-right">{l.prixUnitaire.toLocaleString()} F</td>
                        <td className="py-2 text-right font-bold">{l.montant.toLocaleString()} F</td>
                        <td>
                          <button type="button" onClick={() => setFormData(f => ({ ...f, lignes: f.lignes.filter((_, j) => j !== i) }))} className="text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-right font-bold py-4">TOTAL :</td>
                      <td className="text-right font-black text-lg text-emerald-700 py-4 underline">
                        {formData.lignes.reduce((acc, l) => acc + l.montant, 0).toLocaleString()} FCFA
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setForm(false)} className="px-6 py-2.5 font-bold text-gray-500">Annuler</button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-orange-600 px-10 py-2.5 font-bold text-white shadow-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" /> : 'ENREGISTRER LE BON DE COMMANDE'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white/80" />
          </div>
        ) : commandes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/80 italic">
            <FileText className="h-12 w-12 mb-3 opacity-30" />
            Aucun bon de commande trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/10 border-b border-white/20">
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic">Numéro BC</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic">Date Émission</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic">Fournisseur Destinataire</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic">Valeur Totale</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic">État</th>
                  <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest italic text-right">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {commandes.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 font-mono font-bold text-orange-400">{c.numero}</td>
                    <td className="px-6 py-4 text-sm text-white/80">{new Date(c.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-sm font-bold text-white">{c.fournisseur?.nom || 'Client Libre'}</td>
                    <td className="px-6 py-4 font-black text-white">{c.montantTotal.toLocaleString()} F</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${getStatutColor(c.statut)}`}>
                        {c.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setDetailCommande(c)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                          title="Voir Détails"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-2 rounded-lg bg-white/10 text-blue-400 hover:bg-white/20 transition-all"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {c.statut !== 'RECUE' && c.statut !== 'ANNULEE' && (
                          <button
                            onClick={() => handleTransformer(c.id)}
                            disabled={transforming === c.id}
                            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-lg"
                            title="Réceptionner la marchandise"
                          >
                            {transforming === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            RÉCEPTIONNER
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailCommande && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 p-6 text-white flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Bon de Commande {detailCommande.numero}</h3>
                <p className="text-emerald-100 font-medium">Émis le {new Date(detailCommande.date).toLocaleDateString('fr-FR')}</p>
              </div>
              <button onClick={() => setDetailCommande(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
               <div className="grid grid-cols-2 gap-8 text-sm">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fournisseur Destinataire</label>
                    <p className="text-lg font-bold text-gray-900">{detailCommande.fournisseur?.nom || 'Client Libre'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Magasin de Réception</label>
                    <p className="text-lg font-bold text-gray-900">{detailCommande.magasin?.nom}</p>
                  </div>
               </div>

               <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                       <tr className="text-left">
                         <th className="px-4 py-3 font-bold text-gray-600">Désignation</th>
                         <th className="px-4 py-3 text-right font-bold text-gray-600">Quantité</th>
                         <th className="px-4 py-3 text-right font-bold text-gray-600">P.U</th>
                         <th className="px-4 py-3 text-right font-bold text-gray-600">Total</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {detailCommande.lignes.map((l: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-3 font-medium text-gray-900">{l.designation}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{l.quantite}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{l.prixUnitaire.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">{l.montant.toLocaleString()} F</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>

               <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest ${getStatutColor(detailCommande.statut)}`}>
                    Statut : {detailCommande.statut}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Valeur Totale Net</p>
                    <p className="text-3xl font-black text-emerald-600 tabular-nums">{detailCommande.montantTotal.toLocaleString()} <span className="text-sm font-bold opacity-70">FCFA</span></p>
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  {detailCommande.statut !== 'RECUE' && (
                    <button
                      onClick={() => handleTransformer(detailCommande.id)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-sm font-black text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-700/20 uppercase tracking-widest"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      Confirmer la Réception physique
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(detailCommande)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-orange-200 bg-orange-50 px-6 py-4 text-sm font-black text-orange-600 hover:bg-orange-100 transition-all uppercase tracking-widest"
                  >
                    <Pencil className="h-5 w-5" />
                    MODIFIER CETTE COMMANDE
                  </button>
                  <button
                    onClick={() => imprimerCommande(detailCommande)}
                    className="flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-4 text-sm font-black text-gray-600 hover:bg-gray-50 uppercase tracking-widest"
                  >
                    <Printer className="h-5 w-5" />
                    IMPRIMER BC
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintPreview
          isOpen={printPreviewOpen}
          onClose={() => setPrintPreviewOpen(false)}
          type="BON_COMMANDE"
          data={printData}
          defaultTemplateId={defaultTemplateId}
        />
      )}

      <ModalFournisseur 
        isOpen={showCreateFournisseur} 
        onClose={() => setShowCreateFournisseur(false)} 
        form={fournisseurForm} 
        setForm={setFournisseurForm} 
        onSubmit={handleCreateFournisseur} 
        loading={savingFournisseur} 
      />
    </div>
  )
}

function ModalFournisseur({ isOpen, onClose, form, setForm, onSubmit, loading }: any) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-orange-500 p-6 text-white flex justify-between items-center">
          <h3 className="text-xl font-black uppercase tracking-tight">Nouveau Fournisseur</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-all"><X /></button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Nom / Raison Sociale *</label>
            <input
              required
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-bold text-gray-900 focus:border-orange-500 outline-none"
              placeholder="Ex: ETS GESTI-COM"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Téléphone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-bold text-gray-900 focus:border-orange-500 outline-none"
                placeholder="0102030405"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-bold text-gray-900 focus:border-orange-500 outline-none"
                placeholder="contact@email.com"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">ANNULER</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-600 text-white font-black py-2.5 rounded-xl hover:bg-orange-700 shadow-lg shadow-orange-700/20 disabled:opacity-50 tracking-widest uppercase text-xs"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'CRÉER FOURNISSEUR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
