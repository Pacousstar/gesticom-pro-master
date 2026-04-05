'use client'

import { useState, useEffect } from 'react'
import { Truck, Search, Loader2, ArrowUpRight, Scale, Clock, Wallet, X, Calendar, FileText, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import Pagination from '@/components/ui/Pagination'

type RapportFournisseur = {
    fournisseurId: number | null
    fournisseur: string
    montantTotal: number
    montantPaye: number
    resteAPayer: number
    nbAchats: number
}

export default function RapportFournisseursPage() {
    const [data, setData] = useState<RapportFournisseur[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [dateDebut, setDateDebut] = useState('')
    const [dateFin, setDateFin] = useState('')
    const { error: showError } = useToast()
    const [selectedHistory, setSelectedHistory] = useState<{ id: number | null; nom: string } | null>(null)
    const [historyData, setHistoryData] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [page, setPage] = useState(1)

    const fetchData = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (dateDebut) params.set('start', dateDebut)
            if (dateFin) params.set('end', dateFin)
            
            const res = await fetch('/api/rapports/achats/fournisseurs?' + params.toString())
            if (res.ok) {
                const d = await res.json()
                setData(d)
            } else {
                showError('Erreur lors du chargement des données')
            }
        } catch (e) {
            showError('Erreur réseau')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [dateDebut, dateFin])

    const filteredData = data.filter(f => 
        f.fournisseur.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const itemsPerPage = 20
    const totalPages = Math.ceil(filteredData.length / itemsPerPage)
    const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage)

    const stats = {
        totalAchats: data.reduce((acc, curr) => acc + curr.montantTotal, 0),
        totalPaye: data.reduce((acc, curr) => acc + curr.montantPaye, 0),
        totalDette: data.reduce((acc, curr) => acc + curr.resteAPayer, 0)
    }

    const fetchHistory = async (id: number | null, nom: string) => {
        if (!id) return
        setSelectedHistory({ id, nom })
        setLoadingHistory(true)
        try {
            const params = new URLSearchParams()
            if (dateDebut) params.set('start', dateDebut)
            if (dateFin) params.set('end', dateFin)
            const res = await fetch(`/api/rapports/achats/fournisseurs/${id}/history?` + params.toString())
            if (res.ok) {
                setHistoryData(await res.json())
            }
        } catch (e) {
            showError('Erreur chargement historique')
        } finally {
            setLoadingHistory(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Truck className="h-7 w-7" />
                        Suivi Achats par Fournisseur
                    </h1>
                    <p className="text-orange-100 text-sm">Analyse des engagements et paiements par fournisseur</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/20">
                    <input 
                        type="date" 
                        value={dateDebut} 
                        onChange={e => setDateDebut(e.target.value)}
                        className="bg-white/90 border-0 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-white text-xs font-bold">AU</span>
                    <input 
                        type="date" 
                        value={dateFin} 
                        onChange={e => setDateFin(e.target.value)}
                        className="bg-white/90 border-0 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Scale className="h-12 w-12 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Achats</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalAchats.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Wallet className="h-12 w-12 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Réglé</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalPaye.toLocaleString()} FCFA</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-orange-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Clock className="h-12 w-12 text-orange-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Restes à Payer (Dettes)</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{stats.totalDette.toLocaleString()} FCFA</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Rechercher un fournisseur..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                            <p className="text-gray-500 text-sm font-medium">Analyse des données en cours...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="py-20 text-center text-gray-500 font-medium">
                            Aucune donnée trouvée pour cette période.
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                                    <th className="px-6 py-4">Fournisseur</th>
                                    <th className="px-6 py-4 text-center">Nombre d'Achats</th>
                                    <th className="px-6 py-4 text-right">Total Achat</th>
                                    <th className="px-6 py-4 text-right">Montant Réglé</th>
                                    <th className="px-6 py-4 text-right">Reste à Payer</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedData.map((f, i) => (
                                    <tr 
                                        key={f.fournisseurId || i} 
                                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                                        onClick={() => fetchHistory(f.fournisseurId, f.fournisseur)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs">
                                                    {f.fournisseur.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="font-semibold text-gray-900">{f.fournisseur}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold">
                                                {f.nbAchats}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            {f.montantTotal.toLocaleString()} FCFA
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                            {f.montantPaye.toLocaleString()} FCFA
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${f.resteAPayer > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                                {f.resteAPayer.toLocaleString()} FCFA
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {f.resteAPayer === 0 ? (
                                                <span className="inline-flex items-center text-[10px] h-5 px-2 rounded-full bg-emerald-100 text-emerald-800 font-bold">SOLDE</span>
                                            ) : (
                                                <span className="inline-flex items-center text-[10px] h-5 px-2 rounded-full bg-orange-100 text-orange-800 font-bold">EN COURS</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <Pagination 
                        currentPage={page} 
                        totalPages={totalPages} 
                        itemsPerPage={itemsPerPage} 
                        totalItems={filteredData.length} 
                        onPageChange={setPage} 
                    />
                </div>
            )}

            {selectedHistory && (
                <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                    <div className="p-6 border-b flex items-center justify-between bg-orange-600 text-white">
                        <div>
                            <h2 className="text-xl font-bold">{selectedHistory.nom}</h2>
                            <p className="text-orange-100 text-xs">Historique des opérations</p>
                        </div>
                        <button onClick={() => setSelectedHistory(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                <p className="text-gray-500 text-sm">Chargement des transactions...</p>
                            </div>
                        ) : historyData.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                Aucune transaction trouvée pour ce fournisseur.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyData.map((h, i) => (
                                    <div key={i} className="border rounded-xl p-4 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group border-gray-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">
                                                    <FileText className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                                                </div>
                                                <div>
                                                    <p className="font-mono text-sm font-bold text-gray-900">{h.numero}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">
                                                        {new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-gray-900">{h.montantTotal.toLocaleString()} F</p>
                                                <div className="flex items-center justify-end gap-1">
                                                    {h.statutPaiement === 'PAYE' ? (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 rounded font-bold uppercase">Payé</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 rounded font-bold uppercase">Dette: {(h.montantTotal - h.montantPaye).toLocaleString()} F</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3 mt-3 border-gray-100 group-hover:border-orange-100 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-white px-2 py-0.5 rounded border border-gray-200">{h.modePaiement}</span>
                                                <span className="bg-gray-100 px-2 py-0.5 rounded italic opacity-70">Mag: {h.magasin?.nom}</span>
                                            </div>
                                            <button 
                                                className="text-orange-600 font-bold flex items-center gap-0.5 hover:gap-1.5 transition-all"
                                                onClick={() => window.location.href = `/dashboard/achats?numero=${h.numero}`}
                                            >
                                                Détails <ChevronRight className="h-3 w-3" />
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
    )
}
