'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

type Produit = {
  id: number
  code: string
  designation: string
  prixVente: number | null
  prixMinimum: number | null
  categorie: string | null
  stocks?: Array<{ magasinId: number; quantite: number }>
}

type CartItem = {
  produitId: number
  designation: string
  quantite: number
  prixUnitaire: number
  montant: number
}

const MODES = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CREDIT'] as const

export default function MobileVentesPage() {
  const [magasins, setMagasins] = useState<any[]>([])
  const [magasinId, setMagasinId] = useState('')
  const [produits, setProduits] = useState<Produit[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [modePaiement, setModePaiement] = useState<string>('ESPECES')
  const [montantPaye, setMontantPaye] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState<any>(null)
  const { success: toastSuccess, error: toastError } = useToast()

  useEffect(() => {
    Promise.all([
      fetch('/api/produits?complet=1').then(r => r.ok ? r.json() : []),
      fetch('/api/magasins').then(r => r.ok ? r.json() : []),
    ]).then(([p, m]) => {
      if (Array.isArray(p)) setProduits(p)
      if (Array.isArray(m) && m.length > 0) {
        setMagasins(m)
        setMagasinId(String(m[0].id))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const total = cart.reduce((s, i) => s + i.montant, 0)

  useEffect(() => {
    if (montantPaye === '' && total > 0 && showPayment) {
      setMontantPaye(String(total))
    }
  }, [showPayment, montantPaye, total])

  const searchLower = search.toLowerCase()
  const filtered = produits.filter(p =>
    !search || p.designation.toLowerCase().includes(searchLower) ||
    (p.code && p.code.toLowerCase().includes(searchLower))
  )

  function addToCart(produit: Produit) {
    const exist = cart.find(i => i.produitId === produit.id)
    if (exist) {
      setCart(cart.map(i =>
        i.produitId === produit.id
          ? { ...i, quantite: i.quantite + 1, montant: (i.quantite + 1) * i.prixUnitaire }
          : i
      ))
    } else {
      const pu = produit.prixVente || 0
      setCart([...cart, {
        produitId: produit.id,
        designation: produit.designation,
        quantite: 1,
        prixUnitaire: pu,
        montant: pu,
      }])
    }
    setSearch('')
  }

  function updateQty(produitId: number, delta: number) {
    setCart(cart.map(i =>
      i.produitId === produitId
        ? { ...i, quantite: Math.max(1, i.quantite + delta), montant: Math.max(1, i.quantite + delta) * i.prixUnitaire }
        : i
    ))
  }

  function removeFromCart(produitId: number) {
    setCart(cart.filter(i => i.produitId !== produitId))
  }

  async function handleSubmit() {
    if (!magasinId || cart.length === 0) return
    setSubmitting(true)
    try {
      const payload = {
        magasinId: Number(magasinId),
        lignes: cart.map(i => ({
          produitId: i.produitId,
          quantite: i.quantite,
          prixUnitaire: i.prixUnitaire,
          tva: 0,
          remise: 0,
        })),
        modePaiement,
        montantPaye: modePaiement === 'CREDIT' ? 0 : (Number(montantPaye) || total),
      }
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toastError(data?.error || data?.message || 'Erreur lors de la création de la vente')
        return
      }
      setSuccess(data)
      setCart([])
      setSearch('')
      setShowPayment(false)
      toastSuccess(`Vente ${data.numero || ''} créée avec succès`)
    } catch {
      toastError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  )

  if (success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 gap-4">
        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <p className="text-xl font-black text-white">Vente effectuée</p>
        <p className="text-sm text-gray-400">
          {success.numero} — {(success.montantTotal || total).toLocaleString('fr-FR')} F
        </p>
        <button
          onClick={() => setSuccess(null)}
          className="mt-4 w-full rounded-xl bg-orange-600 py-4 font-bold text-white active:scale-95 transition-transform"
        >
          Nouvelle vente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-orange-400" />
          <span className="font-black text-sm">Nouvelle Vente</span>
        </div>
        <select
          value={magasinId}
          onChange={e => setMagasinId(e.target.value)}
          className="bg-gray-800 text-white text-xs font-bold rounded-lg px-2 py-1 border border-gray-700"
        >
          {magasins.map((m: any) => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full rounded-xl bg-gray-900 border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 font-bold"
          />
        </div>
      </div>

      {/* Products list */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="space-y-2">
          {search && filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Aucun produit trouvé</p>
          )}
          {filtered.slice(0, 30).map(p => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="w-full flex items-center gap-3 bg-gray-900 rounded-xl p-3 border border-gray-800 active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{p.designation}</p>
                <p className="text-xs text-gray-400">
                  {p.categorie || 'Général'} — {(p.prixVente || 0).toLocaleString('fr-FR')} F
                </p>
              </div>
              <span className="text-orange-400 font-black text-sm shrink-0">
                {(p.prixVente || 0).toLocaleString('fr-FR')} F
              </span>
            </button>
          ))}
          {!search && filtered.length === 0 && (
            <p className="text-center text-gray-500 py-8 text-sm">Aucun produit disponible</p>
          )}
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="bg-gray-900 border-t border-gray-800 rounded-t-2xl px-4 pt-3 pb-2 shrink-0">
          <div className="max-h-40 overflow-y-auto space-y-1.5 mb-3">
            {cart.map(item => (
              <div key={item.produitId} className="flex items-center gap-2">
                <p className="flex-1 text-xs font-bold text-white truncate">{item.designation}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.produitId, -1)} className="h-7 w-7 rounded-lg bg-gray-800 flex items-center justify-center active:scale-90">
                    <Minus className="h-3 w-3 text-gray-300" />
                  </button>
                  <span className="text-sm font-black text-white w-6 text-center">{item.quantite}</span>
                  <button onClick={() => updateQty(item.produitId, 1)} className="h-7 w-7 rounded-lg bg-gray-800 flex items-center justify-center active:scale-90">
                    <Plus className="h-3 w-3 text-gray-300" />
                  </button>
                </div>
                <p className="text-xs font-bold text-orange-400 w-20 text-right">{item.montant.toLocaleString('fr-FR')} F</p>
                <button onClick={() => removeFromCart(item.produitId)} className="h-7 w-7 rounded-lg bg-red-900/30 flex items-center justify-center active:scale-90">
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400 font-bold">Total</p>
            <p className="text-lg font-black text-white">{total.toLocaleString('fr-FR')} F</p>
          </div>
          <button
            onClick={() => setShowPayment(true)}
            className="mt-2 w-full rounded-xl bg-orange-600 py-3 font-bold text-white text-sm active:scale-95 transition-transform"
          >
            Payer
          </button>
        </div>
      )}

      {/* Payment overlay */}
      {showPayment && (
        <div className="absolute inset-0 bg-black/80 z-10 flex flex-col justify-end">
          <div className="bg-gray-900 rounded-t-3xl p-6 border-t border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-white text-lg">Paiement</p>
              <p className="font-black text-orange-400 text-lg">{total.toLocaleString('fr-FR')} F</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {MODES.map(mode => (
                <button
                  key={mode}
                  onClick={() => setModePaiement(mode)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    modePaiement === mode
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {mode === 'ESPECES' ? 'Espèces' :
                   mode === 'MOBILE_MONEY' ? 'Mobile Money' :
                   mode === 'CHEQUE' ? 'Chèque' :
                   mode === 'VIREMENT' ? 'Virement' : 'Crédit'}
                </button>
              ))}
            </div>

            {modePaiement !== 'CREDIT' && (
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-400 mb-1 block">Montant payé</label>
                <input
                  type="number"
                  value={montantPaye}
                  onChange={e => setMontantPaye(e.target.value)}
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-white font-bold text-lg"
                  min={0}
                  max={total}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowPayment(false); setMontantPaye('') }}
                className="flex-1 rounded-xl bg-gray-800 py-3 font-bold text-gray-300 text-sm active:scale-95 transition-transform"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-orange-600 py-3 font-bold text-white text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  'Confirmer la vente'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
