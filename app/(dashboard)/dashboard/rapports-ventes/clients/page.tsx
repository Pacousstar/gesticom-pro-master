'use client'

import { useState, useEffect } from 'react'
import RapportsNav from '../RapportsNav'
import { Filter, UserCheck, Loader2, X, Calendar, FileText, ChevronRight, PieChart, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'
import { useToast } from '@/hooks/useToast'

interface ClientData {
    clientId: number
    client: string
    caTotal: number
    nombreVentes: number
    soldeDu: number
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val).replace('XOF', 'FCFA')
}

export default function ParClientPage() {
    const [data, setData] = useState<ClientData[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
    const { error: showError } = useToast()
    const [selectedHistory, setSelectedHistory] = useState<{ id: number | null; nom: string } | null>(null)
    const [historyData, setHistoryData] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    useEffect(() => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        setStartDate(start)
        setEndDate(end)
        fetchData(start, end)
    }, [])

    const fetchData = async (start: string, end: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/rapports/ventes/clients?dateDebut=${start}&dateFin=${end}`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(startDate, endDate)
    }

    const totalCA = data.reduce((acc, row) => acc + row.caTotal, 0)
    const totalDette = data.reduce((acc, row) => acc + (row.soldeDu || 0), 0)
    const totalVentes = data.reduce((acc, row) => acc + row.nombreVentes, 0)

    const fetchHistory = async (id: number | null, nom: string) => {
        if (!id) return
        setSelectedHistory({ id, nom })
        setLoadingHistory(true)
        try {
            const res = await fetch(`/api/rapports/ventes/clients/${id}/history?start=${startDate}&end=${endDate}`)
            if (res.ok) {
                setHistoryData(await res.json())
            }
        } catch (e) {
            showError('Erreur chargement historique client')
        } finally {
            setLoadingHistory(false)
        }
    }

    return (
        <>
            <div className="space-y-6">
                <RapportsNav />

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl mb-8 relative overflow-hidden transition-all hover:shadow-2xl">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                                <div className="p-3 bg-orange-50 rounded-2xl shadow-sm">
                                    <UserCheck className="h-8 w-8 text-orange-600" />
                                </div>
                                Fidélité Clients
                            </h1>
                            <p className="text-slate-500 text-sm mt-3 max-w-xl font-bold uppercase tracking-widest opacity-80">
                                Classement des clients par volume d'achat et rentabilité globale
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsPreviewOpen(true)}
                                className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-slate-900 flex items-center gap-2 h-[42px] transition-all hover:scale-105 active:scale-95 shadow-lg no-print uppercase tracking-widest"
                            >
                                <Printer className="h-4 w-4" />
                                Aperçu Impression
                            </button>
                            <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Date de début</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Date de fin</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                                <button type="submit" className="bg-orange-600 text-white px-8 py-2 rounded-xl text-xs font-black hover:bg-orange-700 flex items-center gap-2 h-[42px] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20 uppercase tracking-widest">
                                    <Filter className="h-4 w-4" /> Filtrer
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-12">
                    {loading ? (
                        <div className="p-24 flex flex-col justify-center items-center text-orange-600 gap-6">
                            <Loader2 className="h-12 w-12 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Chargement des données...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 italic">
                                        <th className="px-8 py-6">Partenaire Client</th>
                                        <th className="px-8 py-6 text-right">CA Généré</th>
                                        <th className="px-8 py-6 text-right">Volume</th>
                                        <th className="px-8 py-6 text-right">Solde Dû</th>
                                        <th className="px-8 py-6 text-right">Panier Moyen</th>
                                        <th className="px-8 py-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.map((row: any, idx) => (
                                        <tr 
                                            key={idx} 
                                            className="hover:bg-orange-50/30 transition-all duration-300 group cursor-pointer"
                                            onClick={() => fetchHistory(row.clientId, row.client)}
                                        >
                                            <td className="px-8 py-7 font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-orange-600 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    {row.client}
                                                    <ChevronRight className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-all" />
                                                </div>
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="text-blue-600 font-black tracking-tighter text-xl tabular-nums">
                                                    {formatCurrency(row.caTotal)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="bg-white text-slate-900 px-3 py-1 rounded-full text-[10px] font-black tracking-tight border border-gray-200 shadow-sm">
                                                    {row.nombreVentes} Actes
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right font-black text-rose-500 tabular-nums">
                                                {row.soldeDu > 0 ? formatCurrency(row.soldeDu) : '---'}
                                            </td>
                                            <td className="px-8 py-7 text-right text-slate-500 font-bold tabular-nums font-mono text-xs">
                                                {formatCurrency(row.nombreVentes > 0 ? row.caTotal / row.nombreVentes : 0)}
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <button className="bg-orange-600 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/10 border border-orange-500">
                                                    HISTORIQUE
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-32 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">
                                                Aucune transaction détectée
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {selectedHistory && (
                    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white border-l border-gray-100 shadow-[0_0_60px_rgba(0,0,0,0.1)] z-50 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">{selectedHistory.nom}</h2>
                                <p className="text-orange-600 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Historique des transactions</p>
                            </div>
                            <button onClick={() => setSelectedHistory(null)} className="p-3 bg-white hover:bg-gray-100 text-slate-400 rounded-2xl transition-all hover:rotate-90 shadow-sm border border-gray-100">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/30">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full gap-6 text-orange-600">
                                    <Loader2 className="h-12 w-12 animate-spin" />
                                    <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Récupération du journal...</p>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-200 text-center">
                                    <Calendar className="h-24 w-24 mx-auto mb-6 opacity-20" />
                                    <p className="font-black uppercase text-xs italic tracking-[0.3em]">Aucune transaction trouvée</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyData.map((h, i) => (
                                        <div key={i} className="border rounded-3xl p-6 bg-white border-gray-100 hover:border-orange-500/30 hover:shadow-xl transition-all duration-300 group">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100 shadow-sm">
                                                        <FileText className="h-6 w-6 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-mono text-sm font-black text-slate-900 group-hover:text-orange-600 transition-colors uppercase tracking-tight">{h.numero}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                            {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">{h.montantTotal.toLocaleString()} F</p>
                                                    <div className="mt-1">
                                                        <span className={`text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border shadow-sm ${h.statutPaiement === 'PAYE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                            {h.statutPaiement}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-gray-50 pt-4 mt-4 font-black uppercase tracking-widest">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 text-slate-600 tracking-tight">{h.modePaiement}</span>
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded italic opacity-70">Mag: {h.magasin?.nom}</span>
                                                </div>
                                                <button 
                                                    className="text-orange-600 font-black flex items-center gap-1 hover:gap-2 transition-all"
                                                    onClick={() => window.location.href = `/dashboard/ventes?numero=${h.numero}`}
                                                >
                                                    DÉTAILS <ChevronRight className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="hidden print:block absolute inset-0 bg-white">
                {chunkArray(data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                        <ListPrintWrapper
                            title="Fidélité & Rentabilité Clients"
                            subtitle={`Rapport de performance commerciale - Période du ${startDate} au ${endDate}`}
                            pageNumber={index + 1}
                            totalPages={allChunks.length}
                            hideHeader={index > 0}
                            hideVisa={index < allChunks.length - 1}
                        >
                            <table className="w-full text-[14px] border-collapse border-2 border-black">
                                <thead>
                                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                        <th className="border-r-2 border-black px-3 py-3 text-left">Partenaire Client</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">CA Réalisé</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right tabular-nums">Volume</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Solde Dû</th>
                                        <th className="px-3 py-3 text-right">Panier M.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((row: any, idx) => (
                                        <tr key={idx} className="border-b border-black">
                                            <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{row.client}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black">{row.caTotal.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right">{row.nombreVentes} Actes</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right text-rose-700 font-bold tabular-nums">{(row.soldeDu || 0).toLocaleString()} F</td>
                                            <td className="px-3 py-2 text-right italic">{(row.nombreVentes > 0 ? row.caTotal / row.nombreVentes : 0).toLocaleString()} F</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {index === allChunks.length - 1 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                            <td className="border-r-2 border-black px-3 py-4 text-right">TOTAUX ANALYSE</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white text-blue-900 underline decoration-double">{totalCA.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white">{totalVentes} Ventes</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white text-rose-700">{totalDette.toLocaleString()} F</td>
                                            <td className="px-3 py-4 bg-white">---</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </ListPrintWrapper>
                    </div>
                ))}
            </div>

            {/* MODALE D'APERÇU IMPRESSION RENTABILITÉ CLIENTS */}
            {isPreviewOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
                <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                    <div className="flex items-center gap-6">
                       <div>
                         <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Fidélité Clients</h2>
                         <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                           Analyse de Performance et Rentabilité Partenaires
                         </p>
                       </div>
                       <div className="h-10 w-px bg-gray-200" />
                       <div className="flex flex-col">
                         <span className="text-xs font-black text-orange-600 italic">Extraction du {startDate}</span>
                         <span className="text-xs font-black text-orange-600 italic">au {endDate}</span>
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
                        Lancer l'impression
                      </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
                    <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4 text-slate-900 not-italic tracking-normal">
                        {chunkArray(data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                            <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                                <ListPrintWrapper
                                    title="FIDÉLITÉ & RENTABILITÉ CLIENTS"
                                    subtitle={`Analyse commerciale consolidée - Période sous revue`}
                                    pageNumber={index + 1}
                                    totalPages={allChunks.length}
                                    hideHeader={index > 0}
                                    hideVisa={index < allChunks.length - 1}
                                >
                                    <table className="w-full text-[14px] border-collapse border-2 border-black">
                                        <thead>
                                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                                <th className="border-r-2 border-black px-3 py-3 text-left">Client / Partenaire</th>
                                                <th className="border-r-2 border-black px-3 py-3 text-right">C.A Total</th>
                                                <th className="border-r-2 border-black px-3 py-3 text-right tabular-nums">Fréq.</th>
                                                <th className="border-r-2 border-black px-3 py-3 text-right">Engagement (Solde)</th>
                                                <th className="px-3 py-3 text-right">Rendement</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((row: any, idx) => (
                                                <tr key={idx} className="border-b border-black text-[13px]">
                                                    <td className="border-r-2 border-black px-3 py-2 font-black uppercase text-blue-900">{row.client}</td>
                                                    <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{row.caTotal.toLocaleString()} F</td>
                                                    <td className="border-r-2 border-black px-3 py-2 text-right">{row.nombreVentes}</td>
                                                    <td className="border-r-2 border-black px-3 py-2 text-right font-black text-rose-600 tabular-nums">{(row.soldeDu || 0).toLocaleString()} F</td>
                                                    <td className="px-3 py-2 text-right italic font-medium tabular-nums shadow-inner">{(row.nombreVentes > 0 ? row.caTotal / row.nombreVentes : 0).toLocaleString()} F</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {index === allChunks.length - 1 && (
                                            <tfoot>
                                                <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                    <td className="border-r-2 border-black px-3 py-4 text-right bg-white">VALEUR PORTEFEUILLE CLIENT</td>
                                                    <td className="border-r-2 border-black px-3 py-4 bg-white text-blue-900 underline underline-offset-4 decoration-double tabular-nums shadow-inner">{totalCA.toLocaleString()} F</td>
                                                    <td className="border-r-2 border-black px-3 py-4 bg-white italic tabular-nums">{totalVentes} Transaction(s)</td>
                                                    <td colSpan={2} className="px-3 py-4 bg-white text-rose-700 underline underline-offset-4 decoration-double tabular-nums">{totalDette.toLocaleString()} F cumulés</td>
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

        </>
    )
}
