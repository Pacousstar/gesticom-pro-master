'use client'

import { useState, useEffect } from 'react'
import { Filter, DollarSign, Loader2, Calendar, FileText, ArrowUpCircle, ArrowDownCircle, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import { chunkArray, ITEMS_PER_PRINT_PAGE } from '@/lib/print-helpers'

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(val).replace('XOF', 'FCFA')
}

export default function RapportFinancesPage() {
    const [type, setType] = useState<'VENTE' | 'ACHAT'>('VENTE')
    const [filter, setFilter] = useState('TOUT')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [searchName, setSearchName] = useState('')
    const [isPrinting, setIsPrinting] = useState(false)
    const [allDataForPrint, setAllDataForPrint] = useState<any[]>([])
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const { error: showError } = useToast()

    useEffect(() => {
        const now = new Date()
        // Par défaut, derniers 30 jours (au lieu du calendrier fixe) pour assurer la visibilité le 1er du mois
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(now.getDate() - 30)
        
        const start = thirtyDaysAgo.toISOString().split('T')[0]
        const end = now.toISOString().split('T')[0]
        setStartDate(start)
        setEndDate(end)
        fetchData('VENTE', start, end, 'TOUT')
    }, [])

    const fetchData = async (t: string, start: string, end: string, f: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/rapports/finances/etat-paiements?type=${t}&dateDebut=${start}&dateFin=${end}&filter=${f}`)
            if (res.ok) {
                setData(await res.json())
            }
        } catch (e) {
            showError('Erreur chargement des données.')
        } finally {
            setLoading(false)
        }
    }

    const handleFilter = (e: React.FormEvent) => {
        e.preventDefault()
        fetchData(type, startDate, endDate, filter)
    }

    const handlePrintAll = async () => {
        setIsPrinting(true)
        try {
            const res = await fetch(`/api/rapports/finances/etat-paiements?type=${type}&dateDebut=${startDate}&dateFin=${endDate}&filter=${filter}&limit=10000`)
            if (res.ok) {
                setAllDataForPrint(await res.json())
                setIsPreviewOpen(true)
            }
        } catch (e) {
            console.error(e)
            showError('Erreur lors de la préparation de l\'impression.')
        } finally {
            setIsPrinting(false)
        }
    }

    const totalMontant = data.reduce((acc, curr) => acc + curr.montantTotal, 0)
    const totalPaye = data.reduce((acc, curr) => acc + curr.montantPaye, 0)
    const totalSolde = data.reduce((acc, curr) => acc + curr.solde, 0)

    const filteredData = data.filter(d => (d.tier || '').toLowerCase().includes(searchName.toLowerCase()))

    const itemsPerPage = 20
    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <DollarSign className="h-8 w-8 text-yellow-400" />
                        État des Paiements
                    </h1>
                    <p className="text-white/80 text-sm mt-1">Suivi des règlements, créances clients et dettes fournisseurs</p>
                </div>

                <div className="flex gap-2">
                    <button 
                        onClick={handlePrintAll}
                        disabled={isPrinting}
                        className="bg-slate-800 text-white px-6 py-2 rounded-xl text-sm font-black hover:bg-slate-900 flex items-center gap-3 transition-all active:scale-95 shadow-lg border-2 border-slate-700 disabled:opacity-50"
                    >
                        {isPrinting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                        IMPRIMER ÉTAT
                    </button>
                    <div className="bg-white/10 p-1 rounded-lg flex border border-white/20">
                        <button 
                            onClick={() => { setType('VENTE'); fetchData('VENTE', startDate, endDate, filter); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${type === 'VENTE' ? 'bg-white text-green-700 shadow-sm' : 'text-white hover:bg-white/5'}`}
                        >
                            Ventes (Créances)
                        </button>
                        <button 
                            onClick={() => { setType('ACHAT'); fetchData('ACHAT', startDate, endDate, filter); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${type === 'ACHAT' ? 'bg-white text-orange-700 shadow-sm' : 'text-white hover:bg-white/5'}`}
                        >
                            Achats (Dettes)
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-blue-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Montant Total</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(totalMontant)}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Réglé</p>
                    <p className="text-2xl font-black text-green-600 mt-1">{formatCurrency(totalPaye)}</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-500">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Reste à Payer (Solde)</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(totalSolde)}</p>
                </div>
            </div>

            <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/10 no-print">
                <div>
                    <label className="block text-xs font-bold text-white mb-2 uppercase">Période du</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-white rounded-lg border-0 px-4 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-white mb-2 uppercase">Au</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-white rounded-lg border-0 px-4 py-2 text-sm focus:ring-2 focus:ring-yellow-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-white mb-2 uppercase">Statut</label>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-white rounded-lg border-0 px-4 py-2 text-sm focus:ring-2 focus:ring-yellow-400 min-w-[150px]"
                    >
                        <option value="TOUT">Toutes les factures</option>
                        <option value="NON_SOLDER">Non soldées (Dettes)</option>
                        <option value="SOLDER">Soldées (Payées)</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-white mb-2 uppercase">
                        {type === 'VENTE' ? 'Nom du Client' : 'Nom du Fournisseur'}
                    </label>
                    <input
                        type="text"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder={`Rechercher un ${type === 'VENTE' ? 'client' : 'fournisseur'}...`}
                        className="w-full bg-white rounded-lg border-0 px-4 py-2 text-sm focus:ring-2 focus:ring-yellow-400 text-gray-900 placeholder-gray-400"
                    />
                </div>
                <button type="submit" className="bg-yellow-400 text-black px-6 py-2 rounded-lg text-sm font-black hover:bg-yellow-500 flex items-center gap-2 transition-all active:scale-95">
                    <Filter className="h-4 w-4" /> FILTRER
                </button>
            </form>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 no-print">
                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
                        <p className="text-gray-400 font-medium animate-pulse">Extraction des données financières...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Facture</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">Date</th>
                                    <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase">{type === 'VENTE' ? 'Client' : 'Fournisseur'}</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase">Total</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase">Réglé</th>
                                    <th className="px-6 py-4 text-right text-xs font-black text-gray-400 uppercase">Solde</th>
                                    <th className="px-6 py-4 text-center text-xs font-black text-gray-400 uppercase">Statut</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded ${type === 'VENTE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <span className="font-mono text-sm font-bold text-gray-900">{row.numero}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(row.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-semibold text-gray-900">{row.tier}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">{row.montantTotal.toLocaleString()} F</td>
                                        <td className="px-6 py-4 text-right font-medium text-green-600">{row.montantPaye.toLocaleString()} F</td>
                                        <td className={`px-6 py-4 text-right font-black ${row.solde > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            {row.solde.toLocaleString()} F
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                                                row.statut === 'PAYE' ? 'bg-green-100 text-green-800' : 
                                                row.statut === 'PARTIEL' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {row.statut === 'PARTIEL' ? 'Partiel' : row.statut === 'PAYE' ? 'Soldé' : 'À crédit'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-20">
                                                <Calendar className="h-12 w-12" />
                                                <p className="text-xl font-bold italic">Aucune donnée trouvée</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {totalPages > 1 && (
                <div className="flex justify-center mt-6 p-4 no-print">
                    <Pagination 
                        currentPage={page} 
                        totalPages={totalPages} 
                        itemsPerPage={itemsPerPage} 
                        totalItems={data.length} 
                        onPageChange={setPage} 
                    />
                </div>
            )}

            {/* Rendu Système (Impression Native) */}
            <div className="hidden print:block absolute inset-0 bg-white shadow-2xl">
                {chunkArray(allDataForPrint.length > 0 ? allDataForPrint : data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                    <div key={index} className={index < allChunks.length - 1 ? 'page-break' : ''}>
                        <ListPrintWrapper
                            title={type === 'VENTE' ? "État des Créances Clients" : "État des Dettes Fournisseurs"}
                            subtitle={`Audit Financier consolidé - Page ${index + 1}/${allChunks.length}`}
                            pageNumber={index + 1}
                            totalPages={allChunks.length}
                            hideHeader={index > 0}
                            hideVisa={index < allChunks.length - 1}
                        >
                            <table className="w-full text-[14px] border-collapse border-2 border-black font-sans shadow-inner">
                                <thead>
                                    <tr className="bg-gray-100 uppercase font-black text-gray-900 border-b-2 border-black">
                                        <th className="border-r-2 border-black px-3 py-3 text-left">Facture / Date</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-left">Tier ({type === 'VENTE' ? 'Client' : 'Fournisseur'})</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Total</th>
                                        <th className="border-r-2 border-black px-3 py-3 text-right">Réglé</th>
                                        <th className="px-3 py-3 text-right">Solde</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((row, idx) => (
                                        <tr key={idx} className="border-b border-black hover:bg-gray-50 transition-colors">
                                            <td className="border-r-2 border-black px-3 py-2">
                                                <div className="font-black text-slate-800 tracking-tighter uppercase">{row.numero}</div>
                                                <div className="text-[10px] font-bold text-gray-400 italic">{new Date(row.date).toLocaleDateString('fr-FR')}</div>
                                            </td>
                                            <td className="border-r-2 border-black px-3 py-2 font-black uppercase italic tracking-tighter text-gray-700">{row.tier}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black tabular-nums">{row.montantTotal.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right text-emerald-800 font-black tabular-nums italic shadow-inner bg-gray-50/30">{row.montantPaye.toLocaleString()} F</td>
                                            <td className={`px-3 py-2 text-right font-black tabular-nums underline decoration-double underline-offset-2 ${row.solde > 0 ? 'text-red-800' : 'text-gray-400'}`}>
                                                {row.solde.toLocaleString()} F
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {index === allChunks.length - 1 && (
                                    <tfoot>
                                        <tr className="bg-gray-200 font-black text-[15px] border-t-2 border-black uppercase italic shadow-2xl">
                                            <td colSpan={3} className="px-3 py-6 text-right tracking-[0.2em] underline decoration-double underline-offset-4">SYNTHÈSE GLOBALE DES ENGAGEMENTS</td>
                                            <td className="px-3 py-6 text-right bg-white ring-2 ring-black font-mono text-emerald-800">{totalPaye.toLocaleString()} F</td>
                                            <td className="px-3 py-6 text-right bg-slate-900 text-white font-mono shadow-inner">{totalSolde.toLocaleString()} F</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </ListPrintWrapper>
                    </div>
                ))}
            </div>

            {/* MODALE D'APERÇU IMPRESSION ÉTAT FINANCIER */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter shadow-2xl">
                    <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                        <div className="flex items-center gap-6">
                            <div className={`p-3 rounded-2xl ${type === 'VENTE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                <DollarSign className="h-8 w-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">
                                    Aperçu {type === 'VENTE' ? 'Créances Clients' : 'Dettes Fournisseurs'}
                                </h2>
                                <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                                    Audit Consolidé des Engagements Financiers
                                </p>
                            </div>
                            <div className="h-10 w-px bg-gray-200" />
                            <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-400 italic uppercase">Période du {startDate}</span>
                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic leading-none">Au {endDate}</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsPreviewOpen(false)}
                                className="rounded-xl border-2 border-gray-200 px-6 py-2 text-sm font-black text-gray-700 hover:bg-gray-50 transition-all uppercase tracking-widest"
                            >
                                Fermer
                            </button>
                            <button
                                onClick={() => window.print()}
                                className={`flex items-center gap-2 rounded-xl px-10 py-2 text-sm font-black text-white shadow-xl transition-all active:scale-95 uppercase tracking-widest ${type === 'VENTE' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                            >
                                <Printer className="h-4 w-4" />
                                Confirmer Impression
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-12 bg-gray-100/30">
                        <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                            {chunkArray(allDataForPrint.length > 0 ? allDataForPrint : data, ITEMS_PER_PRINT_PAGE).map((chunk, index, allChunks) => (
                                <div key={index} className="page-break-after border-b-2 border-dashed border-gray-100 mb-12 pb-12 last:border-0 last:mb-0 last:pb-0 shadow-sm">
                                    <ListPrintWrapper
                                        title={type === 'VENTE' ? "ÉTAT DÉTAILLÉ DES CRÉANCES" : "ÉTAT DÉTAILLÉ DES DETTES"}
                                        subtitle="Audit des flux de trésorerie et règlements par tiers"
                                        pageNumber={index + 1}
                                        totalPages={allChunks.length}
                                        hideHeader={index > 0}
                                        hideVisa={index < allChunks.length - 1}
                                    >
                                        <table className="w-full text-[14px] border-collapse border-4 border-black font-sans shadow-2xl">
                                            <thead>
                                                <tr className="bg-black text-white uppercase font-black border-2 border-black">
                                                    <th className="border-r-2 border-white px-4 py-4 text-left">Pièce / Date</th>
                                                    <th className="border-r-2 border-white px-4 py-4 text-left italic">Identité du Tiers</th>
                                                    <th className="border-r-2 border-white px-4 py-4 text-right tabular-nums tracking-tighter">Engagement Brut</th>
                                                    <th className="px-4 py-4 text-right bg-slate-800 tracking-tighter italic">Solde Restant</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chunk.map((row, idx) => (
                                                    <tr key={idx} className="border-b-2 border-black hover:bg-gray-50 transition-colors">
                                                        <td className="border-r-2 border-black px-4 py-3">
                                                            <div className="font-black text-slate-800 tracking-tighter uppercase">{row.numero}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 italic">{new Date(row.date).toLocaleDateString()}</div>
                                                        </td>
                                                        <td className="border-r-2 border-black px-4 py-3">
                                                            <div className="font-black uppercase leading-tight italic text-slate-700 tracking-tighter text-[13px]">{row.tier}</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 flex items-center gap-1 opacity-60"><FileText className="h-2 w-2" /> DATA AUDIT</div>
                                                        </td>
                                                        <td className="border-r-2 border-black px-4 py-3 text-right font-black tabular-nums text-[16px] text-gray-500">
                                                            {row.montantTotal.toLocaleString()} F
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black tabular-nums text-lg bg-gray-50/50 underline decoration-double decoration-gray-300 shadow-inner italic leading-none ${row.solde > 0 ? 'text-red-900 border-l-2 border-red-100' : 'text-emerald-700'}`}>
                                                            {row.solde.toLocaleString()} F
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            {index === allChunks.length - 1 && (
                                                <tfoot>
                                                    <tr className="bg-black text-white font-black text-[18px] border-t-4 border-black uppercase italic shadow-2xl">
                                                        <td colSpan={2} className="px-4 py-8 text-right tracking-[0.3em] underline decoration-yellow-500 decoration-4 underline-offset-8">TOTAL GÉNÉRAL DU SOLDE PÉRIODE</td>
                                                        <td className="bg-slate-900"></td>
                                                        <td className="px-4 py-8 text-right text-3xl tabular-nums bg-red-950 border-x-4 border-white shadow-inner font-mono ring-4 ring-red-900 leading-none">
                                                            {totalSolde.toLocaleString()} F
                                                        </td>
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
