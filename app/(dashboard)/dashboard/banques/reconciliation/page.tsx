'use client'

import { useState, useEffect } from 'react'
import { 
  FileSearch, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Banknote,
  Search,
  Filter,
  Check,
  ChevronRight,
  ArrowRight
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export default function ReconciliationPage() {
  const [banques, setBanques] = useState<any[]>([])
  const [selectedBanque, setSelectedBanque] = useState('')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<any[]>([])
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetch('/api/banques').then(r => r.json()).then(setBanques)
  }, [])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !selectedBanque) return
    setLoading(true)
    
    // Simulation simple de parsing CSV pour l'exemple
    const text = await file.text()
    const lines = text.split('\n').slice(1) // Ignorer header
    const operations = lines.map(line => {
      const parts = line.split(',')
      return {
        date: parts[0],
        libelle: parts[1],
        montant: Math.abs(Number(parts[2]))
      }
    }).filter(op => !isNaN(op.montant))

    try {
      const res = await fetch('/api/banques/reconcilier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banqueId: selectedBanque, operations })
      })
      if (res.ok) {
        setResults(await res.json())
        success("Analyse terminée. Consultez les suggestions.")
      } else {
        showError("Erreur lors de l'analyse")
      }
    } catch (e) {
      showError("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">Rapprochement Bancaire</h1>
          <p className="mt-1 text-white/70 text-xs font-bold uppercase tracking-widest">Faire correspondre votre relevé bancaire avec GestiCom</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
             <h2 className="text-lg font-black text-gray-900 mb-6 uppercase tracking-tighter italic flex items-center gap-2">
                <Upload className="h-5 w-5 text-orange-500" />
                Import Relevé
             </h2>
             <form onSubmit={handleUpload} className="space-y-4">
                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Compte Bancaire</label>
                   <select 
                      value={selectedBanque}
                      onChange={e => setSelectedBanque(e.target.value)}
                      className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700 focus:border-orange-500 focus:outline-none transition-all"
                      required
                   >
                     <option value="">Sélectionnez...</option>
                     {banques.map(b => <option key={b.id} value={b.id}>{b.nomBanque}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Fichier CSV</label>
                   <input 
                     type="file" 
                     accept=".csv"
                     onChange={e => setFile(e.target.files?.[0] || null)}
                     className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 transition-all border border-gray-100 p-2 rounded-xl"
                     required
                   />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                  Analyser le relevé
                </button>
             </form>
          </div>

          <div className="bg-orange-600 p-8 rounded-[2.5rem] text-white shadow-xl">
             <h3 className="text-sm font-black uppercase tracking-widest mb-4">Fonctionnement</h3>
             <p className="text-xs opacity-80 leading-relaxed font-bold">
                Le système analyse chaque ligne et cherche un règlement (Vente ou Achat) ayant le même montant dans une fenêtre de +/- 3 jours.
             </p>
          </div>
        </div>

        <div className="lg:col-span-3">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden min-h-[500px]">
              <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100">
                 <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic">Résultats de l'analyse</h2>
              </div>
              
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 text-gray-300">
                   <Banknote className="h-20 w-20 opacity-10 mb-4" />
                   <p className="text-xs font-black uppercase tracking-[0.3em] italic">Aucune donnée chargée</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                   {results.map((res, i) => (
                     <div key={i} className="p-6 hover:bg-gray-50/50 transition-all group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                           <div className="flex items-start gap-4">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black ${res.suggestions.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                 {res.suggestions.length > 0 ? <Check className="h-5 w-5" /> : '?'}
                              </div>
                              <div>
                                 <p className="text-sm font-black text-gray-900 uppercase tracking-tighter italic">{res.libelle}</p>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{res.date} • <span className="text-gray-900">{res.montant.toLocaleString()} F</span></p>
                              </div>
                           </div>

                           <div className="flex-1 max-w-md">
                              {res.suggestions.length > 0 ? (
                                <div className="space-y-2">
                                   <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" /> Correspondance détectée
                                   </p>
                                   {res.suggestions.map((s: any, idx: number) => (
                                     <button key={idx} className="w-full flex items-center justify-between p-3 bg-white border border-emerald-100 rounded-xl hover:border-emerald-500 transition-all text-left">
                                        <div className="flex items-center gap-3">
                                           <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                           <span className="text-[10px] font-bold text-gray-700 uppercase">{s.libelle}</span>
                                        </div>
                                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                                     </button>
                                   ))}
                                </div>
                              ) : (
                                <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                                   <p className="text-[9px] font-bold text-gray-400 uppercase italic text-center">Aucun règlement correspondant trouvé</p>
                                </div>
                              )}
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  )
}
