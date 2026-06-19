'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, ShoppingBag, Plus, Trash2, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

interface Ligne {
  produitId: number
  designation: string
  quantite: number
  prixUnitaire: number
  tva?: number
  remise?: number
  montant: number
}

interface ModificationVenteModalProps {
  isOpen: boolean
  onClose: () => void
  venteId: number
  onSuccess: () => void
}

export default function ModificationVenteModal({
  isOpen,
  onClose,
  venteId,
  onSuccess
}: ModificationVenteModalProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [magasins, setMagasins] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [produits, setProduits] = useState<any[]>([])
  const [formData, setFormData] = useState({
    date: '',
    magasinId: '',
    clientId: '',
    clientLibre: '',
    modePaiement: 'ESPECES',
    reglements: [] as { mode: string; montant: string }[],
    banqueId: '',
    remiseGlobale: '',
    observation: '',
    numeroBon: '',
    typeVente: 'LIVRAISON_IMMEDIATE',
    dateLivraison: '',
    retraitDiffere: false,
    lignes: [] as Ligne[]
  })

  const [numero, setNumero] = useState('')

  const [ajout, setAjout] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    tva: '0',
    remise: '0',
    remiseType: 'MONTANT' as 'MONTANT' | 'POURCENT'
  })

  const { success: showSuccess, error: showError } = useToast()
  const [banques, setBanques] = useState<any[]>([])
  const needsBanque = formData.reglements.some((r) => ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(r.mode).toUpperCase()))

  useEffect(() => {
    if (isOpen && venteId) {
      loadData()
    }
  }, [isOpen, venteId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mVenteRes, mMagRes, mCliRes, mProdRes, mBanquesRes] = await Promise.all([
        fetch(`/api/ventes/${venteId}`),
        fetch('/api/magasins'),
        fetch('/api/clients?limit=1000'),
        fetch('/api/produits?complet=1'),
        fetch('/api/banques'),
      ])

      const mVente = mVenteRes.ok ? await mVenteRes.json() : null
      const mMag = mMagRes.ok ? await mMagRes.json() : []
      const mCliData = mCliRes.ok ? await mCliRes.json() : {}
      const mProd = mProdRes.ok ? await mProdRes.json() : []
      const mBanquesData = mBanquesRes.ok ? await mBanquesRes.json() : { data: [] }

      if (!mVente) {
        showError('Vente introuvable.')
        setLoading(false)
        onClose()
        return
      }

      setMagasins(Array.isArray(mMag) ? mMag : mMag.data || [])
      setClients(mCliData.data || mCliData || [])
      setProduits(Array.isArray(mProd) ? mProd : mProd.data || [])
      setBanques((mBanquesData.data || mBanquesData || []).filter((b: any) => b.actif !== false))
      setNumero(mVente.numero || '')

      setFormData({
        date: mVente.date?.split('T')[0] || '',
        magasinId: String(mVente.magasinId),
        clientId: mVente.clientId ? String(mVente.clientId) : '',
        clientLibre: mVente.clientLibre || '',
        modePaiement: mVente.modePaiement || 'ESPECES',
        reglements: mVente.reglements?.map((r: any) => ({ mode: r.modePaiement, montant: String(r.montant) })) || [],
        banqueId: '',
        remiseGlobale: String(mVente.remiseGlobale || '0'),
        observation: mVente.observation || '',
        numeroBon: mVente.numeroBon || '',
        typeVente: mVente.typeVente || 'LIVRAISON_IMMEDIATE',
        dateLivraison: mVente.dateLivraison ? mVente.dateLivraison.split('T')[0] : '',
        retraitDiffere: mVente.retraitDiffere === true,
        lignes: mVente.lignes.map((l: any) => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva || 0,
          remise: l.remise || 0,
          montant: l.montant
        }))
      })
    } catch (e) {
      showError('Erreur lors du chargement des données.')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleAddLigne = () => {
    const p = produits.find(x => x.id === Number(ajout.produitId))
    if (!p) return

    const q = Number(ajout.quantite)
    const pu = Number(ajout.prixUnitaire)
    if (q <= 0) { showError('La quantité doit être supérieure à 0.'); return }
    if (!pu || pu <= 0) { showError('Le prix unitaire doit être supérieur à 0.'); return }
    const tva = Number(ajout.tva)
    let rem = Number(ajout.remise)
    if (ajout.remiseType === 'POURCENT' && rem > 0) {
      rem = Math.round((q * pu) * rem / 100)
    }
    const mnt = Math.round((q * pu - rem) * (1 + tva / 100))

    const nouvelleLigne: Ligne = {
      produitId: p.id,
      designation: p.designation,
      quantite: q,
      prixUnitaire: pu,
      tva,
      remise: rem,
      montant: mnt
    }

    setFormData(f => ({ ...f, lignes: [...f.lignes, nouvelleLigne] }))
    setAjout({ produitId: '', quantite: '1', prixUnitaire: '', tva: '0', remise: '0', remiseType: 'MONTANT' })
  }

  const handleRemoveLigne = (index: number) => {
    setFormData(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== index) }))
  }

  const handleUpdateLigne = (index: number, field: keyof Ligne, value: string | number) => {
    setFormData(f => {
      const lignes = [...f.lignes]
      const l = { ...lignes[index], [field]: value }
      const q = Number(l.quantite) || 0
      const pu = Number(l.prixUnitaire) || 0
      const tv = Number(l.tva) || 0
      const rm = Number(l.remise) || 0
      l.montant = Math.round((q * pu - rm) * (1 + tv / 100))
      lignes[index] = l
      return { ...f, lignes }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.lignes.length === 0) {
      showError('La vente doit contenir au moins un article.')
      return
    }

    if (needsBanque && !formData.banqueId) {
      showError('Sélectionnez une banque pour les règlements non espèces.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes/${venteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FULL_UPDATE',
          date: formData.date || undefined,
          magasinId: Number(formData.magasinId) || undefined,
          clientId: formData.clientId ? Number(formData.clientId) : null,
          clientLibre: formData.clientLibre || null,
          observation: formData.observation || null,
          numeroBon: formData.numeroBon || null,
          typeVente: formData.typeVente || undefined,
          dateLivraison: formData.dateLivraison || undefined,
          retraitDiffere: formData.retraitDiffere === true,
          remiseGlobale: Number(formData.remiseGlobale) || 0,
          modePaiement: formData.reglements.length > 1 ? 'MULTI' : (formData.reglements[0]?.mode || 'ESPECES'),
          reglements: formData.reglements.map(r => ({ mode: r.mode, montant: Number(r.montant) || 0, banqueId: needsBanque && formData.banqueId ? Number(formData.banqueId) : undefined })),
          banqueId: needsBanque && formData.banqueId ? Number(formData.banqueId) : undefined,
          lignes: formData.lignes.map(l => ({
            produitId: l.produitId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            remise: l.remise
          }))
        })
      })

      const data = await res.json()
      if (res.ok) {
        showSuccess('Vente modifiée avec succès.')
        onSuccess()
        onClose()
      } else {
        showError(data.error || 'Erreur lors de la modification.')
      }
    } catch (e) {
      showError('Erreur réseau.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const totalLignes = formData.lignes.reduce((sum, l) => sum + l.montant, 0)
  const totalFinal = totalLignes - (Number(formData.remiseGlobale) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-8 sm:pt-12 backdrop-blur-sm overflow-y-auto">
      <div className="flex w-full max-w-5xl xl:max-w-6xl flex-col rounded-[2.5rem] bg-white shadow-2xl overflow-hidden text-gray-900 my-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between bg-orange-600 px-8 py-6 text-white text-3xl font-black uppercase italic tracking-tighter">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-8 w-8" />
            MODIFIER LA FACTURE {numero || `#${venteId}`}
          </div>
          <button onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Magasin</label>
                <select
                  required
                  value={formData.magasinId}
                  onChange={e => setFormData(f => ({ ...f, magasinId: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Client</label>
                <select
                  value={formData.clientId}
                  onChange={e => setFormData(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Client Occasionnel</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                {!formData.clientId && (
                  <input
                    type="text"
                    value={formData.clientLibre}
                    onChange={e => setFormData(f => ({ ...f, clientLibre: e.target.value }))}
                    placeholder="Nom du client occasionnel"
                    className="mt-1 w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mode Paiement</label>
                <select
                  value={formData.modePaiement}
                  onChange={e => setFormData(f => ({ ...f, modePaiement: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="ESPECES">ESPECES</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="VIREMENT">VIREMENT</option>
                  <option value="MOBILE_MONEY">MOBILE MONEY</option>
                  <option value="CREDIT">A CREDIT</option>
                </select>
              </div>
            </div>

            {/* Type de vente, livraison, bon */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type de vente</label>
                <select
                  value={formData.typeVente}
                  onChange={e => setFormData(f => ({ ...f, typeVente: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="LIVRAISON_IMMEDIATE">Livraison immédiate</option>
                  <option value="COMMANDE">Vente sur commande</option>
                </select>
              </div>
              {formData.typeVente === 'COMMANDE' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date livraison prévue</label>
                  <input
                    type="date"
                    value={formData.dateLivraison}
                    onChange={e => setFormData(f => ({ ...f, dateLivraison: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              )}
              {formData.typeVente === 'LIVRAISON_IMMEDIATE' && (
                <div className="space-y-1 flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.retraitDiffere}
                      onChange={e => setFormData(f => ({ ...f, retraitDiffere: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-[11px] font-bold text-gray-500">Retrait différé</span>
                  </label>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">N° Bon</label>
                <input
                  type="text"
                  value={formData.numeroBon}
                  onChange={e => setFormData(f => ({ ...f, numeroBon: e.target.value }))}
                  placeholder="Numéro de bon"
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            {/* AJOUT ARTICLE */}
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 bg-gray-50/50">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ajouter un produit</label>
                  <select
                    value={ajout.produitId}
                    onChange={e => {
                      const p = produits.find(x => x.id === Number(e.target.value))
                      setAjout(a => ({ ...a, produitId: e.target.value, prixUnitaire: p ? String(p.prixVente || 0) : '' }))
                    }}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.designation} ({p.code})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Qté</label>
                  <input
                    type="number"
                    value={ajout.quantite}
                    onChange={e => setAjout(a => ({ ...a, quantite: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">P.V</label>
                  <input
                    type="number"
                    value={ajout.prixUnitaire}
                    onChange={e => setAjout(a => ({ ...a, prixUnitaire: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">TVA (%)</label>
                  <input
                    type="number"
                    value={ajout.tva}
                    onChange={e => setAjout(a => ({ ...a, tva: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Remise</label>
                  <div className="flex items-center">
                    <input
                      type="number" min="0"
                      value={ajout.remise}
                      onChange={e => setAjout(a => ({ ...a, remise: e.target.value }))}
                      className="w-20 rounded-l-xl border-gray-200 bg-white px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setAjout(a => ({ ...a, remiseType: a.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT' }))}
                      className={`px-2 py-2 border border-l-0 border-gray-200 text-xs font-bold rounded-r-xl transition-colors ${ajout.remiseType === 'POURCENT' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {ajout.remiseType === 'MONTANT' ? 'F' : '%'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLigne}
                  className="h-10 rounded-xl bg-orange-600 text-white font-black hover:bg-orange-700 transition-all flex items-center justify-center gap-2 px-4 shadow-md text-[10px]"
                >
                  <Plus className="h-4 w-4" /> AJOUTER
                </button>
              </div>
            </div>

            {/* LISTE ARTICLES */}
            <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 shadow-inner">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0">
                    <th className="px-4 py-3 text-left">Produit</th>
                    <th className="px-4 py-3 text-center w-20">Quantité</th>
                    <th className="px-4 py-3 text-right w-28">Prix Vente</th>
                    <th className="px-4 py-3 text-right w-20">TVA</th>
                    <th className="px-4 py-3 text-right w-24">Remise</th>
                    <th className="px-4 py-3 text-right w-28">Montant TTC</th>
                    <th className="px-4 py-3 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.lignes.map((l, i) => (
                    <tr key={i} className="text-sm font-bold text-gray-700 hover:bg-orange-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs">{l.designation}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={l.quantite}
                          onChange={e => handleUpdateLigne(i, 'quantite', Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={l.prixUnitaire}
                          onChange={e => handleUpdateLigne(i, 'prixUnitaire', Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={l.tva || 0}
                          onChange={e => handleUpdateLigne(i, 'tva', Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-center text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={l.remise || 0}
                          onChange={e => handleUpdateLigne(i, 'remise', Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-right text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black">{l.montant.toLocaleString()} F</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLigne(i)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTALS & SUBMIT */}
            <div className="flex flex-col md:flex-row items-start justify-between gap-6 pt-4 border-t border-gray-100">
              <div className="flex flex-col gap-4 w-full md:w-auto">
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Remise Globale</label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-black text-orange-500">−</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.remiseGlobale}
                        onChange={e => setFormData(f => ({ ...f, remiseGlobale: e.target.value }))}
                        className="w-40 rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-extrabold focus:ring-2 focus:ring-orange-500 outline-none text-orange-600"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="md:w-64 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observation</label>
                    <input
                      type="text"
                      value={formData.observation}
                      onChange={e => setFormData(f => ({ ...f, observation: e.target.value }))}
                      className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                </div>
                <div className="md:w-64 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">N° Bon</label>
                  <input
                    type="text"
                    value={formData.numeroBon}
                    onChange={e => setFormData(f => ({ ...f, numeroBon: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Numéro du bon de livraison"
                  />
                </div>

                {/* Règlements */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Règlements</label>
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, reglements: [...f.reglements, { mode: 'ESPECES', montant: '' }] }))}
                      className="text-[10px] font-black text-orange-600 hover:text-orange-800 uppercase tracking-widest"
                    >
                      + Ajouter un règlement
                    </button>
                  </div>
                  {formData.reglements.map((r, idx) => (
                    <div key={idx} className="flex items-end gap-3">
                      <div className="space-y-1 flex-1">
                        <select
                          value={r.mode}
                          onChange={e => {
                            const newRegs = [...formData.reglements]
                            newRegs[idx] = { ...newRegs[idx], mode: e.target.value }
                            setFormData(f => ({ ...f, reglements: newRegs }))
                          }}
                          className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                          <option value="ESPECES">Espèces</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="CHEQUE">Chèque</option>
                          <option value="VIREMENT">Virement</option>
                          <option value="CREDIT">A crédit</option>
                        </select>
                      </div>
                      <div className="space-y-1 flex-1">
                        <input
                          type="number"
                          min="0"
                          value={r.montant}
                          onChange={e => {
                            const newRegs = [...formData.reglements]
                            newRegs[idx] = { ...newRegs[idx], montant: e.target.value }
                            setFormData(f => ({ ...f, reglements: newRegs }))
                          }}
                          placeholder="Montant"
                          className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-extrabold focus:ring-2 focus:ring-orange-500 outline-none text-orange-600"
                        />
                      </div>
                      {formData.reglements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormData(f => ({ ...f, reglements: f.reglements.filter((_, i) => i !== idx) }))}
                          className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {needsBanque && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Compte bancaire</label>
                      <select
                        value={formData.banqueId}
                        onChange={e => setFormData(f => ({ ...f, banqueId: e.target.value }))}
                        className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        <option value="">Sélectionner une banque...</option>
                        {banques.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.nomBanque} — {b.libelle}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Vente TTC</p>
                  <p className="text-4xl font-black text-orange-600 tracking-tighter italic">{totalFinal.toLocaleString()} F</p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-orange-600 px-10 py-4 text-base font-black text-white hover:bg-orange-700 transition-all shadow-xl shadow-orange-200 flex items-center gap-3 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                  ENREGISTRER LES MODIFICATIONS
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
