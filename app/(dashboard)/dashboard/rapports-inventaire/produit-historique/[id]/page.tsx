'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Loader2, 
  Package, 
  ShoppingCart, 
  ShoppingBag, 
  Calendar, 
  User, 
  Warehouse,
  TrendingUp,
  History,
  Download,
  Filter
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export default function ProduitHistoriquePage() {
  const { id } = useParams()
  const router = useRouter()
  const { error } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapports/produits/${id}/historique`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        error("Impossible de charger l'historique du produit.")
      }
    } catch (e) {
      error("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        <p className="text-sm font-black uppercase tracking-widest text-gray-400">Génération du rapport Camicase...</p>
      </div>
    )
  }

  if (!data || !data.produit) return <div className="text-center py-24 text-gray-500">Produit introuvable.</div>

  const totalVendu = data.stats.totalVendu || 0
  const totalAchete = data.stats.totalAchete || 0

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-orange-500 hover:border-orange-100 hover:shadow-lg transition-all"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic flex items-center gap-2">
              <Package className="h-8 w-8 text-orange-500" /> {data.produit.nom}
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1 ml-1">
              Rapport d'activité détaillé (Code: {data.produit.code})
            </p>
          </div>
        </div>
      </div>

      {/* STATS RAPIDES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl flex items-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
             <ShoppingCart className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Ventes</p>
            <p className="text-2xl font-black text-gray-900">{totalVendu.toLocaleString()} <span className="text-xs text-gray-400">UNITÉS</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl flex items-center gap-6">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
             <ShoppingBag className="h-8 w-8" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Achats</p>
            <p className="text-2xl font-black text-gray-900">{totalAchete.toLocaleString()} <span className="text-xs text-gray-400">UNITÉS</span></p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-[2rem] shadow-xl flex items-center gap-6 text-white">
          <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center">
             <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Stock Actuel</p>
            <p className="text-2xl font-black">{data.produit.stockGeneral.toLocaleString()} <span className="text-xs text-white/50">UNITÉS</span></p>
          </div>
        </div>
      </div>

      {/* JOURNAL DES OPÉRATIONS */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
        <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter italic flex items-center gap-2">
               <History className="h-5 w-5 text-orange-500" /> Chronologie des Transactions
            </h2>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 text-[10px] font-black text-gray-500 hover:text-gray-900 transition-all uppercase tracking-widest">
               <Download className="h-3.5 w-3.5" /> Exporter PDF
            </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 uppercase text-[10px] font-black text-gray-400 tracking-widest">
                <th className="px-8 py-4 text-left">Date</th>
                <th className="px-8 py-4 text-left">Nature</th>
                <th className="px-8 py-4 text-left">Référence</th>
                <th className="px-8 py-4 text-left">Tiers (Client/Fourn.)</th>
                <th className="px-8 py-4 text-left">Magasin</th>
                <th className="px-8 py-4 text-right">Quantité</th>
                <th className="px-8 py-4 text-right">P.U</th>
                <th className="px-8 py-4 text-right">Total</th>
                <th className="px-8 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.allMoves.map((m: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-8 py-5">
                     <p className="text-sm font-bold text-gray-600">{new Date(m.date).toLocaleDateString('fr-FR')}</p>
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${
                      m.nature === 'VENTE' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {m.nature === 'VENTE' ? <ShoppingCart className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                      {m.nature}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-black text-gray-800 uppercase tracking-tighter bg-gray-100/50 px-3 py-1 rounded-lg w-max border border-gray-100">{m.numero}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-400" />
                       </div>
                       <p className="text-xs font-black text-gray-700 uppercase tracking-tight truncate max-w-[150px]">{m.tiers}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-gray-500">
                       <Warehouse className="h-4 w-4" />
                       <span className="text-xs font-bold uppercase tracking-widest">{m.magasin}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={`text-sm font-black tabular-nums ${m.nature === 'VENTE' ? 'text-gray-900' : 'text-emerald-700'}`}>
                       {m.nature === 'VENTE' ? '-' : '+'}{m.quantite.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-bold text-gray-500 tabular-nums">
                    {m.prixUnitaire.toLocaleString()} F
                  </td>
                  <td className="px-8 py-5 text-right">
                    <p className="text-sm font-black text-gray-900 tabular-nums">{(m.quantite * m.prixUnitaire).toLocaleString()} F</p>
                  </td>
                  <td className="px-8 py-5 text-center">
                     <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.15em] border ${
                       m.statutPaiement === 'PAYE' || m.statutPaiement === 'REGLÉ' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-red-50 text-red-600 border-red-100'
                     }`}>
                        {m.statutPaiement || 'VALIDE'}
                     </span>
                  </td>
                </tr>
              ))}

              {data.allMoves.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center text-gray-400 italic">Aucun mouvement trouvé pour ce produit.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
