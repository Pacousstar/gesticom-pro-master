'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, ShoppingCart, Plus, Trash2, Wallet } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { montantLigneTTC, montantTotalVenteDocument } from '@/lib/calculs-commerciaux'

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
    reglements: [{ mode: 'ESPECES', montant: '' }] as { mode: string; montant: string }[],
    banqueId: '',
    remiseGlobale: '',
    observation: '',
    numeroBon: '',
    fraisApproche: '',
    lignes: [] as Ligne[]
  })
  const [banques, setBanques] = useState<any[]>([])

  const [ajout, setAjout] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    tva: '0',
    remise: '0'
  })

  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    if (isOpen && venteId) {
      loadData()
    }
  }, [isOpen, venteId])

  useEffect(() => {
    fetch('/api/banques')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBanques(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setBanques([]))
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mVenteRes, mMagRes, mCliRes, mProdRes] = await Promise.all([
        fetch(`/api/ventes/${venteId}`),
        fetch('/api/magasins'),
        fetch('/api/clients?limit=1000'),
        fetch('/api/produits?complet=1'),
      ])

      const mVente = mVenteRes.ok ? await mVenteRes.json() : null
      const mMag = mMagRes.ok ? await mMagRes.json() : []
      const mCliData = mCliRes.ok ? await mCliRes.json() : {}
      const mProd = mProdRes.ok ? await mProdRes.json() : []

      if (!mVente || mVente.error) {
        showError(mVente?.error || 'Vente introuvable.')
        setLoading(false)
        onClose()
        return
      }

      setMagasins(Array.isArray(mMag) ? mMag : mMag.data || [])
      setClients(mCliData.data || mCliData || [])
      setProduits(Array.isArray(mProd) ? mProd : mProd.data || [])

      const venteReglements = Array.isArray(mVente.reglements) && mVente.reglements.length > 0
        ? mVente.reglements.map((r: any) => ({ mode: r.modePaiement || r.mode || 'ESPECES', montant: String(r.montant || 0) }))
        : [{ mode: mVente.modePaiement || 'ESPECES', montant: String(mVente.montantPaye || 0) }]

      setFormData({
        date: mVente.date ? mVente.date.split('T')[0] : '',
        magasinId: String(mVente.magasinId),
        clientId: mVente.clientId ? String(mVente.clientId) : '',
        clientLibre: mVente.clientLibre || '',
        modePaiement: mVente.modePaiement || 'ESPECES',
        reglements: venteReglements,
        banqueId: '',
        remiseGlobale: String(mVente.remiseGlobale || 0),
        observation: mVente.observation || '',
        numeroBon: mVente.numeroBon || '',
        fraisApproche: String(mVente.fraisApproche || 0),
        lignes: mVente.lignes.map((l: any) => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: Number(l.tvaPerc ?? l.tva ?? 0) || 0,
          remise: l.remise || 0,
          montant: l.montant,
        }))
      })
    } catch (e) {
      showError('Erreur lors du chargement des données.')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const totalAvantRemise = formData.lignes.reduce((sum, l) => sum + l.montant, 0)
  const totalFinal = montantTotalVenteDocument(
    totalAvantRemise,
    Number(formData.remiseGlobale) || 0,
    Number(formData.fraisApproche) || 0
  )

  const totalPayeReglements = formData.reglements.reduce((sum, r) => sum + (Number(r.montant) || 0), 0)
  const needsBanque = formData.reglements.some((r) => ['MOBILE_MONEY', 'CHEQUE', 'VIREMENT'].includes(String(r.mode).toUpperCase()))

  const handleAddLigne = () => {
    const p = produits.find(x => x.id === Number(ajout.produitId))
    if (!p) return

    const q = Number(ajout.quantite)
    const pu = Number(ajout.prixUnitaire)
    if (q <= 0) {
      showError('Quantité invalide.')
      return
    }

    const pMin = (p as any).prixMinimum || 0
    if (pMin > 0 && pu < pMin) {
      showError(`PRIX INSUFFISANT : Le prix minimum pour ${p.designation} est de ${pMin.toLocaleString('fr-FR')} FCFA.`)
      return
    }

    const tva = Number(ajout.tva) || 0
    const rem = Number(ajout.remise) || 0
    const mnt = montantLigneTTC({
      quantite: q,
      prixUnitaire: pu,
      remiseLigne: rem,
      tvaPourcent: tva,
    })

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
    setAjout({ produitId: '', quantite: '1', prixUnitaire: '', tva: '0', remise: '0' })
  }

  const handleRemoveLigne = (index: number) => {
    setFormData(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== index) }))
  }

  const addReglement = () => {
    setFormData(f => ({
      ...f,
      reglements: [...f.reglements, { mode: 'ESPECES', montant: '' }]
    }))
  }

  const removeReglement = (index: number) => {
    if (formData.reglements.length <= 1) return
    setFormData(f => ({
      ...f,
      reglements: f.reglements.filter((_, i) => i !== index)
    }))
  }

  const updateReglement = (index: number, key: 'mode' | 'montant', value: string) => {
    setFormData(f => ({
      ...f,
      reglements: f.reglements.map((r, i) => i === index ? { ...r, [key]: value } : r)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.lignes.length === 0) {
      showError('La vente doit contenir au moins un article.')
      return
    }

    if (needsBanque && !formData.banqueId) {
      showError('Sélectionnez un compte bancaire pour les règlements non espèces.')
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
          magasinId: Number(formData.magasinId),
          clientId: formData.clientId ? Number(formData.clientId) : null,
          clientLibre: formData.clientLibre.trim() || null,
          modePaiement: formData.reglements.length > 1 ? 'MULTI' : (formData.reglements[0]?.mode || 'ESPECES'),
          reglements: formData.reglements.map(r => ({ mode: r.mode, montant: Number(r.montant) || 0 })),
          banqueId: needsBanque && formData.banqueId ? Number(formData.banqueId) : undefined,
          remiseGlobale: Number(formData.remiseGlobale) || 0,
          fraisApproche: Number(formData.fraisApproche) || 0,
          observation: (formData.observation || '').trim() || null,
          numeroBon: (formData.numeroBon || '').trim() || null,
          lignes: formData.lignes.map(l => ({
            produitId: l.produitId,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            remise: l.remise,
          })),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[95vh] w-full max-w-5xl flex-col rounded-[2.5rem] bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-orange-600 px-8 py-6 text-white text-3xl font-black uppercase italic tracking-tighter">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-8 w-8" />
            MODIFIER LA VENTE #{venteId}
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
                  <option value="">Client Comptoir</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              {!formData.clientId && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom libre</label>
                  <input
                    type="text"
                    value={formData.clientLibre}
                    onChange={e => setFormData(f => ({ ...f, clientLibre: e.target.value }))}
                    placeholder="Client de passage..."
                    className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest ml-1 italic font-serif">Numéro de BON</label>
                <input
                  type="text"
                  value={formData.numeroBon}
                  onChange={e => setFormData(f => ({ ...f, numeroBon: e.target.value }))}
                  placeholder="Ex: BON-2024..."
                  className="w-full rounded-xl border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none placeholder:text-gray-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observation</label>
                <input
                  type="text"
                  value={formData.observation}
                  onChange={e => setFormData(f => ({ ...f, observation: e.target.value }))}
                  placeholder="Note..."
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Remise Globale</label>
                <input
                  type="number"
                  min="0"
                  value={formData.remiseGlobale}
                  onChange={e => setFormData(f => ({ ...f, remiseGlobale: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-extrabold focus:ring-2 focus:ring-rose-500 outline-none text-rose-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Frais d&apos;approche</label>
                <input
                  type="number"
                  min="0"
                  value={formData.fraisApproche}
                  onChange={e => setFormData(f => ({ ...f, fraisApproche: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-extrabold focus:ring-2 focus:ring-orange-500 outline-none text-orange-600"
                />
              </div>
            </div>

            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-orange-900 uppercase flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Règlements
                </h3>
                <button
                  type="button"
                  onClick={addReglement}
                  className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-1 rounded hover:bg-orange-300 transition-colors"
                >
                  + AJOUTER UN MODE
                </button>
              </div>
              <div className="space-y-2">
                {formData.reglements.map((reg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={reg.mode}
                      onChange={(e) => updateReglement(idx, 'mode', e.target.value)}
                      className="flex-1 rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none bg-white font-bold"
                    >
                      <option value="ESPECES">Espèces</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="VIREMENT">Virement</option>
                      <option value="CHEQUE">Chèque</option>
                      <option value="CREDIT">Crédit (Dette)</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={reg.montant}
                      onChange={(e) => updateReglement(idx, 'montant', e.target.value)}
                      placeholder={idx === 0 ? String(Math.round(totalFinal)) : '0'}
                      className="w-32 rounded-lg border border-orange-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none bg-white font-black"
                    />
                    {formData.reglements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReglement(idx)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="font-bold text-gray-600">Total saisi : <span className={totalPayeReglements >= totalFinal ? 'text-emerald-600' : 'text-red-600'}>{totalPayeReglements.toLocaleString('fr-FR')} F</span></span>
                <span className="text-gray-400">|</span>
                <span className="font-bold text-gray-600">Total facture : <span className="text-orange-600">{totalFinal.toLocaleString('fr-FR')} F</span></span>
                {totalPayeReglements < totalFinal && (
                  <span className="text-red-600 font-bold text-xs">RESTE {(totalFinal - totalPayeReglements).toLocaleString('fr-FR')} F</span>
                )}
              </div>
              {needsBanque && (
                <div className="mt-3">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">Compte bancaire à utiliser</label>
                  <select
                    required
                    value={formData.banqueId}
                    onChange={(e) => setFormData(f => ({ ...f, banqueId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">Sélectionner une banque...</option>
                    {banques.map((b) => (
                      <option key={b.id} value={b.id}>{b.nomBanque} — {b.libelle} ({b.numero})</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-gray-400">Obligatoire pour Mobile Money, Virement et Chèque.</p>
                </div>
              )}
            </div>

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
                    min="1"
                    value={ajout.quantite}
                    onChange={e => setAjout(a => ({ ...a, quantite: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">P.U</label>
                  <input
                    type="number"
                    min="0"
                    value={ajout.prixUnitaire}
                    onChange={e => setAjout(a => ({ ...a, prixUnitaire: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">TVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={ajout.tva}
                    onChange={e => setAjout(a => ({ ...a, tva: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Remise</label>
                  <input
                    type="number"
                    min="0"
                    value={ajout.remise}
                    onChange={e => setAjout(a => ({ ...a, remise: e.target.value }))}
                    className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 shadow-inner">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-[10px] font-black text-gray-500 uppercase tracking-widest sticky top-0">
                    <th className="px-4 py-3 text-left">Produit</th>
                    <th className="px-4 py-3 text-center">Qté</th>
                    <th className="px-4 py-3 text-right">Prix Unitaire</th>
                    <th className="px-4 py-3 text-right">Remise</th>
                    <th className="px-4 py-3 text-right">Montant TTC</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.lignes.map((l, i) => (
                    <tr key={i} className="text-sm font-bold text-gray-700 hover:bg-orange-50/50 transition-colors">
                      <td className="px-4 py-3">{l.designation}</td>
                      <td className="px-4 py-3 text-center">{l.quantite}</td>
                      <td className="px-4 py-3 text-right">{l.prixUnitaire.toLocaleString()} F</td>
                      <td className="px-4 py-3 text-right text-rose-500">-{l.remise?.toLocaleString() || 0} F</td>
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

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-gray-100">
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total à Payer</p>
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
          </form>
        )}
      </div>
    </div>
  )
}