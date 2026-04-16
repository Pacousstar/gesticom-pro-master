'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  ScanLine, 
  CheckCircle, 
  Loader2, 
  Search, 
  Package, 
  ArrowRight,
  Minus,
  Plus,
  Save,
  Gamepad,
  Camera,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function InventaireRapidePage() {
  const [loading, setLoading] = useState(false)
  const [magasins, setMagasins] = useState<any[]>([])
  const [selectedMagasin, setSelectedMagasin] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [produits, setProduits] = useState<any[]>([])
  const [selectedProduit, setSelectedProduit] = useState<any | null>(null)
  const [quantite, setQuantite] = useState<number>(0)
  const [observation, setObservation] = useState('')
  const [currentStock, setCurrentStock] = useState<number | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const { success, error: showError } = useToast()
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    fetch('/api/magasins').then(r => r.json()).then(setMagasins)
  }, [])

  useEffect(() => {
    if (searchTerm.length > 1) {
      fetch(`/api/produits?q=${searchTerm}`).then(r => r.json()).then(setProduits)
    } else {
      setProduits([])
    }
  }, [searchTerm])

  useEffect(() => {
    if (selectedProduit && selectedMagasin) {
      fetch(`/api/stock/produit/${selectedProduit.id}?magasinId=${selectedMagasin}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setCurrentStock(data.quantite)
            setQuantite(data.quantite) // Par défaut, on propose la qté actuelle
          }
        })
    }
  }, [selectedProduit, selectedMagasin])

  const startScanner = () => {
    setIsScanning(true)
    setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      )
      scannerRef.current.render((decodedText) => {
        setSearchTerm(decodedText)
        stopScanner()
      }, (err) => {
        // console.warn(err)
      })
    }, 100)
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setIsScanning(false)
        scannerRef.current = null
      }).catch(err => {
        console.error("Failed to clear scanner", err)
        setIsScanning(false)
      })
    } else {
      setIsScanning(false)
    }
  }

  const handleSave = async () => {
    if (!selectedProduit || !selectedMagasin) return
    setLoading(true)
    try {
      const res = await fetch('/api/stocks/inventaire-rapide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produitId: selectedProduit.id,
          magasinId: Number(selectedMagasin),
          nouvelleQuantite: Number(quantite),
          observation
        })
      })
      if (res.ok) {
        success(`Stock mis à jour : ${selectedProduit.designation}`)
        setSelectedProduit(null)
        setSearchTerm('')
        setQuantite(0)
        setCurrentStock(null)
        setObservation('')
        searchInputRef.current?.focus()
      } else {
        const d = await res.json()
        showError(d.error || "Erreur lors de la mise à jour")
      }
    } catch (e) {
      showError("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  const diff = currentStock !== null ? quantite - currentStock : 0

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto px-4">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="h-20 w-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-orange-500/30 transform -rotate-6">
          <ScanLine className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic mt-2">Inventaire Rapide</h1>
        <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.4em]">Précision & Mobilité Expert</p>
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-8 sm:p-10 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50" />
        
        {/* Étape 1 : Magasin */}
        <div className="space-y-3 relative z-10">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-500">1</span>
              Localisation
           </label>
           <select 
             value={selectedMagasin}
             onChange={e => setSelectedMagasin(e.target.value)}
             className="w-full rounded-2xl border-4 border-slate-50 bg-slate-50 px-6 py-5 text-base font-black text-slate-900 focus:border-orange-500/20 focus:bg-white outline-none transition-all shadow-sm appearance-none cursor-pointer"
           >
             <option value="">Sélectionnez le magasin...</option>
             {magasins.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
           </select>
        </div>

        {/* Scanneur Caméra */}
        {isScanning && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
            <button 
              onClick={stopScanner}
              className="absolute top-6 right-6 text-white p-4 bg-white/10 rounded-full"
            >
              <XCircle className="h-8 w-8" />
            </button>
            <div id="reader" className="w-full max-w-sm rounded-3xl overflow-hidden border-4 border-orange-500" />
            <p className="text-white mt-8 text-sm font-bold uppercase tracking-widest animate-pulse">Scan en cours...</p>
          </div>
        )}

        {/* Étape 2 : Recherche Produit */}
        <div className="space-y-3 relative z-10">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-500">2</span>
              Article
           </label>
           <div className="relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-300 group-focus-within:text-orange-500 transition-colors" />
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Nom ou Code Barres..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-3xl border-4 border-slate-50 bg-slate-50 pl-16 pr-20 py-6 text-lg font-black text-slate-900 focus:border-orange-500/20 focus:bg-white outline-none transition-all shadow-inner"
              />
              <button 
                onClick={startScanner}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center hover:bg-orange-600 hover:text-white transition-all shadow-sm active:scale-90"
                title="Scanner via caméra"
              >
                <Camera className="h-6 w-6" />
              </button>
           </div>

           {produits.length > 0 && !selectedProduit && (
             <div className="absolute z-50 left-0 top-full mt-2 w-full bg-white border border-gray-100 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.15)] max-h-[350px] overflow-y-auto overflow-hidden divide-y divide-gray-50 border-t-0 p-2">
               {produits.map(p => (
                 <button 
                   key={p.id}
                   onClick={() => {
                     setSelectedProduit(p)
                     setSearchTerm(p.designation)
                     setProduits([])
                   }}
                   className="w-full flex items-center justify-between p-5 hover:bg-orange-50 rounded-2xl transition-all text-left group"
                 >
                    <div className="flex items-center gap-4">
                       <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-orange-500 transition-colors shadow-sm">
                          <Package className="h-6 w-6" />
                       </div>
                       <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tighter group-hover:text-orange-700">{p.designation}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.code}</p>
                       </div>
                    </div>
                    <ArrowRight className="h-6 w-6 text-slate-200 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                 </button>
               ))}
             </div>
           )}
        </div>

        {/* Étape 3 : Saisie Quantité */}
        {selectedProduit && (
          <div className="animate-in zoom-in-95 fade-in duration-500 space-y-8 pt-8 border-t-2 border-slate-50 relative z-10">
             <div className="bg-gradient-to-r from-orange-50 to-white p-6 rounded-[2rem] border-2 border-orange-100/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-md transform rotate-3">
                    <Gamepad className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]">Sélection</p>
                    <p className="text-xl font-black text-slate-900 uppercase tracking-tighter italic leading-tight">{selectedProduit.designation}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedProduit(null); setSearchTerm(''); setCurrentStock(null); }}
                  className="text-slate-300 hover:text-red-500 p-2"
                >
                  <XCircle className="h-6 w-6" />
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 flex flex-col items-center justify-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Théorique</p>
                   <p className="text-2xl font-black text-slate-900 italic">
                      {currentStock !== null ? `${currentStock.toLocaleString()} ` : '-- '} 
                      <span className="text-xs text-slate-400 not-italic">U</span>
                   </p>
                </div>
                <div className={`rounded-3xl p-5 border flex flex-col items-center justify-center transition-colors ${
                  diff > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                  diff < 0 ? 'bg-red-50 border-red-100 text-red-700' : 
                  'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                   <p className="text-[9px] font-black uppercase tracking-widest mb-1">Différence</p>
                   <p className="text-2xl font-black italic">
                      {diff > 0 ? `+${diff}` : diff}
                      <span className="text-xs not-italic ml-1">U</span>
                   </p>
                </div>
             </div>

             <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block text-center">Quantité Réellement Trouvée</label>
                <div className="flex items-center justify-center gap-6">
                   <button 
                     onClick={() => setQuantite(Math.max(0, quantite - 1))}
                     className="h-20 w-20 rounded-[2rem] bg-slate-50 border-4 border-white flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all active:scale-90 shadow-lg"
                   >
                     <Minus className="h-10 w-10" />
                   </button>
                   <input 
                     type="number"
                     value={quantite}
                     onChange={e => setQuantite(Number(e.target.value))}
                     className="w-40 rounded-[2.5rem] border-8 border-orange-500/10 bg-white px-4 py-8 text-6xl font-black text-center text-slate-900 outline-none tabular-nums shadow-2xl focus:border-orange-500/30 transition-all"
                   />
                   <button 
                     onClick={() => setQuantite(quantite + 1)}
                     className="h-20 w-20 rounded-[2rem] bg-slate-50 border-4 border-white flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-all active:scale-90 shadow-lg"
                   >
                     <Plus className="h-10 w-10" />
                   </button>
                </div>
             </div>

             <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" /> Note d'ajustement
                  </label>
                  <textarea 
                    placeholder="Raison de l'ajustement (ex: Casse, Donneur, etc.)"
                    value={observation}
                    onChange={e => setObservation(e.target.value)}
                    className="w-full rounded-3xl border-4 border-slate-50 bg-slate-100/50 px-6 py-5 text-base font-bold text-slate-900 placeholder:text-slate-300 focus:border-orange-500/20 focus:bg-white outline-none transition-all h-28 resize-none shadow-inner"
                  />
             </div>

             <button 
                onClick={handleSave}
                disabled={loading}
                className="w-full py-7 rounded-[2rem] bg-orange-600 text-white text-xs font-black uppercase tracking-[0.4em] hover:bg-orange-700 shadow-[0_20px_40px_rgba(234,88,12,0.3)] transition-all active:scale-[0.98] flex items-center justify-center gap-4 disabled:opacity-50"
             >
                {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Save className="h-7 w-7" />}
                Enregistrer le Comptage
             </button>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] italic max-w-sm mx-auto">
        Précision SYCOHADA : L'ajustement génère une pièce comptable de régularisation de stock automatique (Classe 6 ou 7).
      </p>
    </div>
  )
}
