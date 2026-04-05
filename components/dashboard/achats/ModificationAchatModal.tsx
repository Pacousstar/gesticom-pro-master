'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Save, ShoppingBag, Plus, Trash2 } from 'lucide-react'
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

interface ModificationAchatModalProps {
  isOpen: boolean
  onClose: () => void
  achatId: number
  onSuccess: () => void
}

export default function ModificationAchatModal({
  isOpen,
  onClose,
  achatId,
  onSuccess
}: ModificationAchatModalProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [magasins, setMagasins] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [produits, setProduits] = useState<any[]>([])
  const [formData, setFormData] = useState({
    date: '',
    magasinId: '',
    fournisseurId: '',
    fournisseurLibre: '',
    modePaiement: 'ESPECES',
    montantPaye: '',
    observation: '',
    lignes: [] as Ligne[]
  })
  
  const [ajout, setAjout] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    tva: '0',
    remise: '0'
  })

  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => {
    if (isOpen && achatId) {
      loadData()
    }
  }, [isOpen, achatId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [mAchat, mMag, mFour, mProd] = await Promise.all([
        fetch(`/api/achats/${achatId}`).then(r => r.json()),
        fetch('/api/magasins').then(r => r.json()),
        fetch('/api/fournisseurs?limit=1000').then(r => r.json().then(d => d.data || d)),
        fetch('/api/produits?complet=1').then(r => r.json())
      ])

      setMagasins(mMag)
      setFournisseurs(mFour)
      setProduits(mProd)

      if (mAchat) {
        setFormData({
          date: mAchat.date.split('T')[0],
          magasinId: String(mAchat.magasinId),
          fournisseurId: mAchat.fournisseurId ? String(mAchat.fournisseurId) : '',
          fournisseurLibre: mAchat.fournisseurLibre || '',
          modePaiement: mAchat.modePaiement || 'ESPECES',
          montantPaye: String(mAchat.montantPaye || 0),
          observation: mAchat.observation || '',
          lignes: mAchat.lignes.map((l: any) => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva || 0,
            remise: l.remise || 0,
            montant: l.montant
          }))
        })
      }
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
    const tva = Number(ajout.tva)
    const rem = Number(ajout.remise)
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
    setAjout({ produitId: '', quantite: '1', prixUnitaire: '', tva: '0', remise: '0' })
  }

  const handleRemoveLigne = (index: number) => {
    setFormData(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== index) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.lignes.length === 0) {
      showError('L\'achat doit contenir au moins un article.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/achats/${achatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FULL_UPDATE',
          ...formData,
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
        showSuccess('Achat modifié avec succès.')
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

  const totalFinal = formData.lignes.reduce((sum, l) => sum + l.montant, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[95vh] w-full max-w-5xl flex-col rounded-[2.5rem] bg-white shadow-2xl overflow-hidden text-gray-900">
        {/* HEADER */}
        <div className="flex items-center justify-between bg-blue-700 px-8 py-6 text-white text-3xl font-black uppercase italic tracking-tighter">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-8 w-8" />
            MODIFIER L'ACHAT #{achatId}
          </div>
          <button onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-700" />
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
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Magasin</label>
                <select
                  required
                  value={formData.magasinId}
                  onChange={e => setFormData(f => ({ ...f, magasinId: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fournisseur</label>
                <select
                  value={formData.fournisseurId}
                  onChange={e => setFormData(f => ({ ...f, fournisseurId: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Fournisseur Occasionnel</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </div>
               <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mode Paiement</label>
                <select
                  value={formData.modePaiement}
                  onChange={e => setFormData(f => ({ ...f, modePaiement: e.target.value }))}
                  className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ESPECES">ESPECES</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="VIREMENT">VIREMENT</option>
                  <option value="MOBILE_MONEY">MOBILE MONEY</option>
                  <option value="CREDIT">A CREDIT</option>
                </select>
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
                        setAjout(a => ({ ...a, produitId: e.target.value, prixUnitaire: p ? String(p.prixAchat || 0) : '' }))
                      }}
                      className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">P.A</label>
                    <input
                      type="number"
                      value={ajout.prixUnitaire}
                      onChange={e => setAjout(a => ({ ...a, prixUnitaire: e.target.value }))}
                      className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">TVA (%)</label>
                    <input
                      type="number"
                      value={ajout.tva}
                      onChange={e => setAjout(a => ({ ...a, tva: e.target.value }))}
                      className="w-full rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLigne}
                    className="h-10 rounded-xl bg-gray-900 text-white font-black hover:bg-black transition-all flex items-center justify-center gap-2 px-4 shadow-md text-[10px]"
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
                      <th className="px-4 py-3 text-center">Quantité</th>
                      <th className="px-4 py-3 text-right">Prix Achat</th>
                      <th className="px-4 py-3 text-right">TVA</th>
                      <th className="px-4 py-3 text-right">Montant TTC</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {formData.lignes.map((l, i) => (
                      <tr key={i} className="text-sm font-bold text-gray-700 hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3">{l.designation}</td>
                        <td className="px-4 py-3 text-center">{l.quantite}</td>
                        <td className="px-4 py-3 text-right">{l.prixUnitaire.toLocaleString()} F</td>
                        <td className="px-4 py-3 text-right text-gray-400">{l.tva || 0}%</td>
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-gray-100">
               <div className="flex flex-wrap gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Déjà Payé</label>
                    <input
                      type="number"
                      value={formData.montantPaye}
                      onChange={e => setFormData(f => ({ ...f, montantPaye: e.target.value }))}
                      className="w-40 rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-extrabold focus:ring-2 focus:ring-blue-500 outline-none text-blue-600"
                    />
                  </div>
                  <div className="md:w-64 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Observation</label>
                    <input
                      type="text"
                      value={formData.observation}
                      onChange={e => setFormData(f => ({ ...f, observation: e.target.value }))}
                      className="w-full rounded-xl border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
               </div>

               <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Achat TTC</p>
                    <p className="text-4xl font-black text-blue-700 tracking-tighter italic">{totalFinal.toLocaleString()} F</p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-2xl bg-blue-700 px-10 py-4 text-base font-black text-white hover:bg-blue-800 transition-all shadow-xl shadow-blue-200 flex items-center gap-3 disabled:opacity-50"
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
