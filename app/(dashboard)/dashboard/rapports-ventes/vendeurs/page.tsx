'use client'

import { useState, useEffect } from 'react'
import RapportsNav from '../RapportsNav'
import { Filter, Users, Loader2, X, FileText, ChevronRight, Calendar, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

interface VendeurData {
    vendeur: string
    chiffreAffaires: number
    nombreVentes: number
    panierMoyen: number
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val).replace('XOF', 'FCFA')
}

export default function ParVendeurPage() {
    const [data, setData] = useState<VendeurData[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isPrinting, setIsPrinting] = useState(false)
    const [selectedHistory, setSelectedHistory] = useState<VendeurData | null>(null)
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
            const res = await fetch(`/api/rapports/ventes/vendeurs?start=${start}&end=${end}`)
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

    const handleViewHistory = async (v: VendeurData) => {
        setSelectedHistory(v)
        setLoadingHistory(true)
        try {
            const res = await fetch(`/api/rapports/ventes/vendeurs/history?vendeur=${encodeURIComponent(v.vendeur)}&start=${startDate}&end=${endDate}`)
            if (res.ok) {
                setHistoryData(await res.json())
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingHistory(false)
        }
    }

    const totalCA = data.reduce((acc, curr) => acc + curr.chiffreAffaires, 0)
    const totalVentes = data.reduce((acc, curr) => acc + curr.nombreVentes, 0)

    return (
        <>
            <div className="space-y-6">
                <RapportsNav />

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl mb-8 relative overflow-hidden transition-all hover:shadow-2xl">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                                <div className="p-3 bg-orange-50 rounded-2xl shadow-sm">
                                    <Users className="h-8 w-8 text-orange-600" />
                                </div>
                                Performance Vendeurs
                            </h1>
                            <p className="text-slate-500 text-sm mt-3 max-w-xl font-bold uppercase tracking-widest opacity-80">
                                Analyse détaillée du chiffre d'affaires et de l'efficacité de votre force de vente
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 1000); }}
                                disabled={isPrinting}
                                className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-slate-900 flex items-center gap-2 h-[42px] transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 uppercase tracking-widest"
                            >
                                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                                Imprimer Rapport
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
                    {/* Décorations Light */}
                    <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Chiffre d'Affaires Équipe</p>
                            <p className="text-4xl font-black text-slate-900 tabular-nums tracking-tighter italic">
                                {formatCurrency(totalCA)}
                            </p>
                            <div className="mt-4 h-1 w-20 bg-orange-500 rounded-full shadow-lg shadow-orange-500/20" />
                        </div>
                        <Users className="absolute -right-6 -bottom-6 h-32 w-32 text-gray-50 group-hover:scale-110 group-hover:text-orange-100/50 transition-all duration-700" />
                    </div>
                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 relative overflow-hidden group">
                        <div className="relative z-10">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Nombre Total de Ventes</p>
                            <p className="text-4xl font-black text-slate-300 tabular-nums tracking-tighter italic group-hover:text-slate-900 transition-colors duration-500">
                                {totalVentes}
                            </p>
                            <div className="mt-4 h-1 w-20 bg-blue-500 rounded-full shadow-lg shadow-blue-500/20" />
                        </div>
                        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-gray-50/50 to-transparent pointer-events-none" />
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-12">
                    {loading ? (
                        <div className="p-24 flex flex-col justify-center items-center text-orange-600 gap-6">
                            <Loader2 className="h-12 w-12 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Calcul des performances...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 italic">
                                        <th className="px-8 py-6">Force de Vente</th>
                                        <th className="px-8 py-6 text-right">CA Réalisé</th>
                                        <th className="px-8 py-6 text-right">Actes / Vol.</th>
                                        <th className="px-8 py-6 text-right">Panier (€)</th>
                                        <th className="px-8 py-6 text-right">Répartition</th>
                                        <th className="px-8 py-6"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-orange-50/30 transition-all duration-300 group">
                                            <td className="px-8 py-7 font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-orange-600 transition-colors">
                                                {row.vendeur}
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="text-blue-600 font-black tracking-tighter text-xl tabular-nums">
                                                    {formatCurrency(row.chiffreAffaires)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right text-slate-900 font-black tabular-nums">{row.nombreVentes}</td>
                                            <td className="px-8 py-7 text-right text-slate-500 font-bold tabular-nums font-mono text-xs">{formatCurrency(row.panierMoyen)}</td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="bg-white text-slate-900 px-3 py-1 rounded-full text-[10px] font-black tracking-tight border border-gray-200 shadow-sm">
                                                    {totalCA > 0 ? ((row.chiffreAffaires / totalCA) * 100).toFixed(1) : 0}%
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <button
                                                    onClick={() => handleViewHistory(row)}
                                                    className="bg-orange-600 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/10 border border-orange-500"
                                                >
                                                    Journal
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-32 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">
                                                Aucune donnée disponible
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
                                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{selectedHistory.vendeur}</h2>
                                <p className="text-orange-600 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">Historique des ventes sur période</p>
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
                                <div className="flex flex-col items-center justify-center h-full text-slate-200">
                                    <Calendar className="h-24 w-24 mb-6 opacity-20" />
                                    <p className="font-black uppercase text-xs italic tracking-[0.3em]">Aucune transaction trouvée</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {historyData.map((h, i) => (
                                        <div key={i} className="rounded-3xl p-6 bg-white border border-gray-100 hover:border-orange-500/30 hover:shadow-xl transition-all duration-300 group">
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
                                                    <span className="opacity-60 italic">Mag: {h.magasin?.nom}</span>
                                                </div>
                                                <button 
                                                    className="text-orange-600 font-black flex items-center gap-2 hover:translate-x-1 transition-transform"
                                                    onClick={() => window.location.href = `/dashboard/ventes?numero=${h.numero}`}
                                                >
                                                    VOIR <ChevronRight className="h-4 w-4" />
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

            <ListPrintWrapper
                title="Performance Force de Vente"
                subtitle={`Analyse du ${startDate} au ${endDate}`}
            >
                <table className="w-full text-[10px] border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100 uppercase font-black text-gray-700">
                            <th className="border border-gray-300 px-3 py-3 text-left">Vendeur / Commercial</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">CA Réalisé</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Nombre Ventes</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Panier Moyen</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Part (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="border border-gray-300 px-3 py-2 font-bold uppercase">{row.vendeur}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right font-black">{row.chiffreAffaires.toLocaleString()} F</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{row.nombreVentes}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">{row.panierMoyen.toLocaleString()} F</td>
                                <td className="border border-gray-300 px-3 py-2 text-right">
                                    {totalCA > 0 ? ((row.chiffreAffaires / totalCA) * 100).toFixed(1) : 0}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-black text-[10px]">
                            <td className="border border-gray-300 px-3 py-4 text-right uppercase italic">Performance Globale</td>
                            <td className="border border-gray-300 px-3 py-4 text-right underline decoration-double text-blue-700">{totalCA.toLocaleString()} F</td>
                            <td className="border border-gray-300 px-3 py-4 text-right underline">{totalVentes}</td>
                            <td colSpan={2} className="border border-gray-300 px-3 py-4 text-right bg-white"></td>
                        </tr>
                    </tfoot>
                </table>
            </ListPrintWrapper>

            <style jsx global>{`
                @media print {
                    nav, aside, header, .no-print, button, form, .RapportsNav { display: none !important; }
                    body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </>
    )
}
