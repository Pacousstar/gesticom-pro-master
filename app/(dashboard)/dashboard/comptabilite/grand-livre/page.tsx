'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
    Book,
    Search,
    Download,
    Printer,
    ArrowLeft,
    RefreshCw,
    Filter,
    Calendar,
    MapPin,
    Tag,
    Building,
    FileSpreadsheet
} from 'lucide-react'
import Link from 'next/link'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ComptabiliteNav from '../ComptabiliteNav'
import * as XLSX from 'xlsx-prototype-pollution-fixed'

function formatFcfa(n: number) {
    return Math.round(n).toLocaleString('fr-FR') + ' F'
}

export default function GrandLivrePage() {
    const [annee, setAnnee] = useState(new Date().getFullYear())
    const [compteId, setCompteId] = useState('all')
    const [magasinId, setMagasinId] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')

    const { data: ecritures, error, isLoading } = useSWR<any[]>(
        `/api/comptabilite/grand-livre?annee=${annee}&compteId=${compteId}&magasinId=${magasinId}`
    )
    const { data: comptes } = useSWR<any[]>('/api/comptabilite/comptes')
    const { data: magasins } = useSWR<any[]>('/api/magasins')

    const filteredEcritures = ecritures?.filter(e => 
        e.libelle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.piece.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.compte.numero.includes(searchTerm)
    )

    const exportToExcel = () => {
        if (!filteredEcritures) return
        const workbook = XLSX.utils.book_new()
        const data = filteredEcritures.map(e => ({
            'Date': new Date(e.date).toLocaleDateString('fr-FR'),
            'Compte': e.compte.numero,
            'Libellé Compte': e.compte.libelle,
            'Pièce': e.piece,
            'Libellé': e.libelle,
            'Débit': e.debit,
            'Crédit': e.credit
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        XLSX.utils.book_append_sheet(workbook, ws, 'Grand Livre')
        XLSX.writeFile(workbook, `Grand_Livre_${annee}.xlsx`)
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header Premium */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20">
                        <Book className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Grand Livre</h1>
                        <p className="text-white/60 font-bold uppercase tracking-widest text-[10px]">Détail exhaustif des écritures — Exercice {annee}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={annee}
                        onChange={(e) => setAnnee(parseInt(e.target.value))}
                        className="rounded-xl border-none bg-white/10 backdrop-blur-md text-white font-bold px-4 py-2.5 outline-none"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-gray-900">{y}</option>)}
                    </select>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700 shadow-xl transition-all uppercase tracking-widest"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exporter
                    </button>
                </div>
            </div>

            <ComptabiliteNav />

            {/* Filtres de recherche */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une pièce, libellé..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-gray-100 focus:border-blue-500 focus:ring-0 text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    value={compteId}
                    onChange={(e) => setCompteId(e.target.value)}
                    className="rounded-xl border-gray-100 text-sm font-bold text-gray-700"
                >
                    <option value="all">Tous les comptes</option>
                    {comptes?.map(c => <option key={c.id} value={c.id}>{c.numero} - {c.libelle}</option>)}
                </select>

                <select 
                    value={magasinId}
                    onChange={(e) => setMagasinId(e.target.value)}
                    className="rounded-xl border-gray-100 text-sm font-bold text-gray-700"
                >
                    <option value="all">Tous les magasins (Consolidé)</option>
                    {magasins?.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>

                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100 italic">
                    <Tag className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
                        {filteredEcritures?.length || 0} écritures trouvées
                    </span>
                </div>
            </div>

            {/* Table des écritures */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Compte</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pièce</th>
                                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Libellé</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Débit</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Crédit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-12 bg-gray-50/50" />
                                    </tr>
                                ))
                            ) : filteredEcritures?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <p className="text-gray-400 font-medium italic">Aucune écriture trouvée pour ces critères.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredEcritures?.map((e, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-gray-900 tabular-nums">
                                                {new Date(e.date).toLocaleDateString('fr-FR')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mb-1">{e.compte.numero}</span>
                                                <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{e.compte.libelle}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-gray-900 border-b-2 border-orange-200">{e.piece}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-gray-600 font-medium italic">{e.libelle}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-gray-900 tabular-nums">
                                                {e.debit > 0 ? formatFcfa(e.debit) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-black text-gray-900 tabular-nums italic">
                                                {e.credit > 0 ? formatFcfa(e.credit) : '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {filteredEcritures && filteredEcritures.length > 0 && (
                            <tfoot className="bg-gray-900 text-white">
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-sm font-black uppercase italic tracking-widest text-right">Totaux Période</td>
                                    <td className="px-6 py-4 text-right text-base font-black tabular-nums text-emerald-400">
                                        {formatFcfa(filteredEcritures.reduce((s, e) => s + e.debit, 0))}
                                    </td>
                                    <td className="px-6 py-4 text-right text-base font-black tabular-nums text-orange-400">
                                        {formatFcfa(filteredEcritures.reduce((s, e) => s + e.credit, 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    )
}
