'use client'

import { useState, useEffect } from 'react'
import RapportsNav from '../RapportsNav'
import { Filter, Package, Loader2, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface ProduitData {
    produitId: number
    designation: string
    quantiteTotale: number
    caTotal: number
    margeBrute: number
    tauxMarge: number
    nombreTransactions: number
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val).replace('XOF', 'FCFA')
}

export default function ParProduitPage() {
    const [data, setData] = useState<ProduitData[]>([])
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)

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
            const res = await fetch(`/api/rapports/ventes/produits?dateDebut=${start}&dateFin=${end}`)
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

    const totalQty = data.reduce((acc, c) => acc + c.quantiteTotale, 0)
    const totalCA = data.reduce((acc, c) => acc + c.caTotal, 0)
    const totalMarge = data.reduce((acc, c) => acc + (c.margeBrute || 0), 0)
    const avgTaux = totalCA > 0 ? (totalMarge / totalCA) * 100 : 0

    return (
        <>
            <div className="space-y-6">
                <div className="no-print">
                    <RapportsNav />
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl mb-8 relative overflow-hidden transition-all hover:shadow-2xl no-print">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase italic">
                                <div className="p-3 bg-orange-50 rounded-2xl shadow-sm">
                                    <Package className="h-8 w-8 text-orange-600" />
                                </div>
                                Rentabilité Produits
                            </h1>
                            <p className="text-slate-500 text-sm mt-3 max-w-xl font-bold uppercase tracking-widest opacity-80">
                                Analyse des rotations de stock, des marges brutes et de la performance par article
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
                                    <Filter className="h-4 w-4" /> Analyser
                                </button>
                            </form>
                        </div>
                    </div>
                    {/* Décorations Light */}
                    <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-orange-500/5 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 no-print">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden group">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Articles Vendus</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums">{totalQty.toLocaleString()}</p>
                        <div className="mt-4 h-1 w-12 bg-blue-500 rounded-full" />
                        <Package className="absolute -right-4 -bottom-4 h-24 w-24 text-blue-500/5 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl relative overflow-hidden group">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">C.A Global (HT)</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums">{totalCA.toLocaleString()} <span className="text-xs">F</span></p>
                        <div className="mt-4 h-1 w-12 bg-orange-500 rounded-full" />
                    </div>
                    <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden group text-white ring-4 ring-emerald-500/20">
                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1 italic">Marge Brute Totale</p>
                        <p className="text-3xl font-black tabular-nums">{totalMarge.toLocaleString()} <span className="text-xs">F</span></p>
                        <div className="mt-4 h-1 w-12 bg-white/30 rounded-full" />
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden group text-white">
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Taux de Marge Moyen</p>
                        <p className="text-3xl font-black tabular-nums">{avgTaux.toFixed(1)} %</p>
                        <div className="mt-4 h-1 w-12 bg-emerald-500 rounded-full" />
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-12 no-print">
                    {loading ? (
                        <div className="p-24 flex flex-col justify-center items-center text-orange-600 gap-6">
                            <Loader2 className="h-12 w-12 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Analyse en cours...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 italic">
                                        <th className="px-8 py-6">Désignation Article</th>
                                        <th className="px-8 py-6 text-right">Qté Vendue</th>
                                        <th className="px-8 py-6 text-right">C.A Généré</th>
                                        <th className="px-8 py-6 text-right text-emerald-600">Marge Brute</th>
                                        <th className="px-8 py-6 text-right">Taux (%)</th>
                                        <th className="px-8 py-6 text-right text-orange-400">Poids CA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-all duration-300 group">
                                            <td className="px-8 py-7 font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-orange-600 transition-colors">
                                                {row.designation}
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="bg-gray-100 text-slate-900 px-3 py-1 rounded-xl text-sm font-black tabular-nums border border-gray-200">
                                                    {row.quantiteTotale}
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right text-blue-600 font-black tracking-tighter text-xl tabular-nums">
                                                {formatCurrency(row.caTotal)}
                                            </td>
                                            <td className="px-8 py-7 text-right text-emerald-600 font-bold tabular-nums">
                                                {formatCurrency(row.margeBrute)}
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${row.tauxMarge >= 20 ? 'bg-emerald-100 text-emerald-800' : row.tauxMarge >= 10 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                                                    {row.tauxMarge.toFixed(1)}%
                                                 </span>
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-xl text-[10px] font-black border border-orange-100 tracking-tight">
                                                    {data.reduce((acc, c) => acc + c.caTotal, 0) > 0 ? ((row.caTotal / data.reduce((acc, c) => acc + c.caTotal, 0)) * 100).toFixed(1) : 0}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-32 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">
                                                Aucune transaction enregistrée
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className="hidden print:block absolute inset-0 bg-white">
                {chunkArray(data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                        <ListPrintWrapper
                            title="Rentabilité & Performance Produits"
                            subtitle={`Analyse de rotation - Période du ${startDate} au ${endDate}`}
                            pageNumber={index + 1}
                            totalPages={allChunks.length}
                            hideHeader={index > 0}
                            hideVisa={index < allChunks.length - 1}
                        >
                            <table className="w-full text-[13px] border-collapse border-2 border-black">
                                <thead>
                                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                        <th className="border-r-2 border-black px-3 py-3 text-left">Désignation</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Qté</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">CA Net</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Marge Brute</th>
                                        <th className="px-3 py-3 text-right">Taux (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((row, idx) => (
                                        <tr key={idx} className="border-b border-black">
                                            <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{row.designation}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right">{row.quantiteTotale}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{row.caTotal.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black italic">{row.margeBrute.toLocaleString()} F</td>
                                            <td className="px-3 py-2 text-right italic font-medium">
                                                {row.tauxMarge.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {index === allChunks.length - 1 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 font-black text-[14px] border-t-2 border-black uppercase italic">
                                            <td colSpan={2} className="border-r-2 border-black px-3 py-4 text-right">SYNTHÈSE ANALYTIQUE :</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white text-blue-900 shadow-inner">{totalCA.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white text-emerald-900">{totalMarge.toLocaleString()} F</td>
                                            <td className="px-3 py-4 bg-white text-slate-900">{avgTaux.toFixed(1)}%</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </ListPrintWrapper>
                    </div>
                ))}
            </div>

            {/* MODALE D'APERÇU IMPRESSION RENTABILITÉ PRODUITS */}
            {isPreviewOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
                <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-emerald-100 rounded-2xl">
                             <Package className="h-8 w-8 text-emerald-700" />
                        </div>
                       <div>
                         <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Intelligence Analytique / Produits</h2>
                         <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                           Performance Catalogue & Rentabilité Brute par Article
                         </p>
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
                        Confirmer Impression
                      </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
                    <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                        {chunkArray(data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                            <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0">
                                <ListPrintWrapper
                                    title="RAPPORT DE RENTABILITÉ DÉTAILLÉ"
                                    subtitle={`Analyse statistique consolidée - Période du ${startDate} au ${endDate}`}
                                    pageNumber={index + 1}
                                    totalPages={allChunks.length}
                                    hideHeader={index > 0}
                                    hideVisa={index < allChunks.length - 1}
                                >
                                    <table className="w-full text-[14px] border-collapse border-4 border-black shadow-2xl">
                                        <thead>
                                            <tr className="bg-black text-white uppercase font-black">
                                                <th className="border-r-2 border-white px-3 py-4 text-left italic">Désignation de l'Article</th>
                                                <th className="border-r-2 border-white px-3 py-4 text-right tabular-nums">Volume</th>
                                                <th className="border-r-2 border-white px-3 py-4 text-right">CA Net (XOF)</th>
                                                <th className="border-r-2 border-white px-3 py-4 text-right bg-emerald-900">Marge Brute</th>
                                                <th className="px-3 py-4 text-right">Tx (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((row, idx) => (
                                                <tr key={idx} className="border-b-2 border-black text-[13px] hover:bg-gray-50 transition-colors">
                                                    <td className="border-r-2 border-black px-3 py-3 font-black uppercase text-slate-800">{row.designation}</td>
                                                    <td className="border-r-2 border-black px-3 py-3 text-right font-bold tabular-nums">{row.quantiteTotale}</td>
                                                    <td className="border-r-2 border-black px-3 py-3 text-right font-black tabular-nums text-blue-900">{row.caTotal.toLocaleString()}</td>
                                                    <td className="border-r-2 border-black px-3 py-3 text-right font-black tabular-nums text-emerald-800 bg-emerald-50/20">{row.margeBrute.toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-right font-black italic tabular-nums text-orange-600 shadow-inner">
                                                        {row.tauxMarge.toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {index === allChunks.length - 1 && (
                                            <tfoot>
                                                <tr className="bg-black text-white font-black text-[18px] border-t-4 border-black uppercase italic shadow-2xl">
                                                    <td colSpan={2} className="px-4 py-8 text-right underline decoration-white decoration-2 underline-offset-8">PERFORMANCE GLOBALE :</td>
                                                    <td className="px-4 py-8 text-right tabular-nums bg-blue-900 border-x-2 border-white">{totalCA.toLocaleString()}</td>
                                                    <td className="px-4 py-8 text-right tabular-nums bg-emerald-900 border-r-2 border-white">{totalMarge.toLocaleString()}</td>
                                                    <td className="px-4 py-8 text-right tabular-nums bg-slate-900">{avgTaux.toFixed(1)} %</td>
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
