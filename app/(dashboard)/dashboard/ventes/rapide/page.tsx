'use client'

import { useState, useEffect, useRef } from 'react'
import { ShoppingCart, Trash2, Printer, X, Search, CreditCard, Plus, Minus, Loader2, Building2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { formatApiError } from '@/lib/validation-helpers'
import { estModeBanque } from '@/lib/banque'
import { pointsFideliteDepuisEncaissement } from '@/lib/calculs-commerciaux'

type Produit = { 
  id: number; 
  code: string; 
  designation: string; 
  prixVente: number | null; 
  prixAchat?: number | null;
  prixMinimum?: number | null;
  stocks?: Array<{ magasinId: number; quantite: number }>
  categorie?: string
}
type Ligne = { produitId: number; designation: string; quantite: number; prixUnitaire: number; remise: number; remiseType: 'MONTANT' | 'POURCENT'; remiseInput: string; montant: number }

export default function VenteRapidePage() {
  const [produits, setProduits] = useState<Produit[]>([])
  const [magasins, setMagasins] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [banques, setBanques] = useState<any[]>([])
  const [magasinId, setMagasinId] = useState('')
  const [clientId, setClientId] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Ligne[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [modePaiement, setModePaiement] = useState('ESPECES')
  const [banqueId, setBanqueId] = useState('')
  const [remise, setRemise] = useState('0')
  const [montantPaye, setMontantPaye] = useState('')
  const [numeroBon, setNumeroBon] = useState('')
  const [observation, setObservation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedCategorie, setSelectedCategorie] = useState<string>('TOUS')
  const [categories, setCategories] = useState<string[]>([])
  const { success: showSuccess, error: showError } = useToast()
  const [lastSale, setLastSale] = useState<any>(null)
  const printFrameRef = useRef<HTMLIFrameElement>(null)
  
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Chargement initial
  useEffect(() => {
    Promise.all([
      fetch('/api/produits?complet=1').then(r => r.ok ? r.json() : []),
      fetch('/api/magasins').then(r => r.ok ? r.json() : []),
      fetch('/api/clients').then(r => r.ok ? r.json() : []),
      fetch('/api/banques').then(r => r.ok ? r.json() : [])
    ]).then(([p, m, c, b]) => {
      const pList = Array.isArray(p) ? p : []
      setProduits(pList)
      setMagasins(Array.isArray(m) ? m : [])
      const clientData = c.data && Array.isArray(c.data) ? c.data : (Array.isArray(c) ? c : [])
      setClients(clientData)
      const banqueData = b.data && Array.isArray(b.data) ? b.data : (Array.isArray(b) ? b : [])
      setBanques(banqueData.filter((banque: any) => banque.actif !== false))
      
      // Extraction des catégories uniques
      const cats = Array.from(new Set(pList.map((prod: any) => prod.categorie).filter(Boolean))) as string[]
      setCategories(cats.sort())

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

  const sousTotal = cart.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0)
  const totalRemisesLignes = cart.reduce((acc, l) => acc + l.remise, 0)
  const remiseVal = Math.max(0, Math.min(Number(remise) || 0, sousTotal - totalRemisesLignes))
  const total = sousTotal - totalRemisesLignes - remiseVal

  const montantEffectifPaye = modePaiement === 'CREDIT' ? (Number(montantPaye) || 0) : (Number(montantPaye) || total)
  const pointsGagnes = pointsFideliteDepuisEncaissement(montantEffectifPaye)

  const selectedClient = clients.find(c => String(c.id) === clientId)

  const creditAlerte = (() => {
    if (modePaiement !== 'CREDIT' || !selectedClient || selectedClient.type !== 'CREDIT') return null
    const plafond = selectedClient.plafondCredit || 0
    const detteReelle = (selectedClient.dette || 0)
    const nouveauCredit = total - (Number(montantPaye) || 0)
    const totalApres = detteReelle + Math.max(0, nouveauCredit)
    if (plafond <= 0) return { niveau: 'error', msg: 'Aucun plafond crédit défini pour ce client.' }
    if (totalApres > plafond) return { niveau: 'error', msg: `Plafond dépassé ! (${totalApres.toLocaleString()} F / ${plafond.toLocaleString()} F)` }
    const ratio = totalApres / plafond
    if (ratio >= 0.9) return { niveau: 'warning', msg: `Attention : ${Math.round(ratio * 100)}% du plafond atteint (${plafond.toLocaleString()} F)` }
    return null
  })()

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
    const pu = p.prixVente ?? 0
    if (pMin > 0 && pu < pMin) {
      showError(`🚨 PRIX INSUFFISANT : Le prix de vente minimum autorisé pour ${p.designation} est de ${pMin.toLocaleString('fr-FR')} FCFA.`)
      return
    }

    setCart(prev => {
      if (existing) {
        return prev.map(l => l.produitId === p.id ? { ...l, quantite: l.quantite + 1, montant: (l.quantite + 1) * l.prixUnitaire - l.remise } : l)
      }
      const pu = p.prixVente ?? 0
      return [...prev, { produitId: p.id, designation: p.designation, quantite: 1, prixUnitaire: pu, remise: 0, remiseType: 'MONTANT' as const, remiseInput: '', montant: pu }]
    })
    showSuccess(`Ajouté : ${p.designation}`)
  }

  const updateQty = (id: number, delta: number) => {
    const p = produits.find(produit => produit.id === id) as any
    const st = p?.stocks?.find((s: any) => s.magasinId === Number(magasinId))
    const qteDispo = st?.quantite || 0
    const existing = cart.find(l => l.produitId === id)
    const newQte = (existing?.quantite || 0) + delta
    
    if (delta > 0 && newQte > qteDispo) {
      showError(`⚠️ Stock insuffisant. Disponible: ${qteDispo}`)
      return
    }
    
    if (newQte < 1) {
      removeItem(id)
      return
    }
    
    // Vérification prix minimum (PVM) lors de l'augmentation
    if (delta > 0) {
      const pMin = (p as any).prixMinimum || 0
      if (pMin > 0 && (p.prixVente || p.prixAchat || 0) < pMin) {
        showError(`🚨 PRIX INSUFFISANT : Le prix de vente minimum est de ${pMin.toLocaleString('fr-FR')} F`)
        return
      }
    }
    
    setCart(prev => prev.map(l => l.produitId === id ? { ...l, quantite: newQte, montant: newQte * l.prixUnitaire - l.remise } : l))
  }

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(l => l.produitId !== id))
  }

  const handleValidate = async () => {
    if (!magasinId || cart.length === 0) return
    
    if (estModeBanque(modePaiement) && !banqueId) {
      showError('Veuillez sélectionner une banque pour ce mode de règlement.')
      return
    }

    if (creditAlerte?.niveau === 'error') {
      showError(creditAlerte.msg)
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        magasinId: Number(magasinId),
        clientId: clientId ? Number(clientId) : null,
        modePaiement,
        montantPaye: modePaiement === 'CREDIT' ? (montantPaye !== '' ? Number(montantPaye) : 0) : Number(montantPaye) || total,
        remiseGlobale: remiseVal,
        numeroBon: numeroBon || null,
        observation: observation || null,
        estVenteRapide: true,
        pointsGagnes,
        lignes: cart.map(l => ({
          produitId: l.produitId,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          remise: l.remise
        }))
      }
      if (estModeBanque(modePaiement) && banqueId) {
        payload.banqueId = Number(banqueId)
      }

      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const saleData = await res.json()
        setLastSale(saleData)
        showSuccess('Vente validée avec succès !')
        setCart([])
        setShowPayment(false)
        setSearch('')
        setRemise('0')
        setMontantPaye('')
        setNumeroBon('')
        setObservation('')
        setBanqueId('')
        setModePaiement('ESPECES')
        setTimeout(() => imprimerTicket(saleData), 500)
      } else {
        const d = await res.json()
        showError(formatApiError(d.error))
      }
    } catch (e) {
      showError('Erreur lors de la validation')
    } finally {
      setSubmitting(false)
    }
  }

  function imprimerTicket(sale: any) {
    const iframe = printFrameRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow!.document
    doc.open()
    doc.write(`
      <html>
      <head>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; padding: 10px; margin: 0; }
          .header { text-align: center; margin-bottom: 8px; }
          .header h1 { font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase; }
          .header p { font-size: 10px; margin: 2px 0; color: #555; }
          .separator { border-top: 1px dashed #000; margin: 8px 0; }
          .ligne { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
          .ligne .qte { width: 30px; text-align: left; }
          .ligne .des { flex: 1; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .ligne .pu { width: 70px; text-align: right; }
          .ligne .mt { width: 80px; text-align: right; font-weight: bold; }
          .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
          .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
          .infos { font-size: 10px; margin: 4px 0; }
          .infos span { display: block; }
          .merci { text-align: center; font-size: 14px; font-weight: bold; margin-top: 10px; letter-spacing: 2px; }
          .btn-print { display: none; }
          @media screen { .btn-print { display: block; margin: 20px auto; padding: 12px 24px; font-size: 16px; background: #f97316; color: #fff; border: none; border-radius: 8px; cursor: pointer; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${sale.entreprise?.nom || 'GestiCom Pro'}</h1>
          <p>${sale.entreprise?.localisation || ''}</p>
          <p>${sale.entreprise?.contact || ''}</p>
        </div>
        <div class="separator"></div>
        <div class="infos">
          <span>N° ${sale.numero || sale.numeroFacture || ''}</span>
          <span>Date: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          ${sale.clientLibre ? `<span>Client: ${sale.clientLibre}</span>` : ''}
        </div>
        <div class="separator"></div>
        ${(sale.lignes || []).map((l: any) => `
          <div class="ligne">
            <span class="qte">${l.quantite}x</span>
            <span class="des">${l.designation}</span>
            <span class="pu">${(l.prixUnitaire || 0).toLocaleString('fr-FR')} F</span>
            <span class="mt">${(l.montant || ((l.quantite || 0) * (l.prixUnitaire || 0))).toLocaleString('fr-FR')} F</span>
          </div>
          ${(l.remise || 0) > 0 ? `<div class="ligne" style="font-size:9px;color:#888;"><span></span><span class="des">remise</span><span></span><span class="mt">-${(l.remise || 0).toLocaleString('fr-FR')} F</span></div>` : ''}
        `).join('')}
        <div class="total">
          <span>TOTAL</span>
          <span>${(sale.montantTotal || 0).toLocaleString('fr-FR')} F</span>
        </div>
        ${sale.remiseGlobale > 0 ? `<div class="ligne"><span>Remise globale</span><span class="mt">-${sale.remiseGlobale.toLocaleString('fr-FR')} F</span></div>` : ''}
        ${sale.montantPaye > 0 ? `
          <div class="separator"></div>
          <div class="ligne"><span>Payé</span><span class="mt">${(sale.montantPaye || 0).toLocaleString('fr-FR')} F</span></div>
          <div class="ligne"><span>Rendu</span><span class="mt">${Math.max(0, (sale.montantPaye || 0) - (sale.montantTotal || 0)).toLocaleString('fr-FR')} F</span></div>
        ` : ''}
        <div class="separator"></div>
        <div class="merci">MERCI DE VOTRE VISITE !</div>
        <div class="footer">
          <p>Document généré par GestiCom Pro</p>
        </div>
        <button class="btn-print" onclick="window.print();window.close()">Imprimer le ticket</button>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 2000); }</script>
      </body>
      </html>
    `)
    doc.close()
  }

  const filteredProduits = selectedCategorie === 'TOUS' 
    ? produits.filter(p => p.designation.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    : produits.filter(p => p.categorie === selectedCategorie && (p.designation.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-900"><Loader2 className="h-10 w-10 animate-spin text-orange-500" /></div>

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 p-4 text-white">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-orange-500 p-2 shadow-lg shadow-orange-900/40">
            <ShoppingCart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic leading-none">Vente Rapide <span className="text-orange-500 underline">PRO</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Terminal de point de vente industriel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {selectedClient && (
            <div className="flex items-center gap-3">
              <div className={`flex flex-col items-end px-4 py-1 rounded-xl border ${selectedClient.dette > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                <span className="text-[10px] font-black uppercase opacity-60">{selectedClient.nom}</span>
                <span className="text-xs font-black opacity-60">{selectedClient.type === 'CREDIT' ? 'CRÉDIT' : 'COMPTANT'}</span>
                <span className={`text-lg font-black ${selectedClient.dette > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {selectedClient.dette?.toLocaleString('fr-FR')} F
                </span>
              </div>
              <div className="flex flex-col items-start px-4 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <span className="text-[10px] font-black uppercase opacity-60">Points</span>
                <span className="text-lg font-black text-blue-400">{selectedClient.pointsFidelite || 0}</span>
              </div>
              {selectedClient.type === 'CREDIT' && selectedClient.plafondCredit > 0 && (
                <div className={`flex flex-col items-start px-4 py-1 rounded-xl border ${((selectedClient.dette || 0) / selectedClient.plafondCredit) >= 0.9 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <span className="text-[10px] font-black uppercase opacity-60">Plafond</span>
                  <span className={`text-lg font-black ${((selectedClient.dette || 0) / selectedClient.plafondCredit) >= 0.9 ? 'text-red-400' : 'text-amber-400'}`}>
                    {Math.round(((selectedClient.dette || 0) / selectedClient.plafondCredit) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}
          <select 
            value={magasinId} 
            onChange={e => setMagasinId(e.target.value)}
            className="rounded-xl bg-slate-800 border-2 border-slate-700 px-4 py-3 text-sm font-bold focus:border-orange-500 outline-none transition-all shadow-lg"
          >
            {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select 
            value={clientId} 
            onChange={e => setClientId(e.target.value)}
            className="rounded-xl bg-slate-800 border-2 border-slate-700 px-4 py-3 text-sm font-bold focus:border-orange-500 outline-none transition-all shadow-lg"
          >
            <option value="">Client de passage</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Categories Side */}
        <div className="w-48 flex flex-col gap-2 overflow-y-auto pr-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedCategorie('TOUS')}
            className={`w-full rounded-2xl p-4 text-left font-black transition-all ${selectedCategorie === 'TOUS' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40 translate-x-2' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            TOUS
          </button>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategorie(cat)}
              className={`w-full rounded-2xl p-4 text-left text-xs font-black uppercase tracking-widest break-words leading-tight transition-all ${selectedCategorie === cat ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/40 translate-x-2' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog / Cart Middle */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
           {/* Grid of products (Visual selection) */}
           <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto max-h-48 pr-2">
              {filteredProduits.slice(0, 12).map(p => (
                <button 
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="group flex flex-col items-start justify-between rounded-2xl bg-slate-800 p-3 text-left border border-slate-700 hover:border-orange-500 transition-all hover:-translate-y-1 active:scale-95"
                >
                   <span className="text-[10px] font-bold text-slate-500 uppercase">{p.code}</span>
                   <span className="line-clamp-2 text-xs font-black text-white group-hover:text-orange-400">{p.designation}</span>
                   <span className="mt-2 text-sm font-black text-orange-500">{(p.prixVente || 0).toLocaleString()} F</span>
                </button>
              ))}
           </div>

           <div className="flex flex-1 flex-col rounded-3xl bg-slate-800 p-6 shadow-2xl border border-slate-700 overflow-hidden">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-6 w-6" />
                  <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={e => handleSearch(e.target.value)}
                      onKeyDown={handleKeyDownInput}
                      placeholder="Scanner ou saisir code... (ENTRÉE)"
                      className="w-full rounded-2xl bg-slate-900 border-2 border-slate-700 py-4 pl-12 pr-4 text-xl font-bold placeholder:text-slate-600 focus:border-orange-500 outline-none transition-all shadow-inner"
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
                  cart.map(l => {
                    const qte = l.quantite
                    const baseMontant = qte * l.prixUnitaire
                    const handleRemise = (val: string) => {
                      const raw = val.replace(/[^0-9.,]/g, '').replace(',', '.')
                      const num = Number(raw) || 0
                      if (l.remiseType === 'POURCENT') {
                        const pct = Math.min(num, 100)
                        const rem = Math.round(baseMontant * pct / 100)
                        setCart(prev => prev.map(x => x.produitId === l.produitId ? { ...x, remiseInput: raw, remise: rem, montant: baseMontant - rem } : x))
                      } else {
                        const rem = Math.min(num, baseMontant)
                        setCart(prev => prev.map(x => x.produitId === l.produitId ? { ...x, remiseInput: raw, remise: rem, montant: baseMontant - rem } : x))
                      }
                    }
                    const toggleRemiseType = () => {
                      setCart(prev => prev.map(x => {
                        if (x.produitId !== l.produitId) return x
                        const newType = x.remiseType === 'MONTANT' ? 'POURCENT' : 'MONTANT'
                        if (newType === 'POURCENT') {
                          const pct = baseMontant > 0 ? Math.round(x.remise / baseMontant * 100) : 0
                          return { ...x, remiseType: newType, remiseInput: String(pct), remise: Math.round(baseMontant * pct / 100), montant: baseMontant - Math.round(baseMontant * pct / 100) }
                        } else {
                          return { ...x, remiseType: newType, remiseInput: String(x.remise), montant: baseMontant - x.remise }
                        }
                      }))
                    }
                    return (
                      <div key={l.produitId} className="flex items-center justify-between rounded-2xl bg-slate-900 p-4 border border-slate-700/50 hover:border-slate-500 transition-colors animate-in slide-in-from-right-4 duration-200">
                          <div className="flex-1 min-w-0 mr-2">
                              <p className="text-xl font-bold leading-none truncate">{l.designation}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{l.prixUnitaire.toLocaleString('fr-FR')} FCFA / UNITÉ</p>
                          </div>
                          <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                                  <button onClick={() => updateQty(l.produitId, -1)} className="rounded-lg bg-slate-900 p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"><Minus className="h-4 w-4" /></button>
                                  <span className="w-10 text-center text-xl font-black">{l.quantite}</span>
                                  <button onClick={() => updateQty(l.produitId, 1)} className="rounded-lg bg-slate-900 p-2 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors"><Plus className="h-4 w-4" /></button>
                              </div>
                              <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={l.remiseInput}
                                  onChange={e => handleRemise(e.target.value)}
                                  className="w-14 bg-transparent text-center text-sm font-bold text-orange-400 outline-none px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                                <button
                                  onClick={toggleRemiseType}
                                  className={`px-2 py-2 text-[10px] font-black border-l border-slate-700 transition-colors ${l.remiseType === 'POURCENT' ? 'bg-orange-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                                >
                                  {l.remiseType === 'MONTANT' ? 'F' : '%'}
                                </button>
                              </div>
                              <p className="w-24 text-right text-xl font-black text-orange-400">{l.montant.toLocaleString('fr-FR')} F</p>
                              <button onClick={() => removeItem(l.produitId)} className="text-slate-600 hover:text-red-500 p-2 transition-colors"><Trash2 className="h-6 w-6" /></button>
                          </div>
                      </div>
                    )
                  })
               )}
             </div>
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
                            min="0"
                            value={remise}
                            onChange={e => setRemise(e.target.value)}
                            className="w-full rounded-xl bg-slate-900 border-2 border-slate-700 p-3 text-lg font-black text-orange-400 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-center text-slate-400">
                            <span className="font-medium text-sm">Sous-total</span>
                            <span className="font-bold text-slate-200">{sousTotal.toLocaleString('fr-FR')} F</span>
                        </div>
                        {totalRemisesLignes > 0 && (
                          <div className="flex justify-between items-center text-slate-400">
                              <span className="font-medium text-sm">Remises lignes</span>
                              <span className="font-bold text-red-400">-{totalRemisesLignes.toLocaleString('fr-FR')} F</span>
                          </div>
                        )}
                        {remiseVal > 0 && (
                          <div className="flex justify-between items-center text-slate-400">
                              <span className="font-medium text-sm">Remise globale</span>
                              <span className="font-bold text-red-400">-{remiseVal.toLocaleString('fr-FR')} F</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-slate-400 border-t border-slate-700 pt-3">
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
                                    onClick={() => { setModePaiement(m); if (!estModeBanque(m)) setBanqueId(''); }}
                                    className={`rounded-2xl border-2 py-4 px-2 text-sm font-black transition-all ${modePaiement === m ? 'bg-orange-600 border-orange-400 shadow-lg shadow-orange-900/40 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    {m.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        {estModeBanque(modePaiement) && (
                            <div className="mt-3">
                                <label className="block text-xs font-black text-slate-400 uppercase mb-1 tracking-widest"><Building2 className="inline h-3 w-3 mr-1" />Compte bancaire</label>
                                <select
                                    value={banqueId}
                                    onChange={e => setBanqueId(e.target.value)}
                                    className="w-full rounded-2xl bg-slate-800 border-2 border-orange-500/50 p-3 text-sm font-bold text-white focus:border-orange-500 outline-none transition-all"
                                >
                                    <option value="">Sélectionner une banque...</option>
                                    {banques.map(b => (
                                        <option key={b.id} value={b.id}>{b.nomBanque} — {b.libelle}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest leading-none">Coupures rapides</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1000, 2000, 5000, 10000, 15000, 20000].map(amt => (
                                        <button 
                                            key={amt}
                                            onClick={() => setMontantPaye(String(amt))}
                                            className="rounded-xl bg-slate-800 border-2 border-slate-700 py-3 text-xs font-black hover:bg-slate-700 hover:border-slate-500 transition-all active:scale-90"
                                        >
                                            {amt.toLocaleString()} F
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest">Montant Encaissé (F)</label>
                                <input 
                                    type="number"
                                    min="0"
                                    autoFocus
                                    value={montantPaye}
                                    onChange={e => setMontantPaye(e.target.value)}
                                    placeholder={modePaiement === 'CREDIT' ? '0' : String(total)}
                                    className="w-full rounded-2xl bg-slate-800 border-2 border-slate-700 p-5 text-4xl font-black text-emerald-400 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col justify-between">
                            <div>
                                <label className="block text-sm font-black text-slate-400 uppercase mb-2 tracking-widest uppercase">Rendu / Trop perçu</label>
                                <div className={`w-full rounded-2xl border-2 p-5 text-4xl font-black text-center italic transition-all ${Math.max(0, (Number(montantPaye) || 0) - total) > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-slate-950 border-slate-800 text-slate-700'}`}>
                                    {Math.max(0, (Number(montantPaye) || 0) - total).toLocaleString('fr-FR')} F
                                </div>
                            </div>
                            <div className="pt-4">
                                <label className="block text-[10px] font-black text-orange-500 uppercase mb-2 tracking-widest text-center leading-none">N° de Bon</label>
                                <input 
                                    type="text"
                                    value={numeroBon}
                                    onChange={e => setNumeroBon(e.target.value)}
                                    placeholder="Numéro de bon..."
                                    className="w-full rounded-2xl bg-slate-800 border-2 border-slate-700 p-4 text-lg font-bold text-white focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                            <div className="pt-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest text-center leading-none">Observation</label>
                                <input 
                                    type="text"
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                    placeholder="Notes..."
                                    className="w-full rounded-2xl bg-slate-800 border-2 border-slate-700 p-3 text-sm font-bold text-white focus:border-orange-500 outline-none transition-all placeholder:text-slate-700"
                                />
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Sous-total</p>
                      <p className="text-xl font-black text-white tabular-nums">{sousTotal.toLocaleString('fr-FR')} F</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Remises</p>
                      <p className="text-xl font-black text-red-400 tabular-nums">-{(totalRemisesLignes + remiseVal).toLocaleString('fr-FR')} F</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-center">
                      <p className="text-[10px] font-black text-orange-400 uppercase mb-1 tracking-widest">Points offerts</p>
                      <p className="text-xl font-black text-orange-400 tabular-nums">+{pointsGagnes} pts</p>
                    </div>
                  </div>

                  {creditAlerte && (
                    <div className={`mb-6 rounded-2xl p-4 text-sm font-bold uppercase tracking-widest text-center ${creditAlerte.niveau === 'error' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'}`}>
                      ⚠️ {creditAlerte.msg}
                    </div>
                  )}

                  <button 
                    onClick={handleValidate}
                    disabled={submitting || creditAlerte?.niveau === 'error' || (modePaiement === 'CREDIT' && !clientId) || (estModeBanque(modePaiement) && !banqueId)}
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
      <iframe ref={printFrameRef} style={{ position: 'absolute', width: 0, height: 0, border: 'none', top: '-9999px' }} title="impression-ticket" />
    </div>
  )
}
