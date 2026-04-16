'use client'

import { useState, useEffect } from 'react'
import RapportsNav from '../RapportsNav'
import { Filter, Package, Loader2, Printer } from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

interface ProduitData {
    produitId: number
    designation: string
    categorie: string
    quantiteTotale: number
    caTotal: number
    coutTotal: number
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
    const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('portrait')

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
    const totalCA = data.reduce((acc, c) => acc + (c.caTotal || 0), 0)
    const totalMarge = data.reduce((acc, c) => acc + (c.margeBrute || 0), 0)

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
                                Rentabilité Produits {(startDate || endDate) && <span className="ml-1" title="Période filtrée">⚠️</span>}
                            </h1>
                            <p className="text-slate-500 text-sm mt-3 max-w-xl font-bold uppercase tracking-widest opacity-80">
                                Analyse des rotations de stock et de la performance par article (Marge Réelle incluse)
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setIsPreviewOpen(true)}
                                className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-slate-900 flex items-center gap-2 h-[42px] transition-all hover:scale-105 active:scale-95 shadow-lg no-print uppercase tracking-widest"
                            >
                                <Printer className="h-4 w-4" />
                                Imprimer
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
                                        <th className="px-8 py-6">Catégorie</th>
                                        <th className="px-8 py-6 text-right">Qté Vendue</th>
                                        <th className="px-8 py-6 text-right">Valeur Ventes</th>
                                        <th className="px-8 py-6 text-right text-orange-600">Marge Brute</th>
                                        <th className="px-8 py-6 text-right">Masse CA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-orange-50/30 transition-all duration-300 group">
                                            <td className="px-8 py-7 font-black text-slate-900 uppercase tracking-tighter italic group-hover:text-orange-600 transition-colors">
                                                {row.designation}
                                            </td>
                                            <td className="px-8 py-7">
                                                <span className="bg-white text-slate-400 px-3 py-1 rounded-full text-[10px] font-black tracking-[0.1em] border border-gray-100 shadow-sm uppercase italic">
                                                    Article
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-xl text-sm font-black tabular-nums border border-orange-100 shadow-sm italic">
                                                    {row.quantiteTotale}
                                                </span>
                                            </td>
                                            <td className="px-8 py-7 text-right text-blue-600 font-black tracking-tighter text-xl tabular-nums">
                                                {formatCurrency(row.caTotal)}
                                            </td>
                                            <td className="px-8 py-7 text-right">
                                                <div className="font-black tabular-nums text-emerald-600 italic">
                                                    {formatCurrency(row.margeBrute)}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {row.tauxMarge.toFixed(1)}% de marge
                                                </div>
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
                                            <td colSpan={5} className="px-8 py-32 text-center text-slate-200 font-black uppercase italic tracking-[0.5em] text-xs">
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
                            layout={printLayout}
                        >
                            <table className="w-full text-[14px] border-collapse border-2 border-black">
                                <thead>
                                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                        <th className="border-r-2 border-black px-3 py-3 text-left">Désignation</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Qté Vendue</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Valeur Ventes (CA)</th>
                                        <th className="px-3 py-3 text-right">Part (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((row, idx) => (
                                        <tr key={idx} className="border-b border-black">
                                            <td className="border-r-2 border-black px-3 py-2 font-bold uppercase">{row.designation}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right">{row.quantiteTotale} Unités</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{row.caTotal.toLocaleString()} F</td>
                                            <td className="px-3 py-2 text-right italic font-medium">
                                                {totalCA > 0 ? ((row.caTotal / totalCA) * 100).toFixed(1) : 0}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {index === allChunks.length - 1 && (
                                    <tfoot>
                                        <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                            <td className="border-r-2 border-black px-3 py-4 text-right">TOTAL ANALYSE</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white underline tabular-nums">{totalQty} Articles</td>
                                            <td className="border-r-2 border-black px-3 py-4 text-right bg-white text-blue-900 underline underline-offset-4 decoration-double">{totalCA.toLocaleString()} F</td>
                                            <td className="px-3 py-4 bg-white">100%</td>
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
                       <div>
                         <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Rentabilité Produits</h2>
                         <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                           Analyse des Rotations et de la Performance Stock
                         </p>
                       </div>
                       <div className="h-10 w-px bg-gray-200" />
                       <div className="flex flex-col">
                         <span className="text-xs font-black text-emerald-600 italic uppercase">Période : {startDate}</span>
                         <span className="text-xs font-black text-emerald-600 italic uppercase">jusqu'au : {endDate}</span>
                       </div>
                       <div className="h-10 w-px bg-gray-200" />
                       <div className="flex items-center gap-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase">Orientation :</label>
                         <select 
                           value={printLayout}
                           onChange={(e) => setPrintLayout(e.target.value as any)}
                           className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-orange-500"
                         >
                           <option value="portrait">Portrait</option>
                           <option value="landscape">Paysage</option>
                         </select>
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
                    <div className={`mx-auto ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'} bg-white shadow-2xl min-h-screen p-4 text-slate-900 not-italic tracking-normal`}>
                        {chunkArray(data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                            <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-8 pb-8 last:border-0 last:mb-0 last:pb-0">
                                <ListPrintWrapper
                                    title="RENTABILITÉ & PERFORMANCE PRODUITS"
                                    subtitle={`Analyse statistique consolidée - Rapport d'activité`}
                                    pageNumber={index + 1}
                                    totalPages={allChunks.length}
                                    hideHeader={index > 0}
                                    hideVisa={index < allChunks.length - 1}
                                    layout={printLayout}
                                >
                                    <table className="w-full text-[14px] border-collapse border-2 border-black">
                                        <thead>
                                            <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                                <th className="border-r-2 border-black px-3 py-3 text-left">Désignation de l'Article</th>
                                                <th className="border-r-2 border-black px-3 py-3 text-right tabular-nums">Volume Vendu</th>
                                                <th className="border-r-2 border-black px-3 py-3 text-right">Chiffre d'Affaires</th>
                                                <th className="px-3 py-3 text-right">Masse (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((row, idx) => (
                                                <tr key={idx} className="border-b border-black text-[13px]">
                                                    <td className="border-r-2 border-black px-3 py-2 font-black uppercase text-slate-800">{row.designation}</td>
                                                    <td className="border-r-2 border-black px-3 py-2 text-right font-bold tabular-nums">{row.quantiteTotale}</td>
                                                    <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums text-blue-800">{row.caTotal.toLocaleString()} F</td>
                                                    <td className="px-3 py-2 text-right font-black italic tabular-nums shadow-inner text-orange-600">
                                                        {totalCA > 0 ? ((row.caTotal / totalCA) * 100).toFixed(1) : 0}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {index === allChunks.length - 1 && (
                                            <tfoot>
                                                <tr className="bg-gray-50 font-black text-[15px] border-t-2 border-black uppercase italic">
                                                    <td className="border-r-2 border-black px-3 py-4 text-right bg-white shadow-inner">EXTRACT TOTAL PERFORMANCE</td>
                                                    <td className="border-r-2 border-black px-3 py-4 bg-white italic tabular-nums">{totalQty} Unités</td>
                                                    <td className="border-r-2 border-black px-3 py-4 bg-white text-blue-900 underline underline-offset-4 decoration-double tabular-nums shadow-inner">{totalCA.toLocaleString()} F</td>
                                                    <td className="px-3 py-4 bg-white text-orange-700 underline decoration-double shadow-inner">100 %</td>
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
