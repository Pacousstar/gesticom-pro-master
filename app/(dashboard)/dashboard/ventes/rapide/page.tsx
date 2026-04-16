'use client'

import { useState, useEffect, useRef } from 'react'
import { ShoppingCart, Trash2, Printer, X, Search, CreditCard, Plus, Minus, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { addToSyncQueue } from '@/lib/offline-sync'

type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  prixVente: number | null; 
  prixAchat?: number | null;
  prixMinimum?: number | null;
  stocks?: Array<{ magasinId: number; quantite: number }>
}
type Ligne = { produitId: number; designation: string; quantite: number; prixUnitaire: number; montant: number }

export default function VenteRapidePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [magasins, setMagasins] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [magasinId, setMagasinId] = useState('')
  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Ligne[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [modePaiement, setModePaiement] = useState('ESPECES')
  const [remise, setRemise] = useState('0')
  const [montantPaye, setMontantPaye] = useState('')
  const [numeroBon, setNumeroBon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const { success: showSuccess, error: showError } = useToast()
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentButtonRef = useRef<HTMLButtonElement>(null)

  // Chargement initial
  useEffect(() => {
    Promise.all([
      fetch('/api/produits?complet=1').then(r => r.ok ? r.json() : []),
      fetch('/api/magasins').then(r => r.ok ? r.json() : []),
      fetch('/api/clients').then(r => r.ok ? r.json() : [])
    ]).then(([p, m, c]) => {
      setProduits(Array.isArray(p) ? p : [])
      setMagasins(Array.isArray(m) ? m : [])
      const clientData = c.data && Array.isArray(c.data) ? c.data : (Array.isArray(c) ? c : [])
      setClients(clientData)
      
      if (m.length > 0) setMagasinId(String(m[0].id))
      setLoading(false)
    })
  }, [])

  // Focus permanent sur la recherche
  useEffect(() => {
    if (!showPayment) {
      searchInputRef.current?.focus()
    }
  }, [showPayment])

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault()
        if (cart.length > 0) {
          setShowPayment(true)
          setMontantPaye('')
        }
      }
      if (e.key === 'F10' && showPayment) {
        e.preventDefault()
        handleValidate()
      }
      if (e.key === 'Escape') {
        setShowPayment(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, showPayment])

  const totalBrut = cart.reduce((acc, l) => acc + l.montant, 0)
  const remiseVal = Number(remise) || 0
  const total = Math.max(0, totalBrut - remiseVal)

  const handleSearch = (val: string) => {
    setSearch(val)
  }

  // Support Barcode Scanners (Enter key)
  const handleKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      const val = search.trim()
      const p = produits.find(p => p.code.toLowerCase() === val.toLowerCase() || (p as any).codeBarres === val)
      if (p) {
        addToCart(p)
        setSearch('')
      } else {
        showError(`Produit non trouvé : ${val}`)
        setSearch('')
      }
    }
  }

  // Auto-search for short codes with debounce (optional but safer)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 3) {
        const p = produits.find(p => p.code.toLowerCase() === search.toLowerCase() || (p as any).codeBarres === search)
        if (p) {
          addToCart(p)
          setSearch('')
        }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const addToCart = (p: any) => {
    // Vérification du stock (Point 2)
    const st = p.stocks?.find((s: any) => s.magasinId === Number(magasinId))
    const qteDispo = st?.quantite || 0
    const existing = cart.find(l => l.produitId === p.id)
    const qteActuelle = existing ? existing.quantite : 0

    if (qteActuelle + 1 > qteDispo) {
      showError(`⚠️ Stock insuffisant pour ${p.designation}. Disponible: ${qteDispo}`)
      return
    }

    // Blocage Prix Minimum (PVM)
    const pMin = (p as any).prixMinimum || 0
    const pu = p.prixVente || p.prixAchat || 0
    if (pMin > 0 && pu < pMin) {
      showError(`🚨 PRIX INSUFFISANT : Le prix de vente minimum autorisé pour ${p.designation} est de ${pMin.toLocaleString('fr-FR')} FCFA.`)
      return
    }

    setCart(prev => {
      if (existing) {
        return prev.map(l => l.produitId === p.id ? { ...l, quantite: l.quantite + 1, montant: (l.quantite + 1) * l.prixUnitaire } : l)
      }
      const pu = p.prixVente || p.prixAchat || 0
      return [...prev, { produitId: p.id, designation: p.designation, quantite: 1, prixUnitaire: pu, montant: pu }]
    })
    showSuccess(`Ajouté : ${p.designation}`)
  }

  const updateQty = (id: number, delta: number) => {
    if (delta > 0) {
      const p = produits.find(produit => produit.id === id) as any
      const st = p?.stocks?.find((s: any) => s.magasinId === Number(magasinId))
      const qteDispo = st?.quantite || 0
      const existing = cart.find(l => l.produitId === id)
      if (existing && existing.quantite + delta > qteDispo) {
        showError(`⚠️ Stock insuffisant. Disponible: ${qteDispo}`)
        return
      }
    }
    setCart(prev => prev.map(l => l.produitId === id ? { ...l, quantite: Math.max(1, l.quantite + delta), montant: Math.max(1, l.quantite + delta) * l.prixUnitaire } : l))
  }

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(l => l.produitId !== id))
  }

  const handleValidate = async () => {
    setSubmitting(true)

    const numAuto = `VR-${Math.floor(Date.now() / 1000)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase()
    
    const requestData = {
      numero: numAuto,
      magasinId: Number(magasinId),
      clientId: clientId ? Number(clientId) : null,
      modePaiement,
      montantPaye: modePaiement === 'CREDIT' ? (montantPaye !== '' ? Number(montantPaye) : 0) : Number(montantPaye) || total,
      remiseGlobale: remiseVal,
      numeroBon: numeroBon || null,
      lignes: cart.map(l => ({
        produitId: l.produitId,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire
      }))
    }

    try {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (res.ok || res.status === 409) {
        showSuccess(res.status === 409 ? 'Vente déjà enregistrée (Doublon ignoré).' : 'Vente validée avec succès !')
        setCart([])
        setShowPayment(false)
        setSearch('')
        setRemise('0')
        setMontantPaye('')
        setNumeroBon('')
      } else {
        const d = await res.json()
        showError(formatApiError(d.error))
      }
    } catch (e: any) {
      // --- LOGIQUE HORS-LIGNE ---
      const isNetworkError = e instanceof TypeError || String(e).includes('fetch') || !navigator.onLine
      
      if (isNetworkError) {
        addToSyncQueue({
          action: 'CREATE',
          entity: 'VENTE',
          data: requestData,
          endpoint: '/api/ventes',
          method: 'POST'
        })
        
        showSuccess('Vente enregistrée localement (HORS-LIGNE) !')
        setCart([])
        setShowPayment(false)
        setSearch('')
        setRemise('0')
        setMontantPaye('')
        setNumeroBon('')
      } else {
        showError('Erreur lors de la validation : ' + formatApiError(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900"><Loader2 className="h-10 w-10 animate-spin text-orange-500" /></div>

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 p-4 text-white">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ShoppingCart className="h-8 w-8 text-orange-500" />
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Vente Rapide <span className="text-orange-500 underline">PRO</span></h1>
        </div>
        <div className="flex gap-4">
          <select 
            value={magasinId} 
            onChange={e => setMagasinId(e.target.value)}
            className="rounded-lg bg-slate-800 border-2 border-slate-700 px-4 py-2 text-sm font-bold focus:border-orange-500 outline-none"
          >
            {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select 
            value={clientId} 
            onChange={e => setClientId(e.target.value)}
            className="rounded-lg bg-slate-800 border-2 border-slate-700 px-4 py-2 text-sm font-bold focus:border-orange-500 outline-none"
          >
            <option value="">Client de passage</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Cart Side */}
        <div className="flex flex-1 flex-col rounded-3xl bg-slate-800 p-6 shadow-2xl border border-slate-700">
          <div className="mb-4 flex items-center gap-3">
             <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-6 w-6" />
                <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    onKeyDown={handleKeyDownInput}
                    placeholder="Scanner ou saisir code produit... (ENTRÉE)"
                    className="w-full rounded-2xl bg-slate-900 border-2 border-slate-700 py-4 pl-12 pr-4 text-xl font-bold placeholder:text-slate-600 focus:border-orange-500 outline-none transition-all"
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center opacity-20">
                    <ShoppingCart className="h-32 w-32" />
                    <p className="mt-4 text-2xl font-bold">Panier vide</p>
                </div>
            ) : (
                cart.map(l => (
                    <div key={l.produitId} className="flex items-center justify-between rounded-2xl bg-slate-900 p-4 border border-slate-700/50 hover:border-slate-500 transition-colors">
                        <div className="flex-1">
                            <p className="text-xl font-bold">{l.designation}</p>
                            <p className="text-sm text-slate-400">{l.prixUnitaire.toLocaleString('fr-FR')} F / unité</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(l.produitId, -1)} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700 transition-colors"><Minus className="h-6 w-6" /></button>
                                <span className="w-12 text-center text-3xl font-black">{l.quantite}</span>
                                <button onClick={() => updateQty(l.produitId, 1)} className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700 transition-colors"><Plus className="h-6 w-6" /></button>
                            </div>
                            <p className="w-32 text-right text-2xl font-black text-orange-400">{l.montant.toLocaleString('fr-FR')} F</p>
                            <button onClick={() => removeItem(l.produitId)} className="text-red-500 hover:text-red-400 p-2"><Trash2 className="h-6 w-6" /></button>
                        </div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Totals Side */}
        <div className="w-96 flex flex-col gap-6">
            <div className="rounded-3xl bg-orange-600 p-8 shadow-2xl shadow-orange-900/40">
                <p className="text-lg font-bold uppercase opacity-80">Total à payer</p>
                <p className="mt-2 text-5xl font-black tracking-tighter leading-none">{total.toLocaleString('fr-FR')} F</p>
                <div className="mt-6 border-t border-white/20 pt-4">
                    <p className="text-sm font-medium opacity-80">Articles : {cart.reduce((a, b) => a + b.quantite, 0)}</p>
                </div>
            </div>

            <div className="flex-1 rounded-3xl bg-slate-800 p-6 border border-slate-700 space-y-4">
                <h3 className="text-xl font-bold border-b border-slate-700 pb-2 mb-4">Détails & Raccourcis</h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remise Globale (F)</label>
                        <input 
                            type="number"
                            value={remise}
                            onChange={e => setRemise(e.target.value)}
                            className="w-full rounded-xl bg-slate-900 border-2 border-slate-700 p-3 text-lg font-black text-orange-400 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="font-medium text-sm">Sous-total</span>
                            <span className="font-bold text-slate-200">{totalBrut.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="font-medium text-sm">Remise</span>
                            <span className="font-bold text-red-400">-{remiseVal.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 border-t border-slate-700 pt-2">
                            <span className="font-black text-sm text-white uppercase">Net à payer</span>
                            <span className="font-black text-xl text-orange-500">{total.toLocaleString('fr-FR')} F</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-3">
                    <div className="flex justify-between items-center text-slate-500">
                        <span className="font-medium text-xs uppercase tracking-widest">Règlement</span>
                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold border border-slate-700">F12</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                        <span className="font-medium text-xs uppercase tracking-widest">Valider</span>
                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold border border-slate-700">F10</span>
                    </div>
                </div>

                <div className="mt-auto pt-4 space-y-3">
                    <button 
                        onClick={() => cart.length > 0 && setShowPayment(true)}
                        disabled={cart.length === 0}
                        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 py-6 text-2xl font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-xl disabled:opacity-30"
                    >
                        <CreditCard className="h-8 w-8" />
                        ENCAISSER (F12)
                    </button>
                    <button 
                        onClick={() => { if(confirm('Vider le panier ?')) setCart([]) }}
                        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-700 py-3 font-bold text-slate-400 hover:bg-slate-700 transition-colors"
                    >
                        <X className="h-5 w-5" />
                        VIDER LE PANIER
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
              <div className="w-full max-w-2xl rounded-[40px] bg-slate-900 p-10 shadow-3xl border-2 border-slate-800 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-10">
                      <div>
                        <h2 className="text-4xl font-black italic tracking-tighter">RÈGLEMENT <span className="text-orange-500">PRO</span></h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Finalisation de la transaction</p>
                      </div>
                      <button onClick={() => setShowPayment(false)} className="rounded-2xl bg-slate-800 p-3 hover:bg-red-500 transition-all group">
                        <X className="h-8 w-8 text-slate-400 group-hover:text-white" />
                      </button>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-10">
                      <div className="p-8 rounded-3xl bg-slate-800/50 border border-slate-700 text-center">
                          <p className="text-slate-500 font-bold uppercase text-xs mb-2 tracking-widest">Net à payer</p>
                          <p className="text-5xl font-black text-white tracking-tighter italic">{total.toLocaleString('fr-FR')} F</p>
                      </div>
                      <div className="p-8 rounded-3xl bg-orange-500 text-white text-center shadow-xl shadow-orange-900/20">
                          <p className="text-orange-100 font-bold uppercase text-xs mb-2 tracking-widest">Reste à payer</p>
                          <p className="text-5xl font-black tracking-tighter italic">
                            {(total - (Number(montantPaye) || (modePaiement === 'CREDIT' ? 0 : total))).toLocaleString('fr-FR')} F
                          </p>
                      </div>
                  </div>

                  <div className="space-y-6 mb-10">
                    <div>
                        <label className="block text-sm font-black text-slate-400 uppercase mb-3 tracking-widest">Mode de règlement</label>
                        <div className="grid grid-cols-3 gap-3">
                            {['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CREDIT'].map(m => (
                                <button 
                                    key={m}
                                    onClick={() => setModePaiement(m)}
                                    className={`rounded-2xl border-2 py-4 px-2 text-sm font-black transition-all ${modePaiement === m ? 'bg-orange-600 border-orange-400 shadow-lg shadow-orange-900/40 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    {m.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest">Montant Encaissé (F)</label>
                            <input 
                                type="number"
                                autoFocus
                                value={montantPaye}
                                onChange={e => setMontantPaye(e.target.value)}
                                placeholder={modePaiement === 'CREDIT' ? '0' : String(total)}
                                className="w-full rounded-2xl bg-slate-800 border-2 border-slate-700 p-5 text-3xl font-black text-emerald-400 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest">Rendu / Trop perçu</label>
                            <div className="w-full rounded-2xl bg-slate-950 border-2 border-slate-800 p-5 text-3xl font-black text-slate-600 italic">
                                {Math.max(0, (Number(montantPaye) || 0) - total).toLocaleString('fr-FR')} F
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest text-orange-500">Numéro de BON (Facultatif)</label>
                        <input 
                            type="text"
                            value={numeroBon}
                            onChange={e => setNumeroBon(e.target.value)}
                            placeholder="Ex: BON-2024-001"
                            className="w-full rounded-2xl bg-slate-800 border-2 border-slate-700 p-4 text-xl font-bold text-white focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                        />
                    </div>
                  </div>

                  <button 
                    onClick={handleValidate}
                    disabled={submitting || (modePaiement === 'CREDIT' && !clientId)}
                    className="w-full flex items-center justify-center gap-4 rounded-[30px] bg-emerald-600 py-8 text-4xl font-black shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                      {submitting ? <Loader2 className="h-12 w-12 animate-spin" /> : (
                          <>
                            <Printer className="h-10 w-10 text-emerald-200" />
                            VALIDER (F10)
                          </>
                      )}
                  </button>
                  <p className="mt-6 text-center text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">Appuyez sur <span className="text-slate-300 bg-slate-800 px-2 py-1 rounded mx-1 italic">ESC</span> pour revenir au panier</p>
              </div>
          </div>
      )}
    </div>
  )
}
