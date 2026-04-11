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
  Filter,
  Printer
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

export default function ProduitHistoriquePage() {
  const { id } = useParams()
  const router = useRouter()
  const { error } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const ITEMS_PER_PRINT_PAGE = 18
  const chunkArray = (arr: any[], size: number) => {
    const chunks = []
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
    return chunks
  }

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
            <button 
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-orange-600 text-[11px] font-black text-white hover:bg-orange-700 transition-all shadow-lg uppercase tracking-widest no-print"
            >
               <Printer className="h-4 w-4" /> Aperçu Impression
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

      {/* Rendu Système (Impression Native) */}
      <div className="hidden print:block absolute inset-0 bg-white">
        {chunkArray(data.allMoves, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
            <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                <ListPrintWrapper
                    title="Audit Historique Produit"
                    subtitle={`Rapport détaillé d'activité - Article : ${data.produit.nom} (${data.produit.code})`}
                    pageNumber={index + 1}
                    totalPages={allChunks.length}
                    hideHeader={index > 0}
                    hideVisa={index < allChunks.length - 1}
                >
                    <div className="mb-6 grid grid-cols-2 gap-8 border-b-2 border-black pb-4 italic font-black uppercase text-[12px]">
                        <div>
                            Stock Final Actuel : {data.produit.stockGeneral.toLocaleString()} {data.produit.unite || 'Unités'}
                        </div>
                        <div className="text-right">
                            Volume Vents (Période) : {totalVendu.toLocaleString()}
                        </div>
                    </div>

                    <table className="w-full text-[14px] border-collapse border-2 border-black shadow-inner">
                        <thead>
                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                <th className="border-r-2 border-black px-3 py-3 text-left">Date / Ref.</th>
                                <th className="border-r-2 border-black px-3 py-3 text-left">Nature / Tiers</th>
                                <th className="border-r-2 border-black px-3 py-3 text-right">Qté</th>
                                <th className="px-3 py-3 text-right">Valeur</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chunk.map((m: any, idx: number) => (
                                <tr key={idx} className="border-b border-black">
                                    <td className="border-r-2 border-black px-3 py-2">
                                        <div className="font-bold text-xs">{new Date(m.date).toLocaleDateString('fr-FR')}</div>
                                        <div className="font-mono text-[10px] text-gray-500">{m.numero}</div>
                                    </td>
                                    <td className="border-r-2 border-black px-3 py-2">
                                        <div className="font-black uppercase text-xs italic">{m.nature}</div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase truncate max-w-[150px]">{m.tiers}</div>
                                    </td>
                                    <td className={`border-r-2 border-black px-3 py-2 text-right font-black ${m.nature === 'VENTE' ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {m.nature === 'VENTE' ? '-' : '+'}{m.quantite.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black shadow-inner">
                                        {(m.quantite * m.prixUnitaire).toLocaleString()} F
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {index === allChunks.length - 1 && (
                            <tfoot>
                                <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                    <td colSpan={2} className="border-r-2 border-black px-3 py-4 text-right underline decoration-double shadow-inner">EXTRACT TOTAL PERFORMANCE</td>
                                    <td className="border-r-2 border-black px-3 py-4 text-right bg-white">{totalVendu.toLocaleString()} Unités</td>
                                    <td className="px-3 py-4 text-right bg-white text-blue-900 underline decoration-double">{(totalVendu * (data.allMoves[0]?.prixUnitaire || 0)).toLocaleString()} F CA EST.</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </ListPrintWrapper>
            </div>
        ))}
      </div>

      {/* MODALE D'APERÇU IMPRESSION HISTORIQUE PRODUIT */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter shadow-2xl">
          <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
              <div className="flex items-center gap-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Journal Article</h2>
                   <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                     Traçabilité exhaustive et Audit des Flux
                   </p>
                 </div>
                 <div className="h-10 w-px bg-gray-200" />
                 <div className="flex flex-col">
                   <span className="text-xs font-black text-orange-600 italic uppercase truncate max-w-[200px]">{data.produit.nom}</span>
                   <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest italic leading-none">Code : {data.produit.code}</span>
                 </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase"
                >
                  Fermer
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-10 py-2 text-sm font-black text-white hover:bg-orange-700 shadow-xl transition-all active:scale-95 uppercase"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer Journal
                </button>
              </div>
          </div>

          <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
              <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4 text-slate-900 not-italic tracking-normal">
                  {chunkArray(data.allMoves, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                      <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                          <ListPrintWrapper
                              title="AUDIT HISTORIQUE PRODUIT"
                              subtitle={`Traçabilité consolidée - ${data.produit.nom}`}
                              pageNumber={index + 1}
                              totalPages={allChunks.length}
                              hideHeader={index > 0}
                              hideVisa={index < allChunks.length - 1}
                          >
                              <div className="mb-6 grid grid-cols-2 gap-8 border-2 border-black p-4 bg-gray-50/50 italic font-black uppercase text-[12px] shadow-inner">
                                  <div className="flex flex-col gap-1">
                                      <span className="text-[9px] opacity-60">Stock Dispo Actuel :</span>
                                      <span className="text-sm">{data.produit.stockGeneral.toLocaleString()} {data.produit.unite || 'Articles'}</span>
                                  </div>
                                  <div className="flex flex-col gap-1 text-right">
                                      <span className="text-[9px] opacity-60">Chiffre d'Affaires Généré :</span>
                                      <span className="text-sm text-blue-900">{(totalVendu * (data.allMoves[0]?.prixUnitaire || 0)).toLocaleString()} F EST.</span>
                                  </div>
                              </div>

                              <table className="w-full text-[14px] border-collapse border-2 border-black">
                                  <thead>
                                      <tr className="bg-orange-600 text-white uppercase font-black border-2 border-black shadow-lg">
                                          <th className="border-r-2 border-black px-3 py-3 text-left">Chronologie / Ref</th>
                                          <th className="border-r-2 border-black px-3 py-3 text-left">Nature & Tiers</th>
                                          <th className="border-r-2 border-black px-3 py-3 text-right tabular-nums">Volume</th>
                                          <th className="px-3 py-3 text-right">Valorisation</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {chunk.map((m: any, idx: number) => (
                                          <tr key={idx} className="border-b border-black text-[13px] hover:bg-gray-50 transition-colors">
                                              <td className="border-r-2 border-black px-3 py-2">
                                                  <div className="font-black text-slate-800">{new Date(m.date).toLocaleDateString()}</div>
                                                  <div className="font-mono text-[9px] bg-gray-100 px-2 rounded-md w-max mt-1">{m.numero}</div>
                                              </td>
                                              <td className="border-r-2 border-black px-3 py-2">
                                                  <div className={`font-black uppercase text-[11px] flex items-center gap-1 ${m.nature === 'VENTE' ? 'text-orange-700' : 'text-emerald-700'}`}>
                                                      {m.nature === 'VENTE' ? <ShoppingCart className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
                                                      {m.nature}
                                                  </div>
                                                  <div className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[150px] shadow-sm italic">{m.tiers}</div>
                                              </td>
                                              <td className={`border-r-2 border-black px-3 py-2 text-right font-black tabular-nums text-lg ${m.nature === 'VENTE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                  {m.nature === 'VENTE' ? '-' : '+'}{m.quantite.toLocaleString()}
                                              </td>
                                              <td className="px-3 py-2 text-right font-black shadow-inner tabular-nums text-blue-800 italic">
                                                  {(m.quantite * m.prixUnitaire).toLocaleString()} F
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  {index === allChunks.length - 1 && (
                                      <tfoot>
                                          <tr className="bg-black text-white font-black text-[16px] border-t-4 border-black uppercase italic shadow-2xl">
                                              <td colSpan={2} className="px-4 py-5 text-right tracking-[0.2em] underline decoration-orange-500">BILAN PERFORMANCE ARTICLE</td>
                                              <td className="px-4 py-5 text-right tabular-nums text-xl">{totalVendu.toLocaleString()}</td>
                                              <td className="px-4 py-5 text-right tabular-nums text-emerald-400 bg-slate-900">{(totalVendu * (data.allMoves[0]?.prixUnitaire || 0)).toLocaleString()} F</td>
                                          </tr>
                                      </tfoot>
                                  )}
                              </table>
                          </ListPrintWrapper>
                      </div>
                  ))}
              </div>
          </div>
        </div>
      )}
    </div>
  )
}
