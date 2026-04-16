'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileCheck, 
  ShieldCheck,
  Search,
  XCircle,
  Clock
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export default function RapprochementPage() {
  const [banques, setBanques] = useState<any[]>([])
  const [selectedBanque, setSelectedBanque] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [processing, setProcessing] = useState(false)
  const { success, error: showError } = useToast()

  useEffect(() => {
    fetch('/api/banques').then(r => r.json()).then(res => setBanques(res.data || []))
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const parseAndMatch = async () => {
    if (!file || !selectedBanque) return showError('Veuillez sélectionner une banque et un fichier.')
    
    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      
      // On ignore l'en-tête (Date, Libelle, Montant)
      const data = lines.slice(1).map(line => {
        const parts = line.split(/[;,]/) // Support ; or ,
        return {
          date: parts[0]?.trim(),
          libelle: parts[1]?.trim(),
          montant: parts[2]?.trim() ? parseFloat(parts[2].replace(/[^\d.-]/g, '')) : 0
        }
      })

      try {
        const res = await fetch('/api/banques/reconcilier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations: data, banqueId: Number(selectedBanque) })
        })
        if (res.ok) {
          setResults(await res.json())
        } else {
          showError('Erreur lors de l\'analyse du rapprochement.')
        }
      } catch (e) {
        showError('Erreur de communication avec le serveur.')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file)
  }

  const handlePointer = async (index: number, suggestion: any) => {
    // Dans un système réel, on marquerait le règlement comme 'rapproché' via API
    setProcessing(true)
    try {
      const res = await fetch(`/api/banques/reconcilier/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rapprochement: {
            banqueId: Number(selectedBanque),
            montant: results[index].montant,
            date: results[index].date,
            libelle: results[index].libelle,
            reglementId: suggestion.id,
            type: suggestion.type
          }
        })
      })
      if (res.ok) {
        const newResults = [...results]
        newResults[index].confirmed = true
        newResults[index].confirmedId = suggestion.id
        setResults(newResults)
        success('Opération pointée avec succès.')
      } else {
        showError('Erreur lors du pointage.')
      }
    } catch (e) {
      showError('Erreur réseau.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="h-20 w-20 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/20 transform rotate-3">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Rapprochement Bancaire</h1>
        <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.4em]">Audit & Pointage des flux financiers</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 flex flex-wrap gap-8 items-end justify-center">
        <div className="space-y-3 flex-1 min-w-[250px]">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Compte Bancaire</label>
           <select 
             value={selectedBanque}
             onChange={e => setSelectedBanque(e.target.value)}
             className="w-full rounded-2xl border-4 border-slate-50 bg-slate-50 px-6 py-4 text-sm font-black text-slate-900 focus:border-blue-500/20 focus:bg-white outline-none transition-all shadow-sm cursor-pointer"
           >
             <option value="">Sélectionnez une banque...</option>
             {banques.map(b => <option key={b.id} value={b.id}>{b.nomBanque} - {b.numero}</option>)}
           </select>
        </div>

        <div className="space-y-3 flex-1 min-w-[250px]">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relevé (CSV Standard)</label>
           <div className="relative group">
              <input 
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label 
                htmlFor="csv-upload"
                className="w-full rounded-2xl border-4 border-dashed border-slate-100 bg-slate-50 px-6 py-4 text-sm font-bold text-slate-500 flex items-center gap-3 cursor-pointer hover:border-blue-500/50 hover:bg-white transition-all group-focus-within:border-blue-500"
              >
                <Upload className="h-5 w-5 text-slate-400" />
                {file ? file.name : 'Choisir un fichier...'}
              </label>
           </div>
        </div>

        <button 
           onClick={parseAndMatch}
           disabled={loading || !file || !selectedBanque}
           className="h-16 px-10 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 shadow-xl shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          Lancer l'Analyse
        </button>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="animate-in slide-in-from-bottom-5 duration-700 bg-white rounded-[3rem] shadow-[0_30px_60px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100">
           <div className="bg-slate-900 p-8 flex items-center justify-between text-white">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight italic">Analyse du Relevé</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{results.length} opérations identifiées</p>
              </div>
              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Taux de Match</p>
                    <p className="text-lg font-black text-blue-400">
                      {Math.round((results.filter(r => r.suggestions?.length > 0).length / results.length) * 100)}%
                    </p>
                 </div>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                 <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                       <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Relevé</th>
                       <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé Relevé</th>
                       <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Montant (F)</th>
                       <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Correspondances GestiCom</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {results.map((res, idx) => (
                       <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${res.confirmed ? 'bg-emerald-50/30' : ''}`}>
                          <td className="px-6 py-5 text-sm font-bold text-slate-600">{res.date}</td>
                          <td className="px-6 py-5 text-sm font-black text-slate-900 uppercase tracking-tighter">{res.libelle}</td>
                          <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums italic">
                             {res.montant.toLocaleString()} F
                          </td>
                          <td className="px-6 py-5 w-[40%]">
                             {res.confirmed ? (
                               <div className="flex items-center gap-2 text-emerald-600 font-black uppercase text-[10px]">
                                  <FileCheck className="h-5 w-5" /> Opération Pointée (ID: {res.confirmedId})
                               </div>
                             ) : res.suggestions?.length > 0 ? (
                                <div className="space-y-2">
                                   {res.suggestions.map((sug: any) => (
                                      <button 
                                        key={sug.id}
                                        onClick={() => handlePointer(idx, sug)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100 hover:border-blue-400 hover:bg-white transition-all group"
                                      >
                                         <div className="text-left">
                                            <p className="text-[10px] font-black text-blue-700 uppercase">{sug.libelle}</p>
                                            <p className="text-[9px] text-slate-400 font-bold">{new Date(sug.date).toLocaleDateString()}</p>
                                         </div>
                                         <ArrowRight className="h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                                      </button>
                                   ))}
                                </div>
                             ) : (
                                <div className="flex items-center gap-2 text-slate-400 italic text-[10px] font-medium">
                                   <Clock className="h-4 w-4" /> Aucun match trouvé
                                </div>
                             )}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* Footer Warning */}
      <div className="bg-blue-600/10 border border-blue-200 rounded-3xl p-6 flex items-start gap-4">
         <AlertCircle className="h-6 w-6 text-blue-600 shrink-0" />
         <div>
            <p className="text-sm font-bold text-blue-900">Format Standard de Importation</p>
            <p className="text-xs text-blue-700/70 mt-1">
               Le fichier CSV doit contenir 3 colonnes : <strong>Date, Libellé, Montant</strong>. 
               L'algorithme de GestiCom Pro Intelligent propose automatiquement les règlements ayant le même montant à +/- 3 jours de la date du relevé.
            </p>
         </div>
      </div>
    </div>
  )
}
