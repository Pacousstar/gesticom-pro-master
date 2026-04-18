'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash, Search, Scan, Loader2, X, Wallet, DollarSign, Calculator, UserPlus, AlertTriangle, ShoppingCart } from 'lucide-react'
import { Magasin, Client, Produit, Ligne } from './types'
import { useToast } from '@/hooks/useToast'
import dynamic from 'next/dynamic'

const BarcodeScanner = dynamic(() => import('@/components/scanner/BarcodeScanner'), { ssr: false })

interface VenteFormProps {
  initialData?: any
  magasins: Magasin[]
  clients: Client[]
  produits: Produit[]
  tvaParDefaut: number
  submitting: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  onOpenCreateClient: (after?: () => void) => void
  onRefetchProduits: () => void
}

export default function VenteForm({
  initialData,
  magasins,
  clients,
  produits,
  tvaParDefaut,
  submitting,
  onClose,
  onSubmit,
  onOpenCreateClient,
  onRefetchProduits
}: VenteFormProps) {
  const { error: showError } = useToast()
  const [formData, setFormData] = useState({
    date: initialData?.date || new Date().toLocaleDateString('en-CA'),
    magasinId: initialData?.magasinId || '',
    clientId: initialData?.clientId || '',
    clientLibre: initialData?.clientLibre || '',
    modePaiement: initialData?.modePaiement || 'ESPECES',
    reglements: initialData?.reglements || [{ mode: 'ESPECES', montant: '' }],
    remiseGlobale: initialData?.remiseGlobale || '',
    observation: initialData?.observation || '',
    numeroBon: initialData?.numeroBon || '',
    lignes: initialData?.lignes || [] as Ligne[],
  })

  const [ajoutProduit, setAjoutProduit] = useState({
    produitId: '',
    quantite: '1',
    prixUnitaire: '',
    recherche: '',
    tvaPerc: '',
    remise: '',
    remiseType: 'MONTANT' as 'MONTANT' | 'POURCENT'
  })

  const [scannerOpen, setScannerOpen] = useState(false)
  const [formClientSearch, setFormClientSearch] = useState('')
  const [showClientList, setShowClientList] = useState(false)

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
      reglements: f.reglements.filter((_: any, i: number) => i !== index)
    }))
  }

  const updateReglement = (index: number, key: 'mode' | 'montant', value: string) => {
    setFormData(f => ({
      ...f,
      reglements: f.reglements.map((r: any, i: number) => i === index ? { ...r, [key]: value } : r)
    }))
  }

  const handleBarcodeScan = (code: string) => {
    const p = produits.find(p => (p as any).codeBarres === code || p.code === code)
    if (p) {
      const prixDefaut = (p.prixVente && p.prixVente > 0) ? p.prixVente : (p.prixAchat ?? 0)
      setAjoutProduit(a => ({
        ...a,
        produitId: String(p.id),
        recherche: p.designation,
        prixUnitaire: String(prixDefaut),
        tvaPerc: String(tvaParDefaut)
      }))
      setScannerOpen(false)
    } else {
      showError("Produit non trouvé.")
    }
  }

  const addLigne = () => {
    const pId = Number(ajoutProduit.produitId)
    const p = produits.find((x) => x.id === pId)
    if (!p) {
      showError('Sélectionnez un produit.')
      return
    }
    const qte = Number(ajoutProduit.quantite) || 0
    const st = p.stocks?.find((x: any) => x.magasinId === Number(formData.magasinId))
    const qteDispo = st?.quantite || 0
    
    if (qte <= 0) {
      showError('Quantité invalide.')
      return
    }
    if (qte > qteDispo) {
      showError(`⚠️ Stock insuffisant pour ${p.designation}. Disponible: ${qteDispo}.`)
      return
    }

    const pMin = p.prixMinimum || 0
    const pSaisi = Number(ajoutProduit.prixUnitaire) || 0
    if (pMin > 0 && pSaisi < pMin) {
      showError(`🔔 PRIX INSUFFISANT : Le prix minimum pour ${p.designation} est de ${pMin.toLocaleString('fr-FR')} FCFA.`)
      return
    }

    const tvaVal = ajoutProduit.tvaPerc !== '' ? Number(ajoutProduit.tvaPerc) : tvaParDefaut
    let remiseVal = Number(ajoutProduit.remise) || 0
    
    if (ajoutProduit.remiseType === 'POURCENT' && remiseVal > 0) {
      remiseVal = (Number(ajoutProduit.prixUnitaire) * qte) * (remiseVal / 100)
    }

    const nouvelleLigne: Ligne = {
      produitId: p.id,
      designation: p.designation,
      code: p.code,
      quantite: qte,
      prixUnitaire: Number(ajoutProduit.prixUnitaire),
      tvaPerc: tvaVal,
      remise: remiseVal
    }
    setFormData((f) => ({ ...f, lignes: [...f.lignes, nouvelleLigne] }))
    setAjoutProduit({ produitId: '', quantite: '1', prixUnitaire: '', recherche: '', tvaPerc: '', remise: '', remiseType: 'MONTANT' })
  }

  const removeLigne = (i: number) => {
    setFormData((f) => ({ ...f, lignes: f.lignes.filter((_: any, j: number) => j !== i) }))
  }

  const { totalHT, totalTVA, totalRemise, totalAvantRemiseGlobale } = formData.lignes.reduce(
    (acc: any, val: Ligne) => {
      const q = val.quantite
      const pu = val.prixUnitaire
      const t = val.tvaPerc || 0
      const r = val.remise || 0
      const ht = q * pu
      const htNet = ht - r
      const tvaMontant = htNet * (t / 100)
      acc.totalHT += ht
      acc.totalTVA += tvaMontant
      acc.totalRemise += r
      acc.totalAvantRemiseGlobale += htNet + tvaMontant
      return acc
    },
    { totalHT: 0, totalTVA: 0, totalRemise: 0, totalAvantRemiseGlobale: 0 }
  )

  const total = Math.max(0, Math.round(totalAvantRemiseGlobale - (Number(formData.remiseGlobale) || 0)))
  const totalHTNetApresRemiseGlobale = Math.max(0, (totalHT - totalRemise) - (Number(formData.remiseGlobale) || 0))
  const pointsGagnes = Math.floor(totalHTNetApresRemiseGlobale)

  return (
    <div className="rounded-xl border border-orange-200 bg-white p-6 shadow-xl">
      <div className="mb-6 flex items-center justify-between border-b border-orange-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{initialData ? 'Modifier la vente' : 'Enregistrer une nouvelle vente'}</h2>
          <p className="text-sm text-gray-500">Remplissez les informations pour générer la facture.</p>
        </div>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-gray-100"><X className="h-6 w-6 text-gray-500" /></button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Magasin / Point de vente *</label>
            <select
              required
              value={formData.magasinId}
              onChange={(e) => setFormData(f => ({ ...f, magasinId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:outline-none"
            >
              <option value="">Sélectionner</option>
              {magasins.map(m => <option key={m.id} value={m.id}>{m.code} – {m.nom}</option>)}
            </select>
          </div>

          <div className="relative space-y-2">
            <label className="flex items-center justify-between text-sm font-bold text-gray-700">
              Client
              <button type="button" onClick={() => onOpenCreateClient()} className="text-xs text-orange-600 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Nouveau
              </button>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Ex: Passage, Nom client..."
                value={formClientSearch}
                onFocus={() => setShowClientList(true)}
                onChange={(e) => {
                  setFormClientSearch(e.target.value)
                  setShowClientList(true)
                  if (!e.target.value) setFormData(f => ({ ...f, clientId: '' }))
                }}
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 focus:border-orange-500 focus:outline-none"
              />
              {showClientList && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => { setFormData(f => ({ ...f, clientId: '', clientLibre: '' })); setFormClientSearch('PASSAGE'); setShowClientList(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-orange-50"
                    >
                      (Client de passage)
                    </button>
                    {clients.filter(c => c.nom.toLowerCase().includes(formClientSearch.toLowerCase())).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setFormData(f => ({ ...f, clientId: String(c.id), clientLibre: '' })); setFormClientSearch(c.nom); setShowClientList(false); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-orange-50"
                      >
                        {c.nom} {c.code ? `(${c.code})` : ''} — <span className="text-xs text-gray-500">{c.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Date de la vente</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Zone Ajout de Lignes */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-600" /> Articles à vendre
            </h3>
            <button type="button" onClick={() => setScannerOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
              <Scan className="h-4 w-4" /> Scanner Douchette/Caméra
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-6 items-end">
            <div className="lg:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Rechercher Article</label>
              <select
                value={ajoutProduit.produitId}
                onChange={(e) => {
                  const p = produits.find(x => x.id === Number(e.target.value))
                  if (p) {
                    const prixDefaut = (p.prixVente && p.prixVente > 0) ? p.prixVente : (p.prixAchat ?? 0)
                    setAjoutProduit(a => ({ ...a, produitId: e.target.value, prixUnitaire: String(prixDefaut), tvaPerc: String(tvaParDefaut) }))
                  }
                }}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-orange-500"
              >
                <option value="">Choisir un produit</option>
                {produits.map(p => <option key={p.id} value={p.id}>{p.code} – {p.designation}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Qté</label>
              <input
                type="number"
                min="1"
                value={ajoutProduit.quantite}
                onChange={(e) => setAjoutProduit(a => ({ ...a, quantite: e.target.value }))}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">P.U (HT)</label>
              <input
                type="number"
                value={ajoutProduit.prixUnitaire}
                onChange={(e) => setAjoutProduit(a => ({ ...a, prixUnitaire: e.target.value }))}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Remise</label>
              <div className="flex">
                <input
                  type="number"
                  value={ajoutProduit.remise}
                  onChange={(e) => setAjoutProduit(a => ({ ...a, remise: e.target.value }))}
                  className="w-full rounded-l border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setAjoutProduit(a => ({ ...a, remiseType: a.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT' }))}
                  className="bg-gray-100 border border-l-0 border-gray-200 px-2 text-xs font-bold rounded-r"
                >
                  {ajoutProduit.remiseType === 'MONTANT' ? 'F' : '%'}
                </button>
              </div>
            </div>
            <button type="button" onClick={addLigne} className="rounded bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600">Ajouter</button>
          </div>

          {/* Liste des lignes */}
          {formData.lignes.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left">Article</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2 text-right">P.U (HT)</th>
                    <th className="px-3 py-2 text-right">Remise</th>
                    <th className="px-3 py-2 text-right">TVA</th>
                    <th className="px-3 py-2 text-right">Total TTC</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formData.lignes.map((l: Ligne, i: number) => {
                    const lTTC = ( (l.quantite * l.prixUnitaire) - (l.remise || 0) ) * (1 + (l.tvaPerc || 0) / 100)
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">{l.designation} <span className="text-[10px] text-gray-400">{l.code}</span></td>
                        <td className="px-3 py-2 text-right font-medium">{l.quantite}</td>
                        <td className="px-3 py-2 text-right">{l.prixUnitaire.toLocaleString()} F</td>
                        <td className="px-3 py-2 text-right text-red-600">-{ (l.remise || 0).toLocaleString() } F</td>
                        <td className="px-3 py-2 text-right text-gray-500">{l.tvaPerc}%</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{Math.round(lTTC).toLocaleString()} F</td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => removeLigne(i)} className="text-red-500 hover:text-red-700"><Trash className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totaux et Facturation */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-gray-200 p-4 bg-gray-50/30">
            <h3 className="font-bold text-gray-900 border-b pb-2">Règlement & Paiements</h3>
            
            <div className="space-y-3">
              {formData.reglements.map((r: { mode: string; montant: string }, i: number) => (
                <div key={i} className="flex gap-2 items-center animate-in slide-in-from-left-1">
                  <select
                    value={r.mode}
                    onChange={(e) => updateReglement(i, 'mode', e.target.value)}
                    className="rounded border border-gray-200 px-3 py-2 text-sm focus:border-orange-500"
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="CREDIT">Crédit</option>
                  </select>
                  <input
                    type="number"
                    value={r.montant}
                    onChange={(e) => updateReglement(i, 'montant', e.target.value)}
                    placeholder="Montant versé"
                    className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm"
                  />
                  {formData.reglements.length > 1 && (
                    <button type="button" onClick={() => removeReglement(i)} className="p-2 text-red-500 hover:bg-red-50 rounded"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addReglement} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> Ajouter un autre mode de paiement
              </button>
            </div>

            <div className="pt-4 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Observation / Notes</label>
              <textarea
                value={formData.observation}
                onChange={(e) => setFormData(f => ({ ...f, observation: e.target.value }))}
                className="w-full rounded border border-gray-200 px-3 py-2 text-sm h-16"
                placeholder="Notes internes ou sur la facture..."
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-orange-50/30 p-5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total HT brut :</span>
              <span className="font-medium">{totalHT.toLocaleString()} F</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Remises cumulées :</span>
              <span>-{(totalRemise).toLocaleString()} F</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-600">
              <span>TVA Totale :</span>
              <span>+{Math.round(totalTVA).toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-t border-orange-200 pt-3">
              <span className="text-lg font-bold text-gray-900">NET À PAYER :</span>
              <span className="text-2xl font-black text-orange-600">{total.toLocaleString()} FCFA</span>
            </div>
            
            <div className="mt-4 rounded-lg bg-orange-100 p-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-orange-700" />
                <span className="text-sm font-bold text-orange-800">Points fidélité :</span>
              </div>
              <span className="text-lg font-black text-orange-900">+{pointsGagnes} pts</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t pt-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-6 py-2.5 font-bold text-gray-700 hover:bg-gray-50">Annuler</button>
          <button 
            type="submit" 
            disabled={submitting || formData.lignes.length === 0} 
            className="rounded-lg bg-orange-500 px-8 py-2.5 text-white font-black shadow-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (initialData ? 'Mettre à jour' : 'VALIDER LA VENTE')}
          </button>
        </div>
      </form>

      {scannerOpen && (
        <BarcodeScanner 
          onScan={handleBarcodeScan} 
          onClose={() => setScannerOpen(false)} 
        />
      )}
    </div>
  )
}
