'use client'

import { useState, useEffect } from 'react'
import { Filter, DollarSign, Loader2, Calendar, FileText, ArrowUpCircle, ArrowDownCircle, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

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
                setTimeout(() => {
                    window.print()
                    setIsPrinting(false)
                }, 1000)
            }
        } catch (e) {
            console.error(e)
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/10">
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

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
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
                <div className="flex justify-center mt-6 p-4">
                    <Pagination 
                        currentPage={page} 
                        totalPages={totalPages} 
                        itemsPerPage={itemsPerPage} 
                        totalItems={data.length} 
                        onPageChange={setPage} 
                    />
                </div>
            )}

            <ListPrintWrapper
                title={type === 'VENTE' ? "État des Créances Clients" : "État des Dettes Fournisseurs"}
                subtitle={`Rapport financier du ${startDate} au ${endDate}`}
            >
                <table className="w-full text-[10px] border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100 uppercase font-black text-gray-700">
                            <th className="border border-gray-300 px-3 py-3 text-left">Réf / Facture</th>
                            <th className="border border-gray-300 px-3 py-3 text-left">Date</th>
                            <th className="border border-gray-300 px-3 py-3 text-left">{type === 'VENTE' ? 'Client' : 'Fournisseur'}</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Total</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Réglé</th>
                            <th className="border border-gray-300 px-3 py-3 text-right">Solde</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(allDataForPrint.length > 0 ? allDataForPrint : data).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-200">
                                <td className="border border-gray-300 px-3 py-2 font-mono font-bold tracking-tight">{row.numero}</td>
                                <td className="border border-gray-300 px-3 py-2">{new Date(row.date).toLocaleDateString('fr-FR')}</td>
                                <td className="border border-gray-300 px-3 py-2 font-bold uppercase">{row.tier}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right font-bold">{row.montantTotal.toLocaleString()} F</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-emerald-700 font-bold">{row.montantPaye.toLocaleString()} F</td>
                                <td className={`border border-gray-300 px-3 py-2 text-right font-black ${row.solde > 0 ? 'text-rose-700' : 'text-gray-400'}`}>
                                    {row.solde.toLocaleString()} F
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-black text-xs uppercase italic">
                            <td colSpan={3} className="border border-gray-300 px-3 py-4 text-right bg-white tracking-widest text-[9px]">SOLDE GLOBAL DE LA SÉLECTION</td>
                            <td className="border border-gray-300 px-3 py-4 text-right bg-white underline">{(allDataForPrint.length > 0 ? allDataForPrint : data).reduce((acc, curr) => acc + curr.montantTotal, 0).toLocaleString()} F</td>
                            <td className="border border-gray-300 px-3 py-4 text-right bg-white underline text-emerald-700">{(allDataForPrint.length > 0 ? allDataForPrint : data).reduce((acc, curr) => acc + curr.montantPaye, 0).toLocaleString()} F</td>
                            <td className="border border-gray-300 px-3 py-4 text-right bg-white underline decoration-double text-rose-700">{(allDataForPrint.length > 0 ? allDataForPrint : data).reduce((acc, curr) => acc + curr.solde, 0).toLocaleString()} F</td>
                        </tr>
                    </tfoot>
                </table>
            </ListPrintWrapper>

            <style jsx global>{`
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    nav, aside, header, .no-print, button, form, .Pagination, h1, p { display: none !important; }
                    body, main { background: white !important; margin: 0 !important; padding: 0 !important; }
                    table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
                    th { background-color: #f3f4f6 !important; border: 1px solid #000 !important; padding: 4px !important; font-size: 8px !important; font-weight: 900 !important; text-transform: uppercase; }
                    td { border: 1px solid #ccc !important; padding: 4px !important; font-size: 7px !important; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>
        </div>
    )
}
