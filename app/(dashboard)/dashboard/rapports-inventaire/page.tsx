'use client'

import { useState, useEffect } from 'react'
import { FileBarChart, Loader2, Calendar, TrendingUp, Package, Wallet, ArrowDownRight, ArrowUpRight, Printer } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'

type GlobalData = {
    date: string
    ventes: Array<{ mode: string; total: number; encaisse: number; credit: number }>
    stock: { valeurEntree: number; valeurSortie: number; nbMouvements: number }
    tresorerie: { entrees: number; sorties: number }
}

export default function RapportInventaireGlobalPage() {
    const [data, setData] = useState<GlobalData | null>(null)
    const [loading, setLoading] = useState(true)
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const { error: showError } = useToast()
    const [isPrinting, setIsPrinting] = useState(false)
    const [entreprise, setEntreprise] = useState<any>(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/rapports/inventaire-global?date=${date}`)
            if (res.ok) {
                const d = await res.json()
                setData(d)
            } else {
                showError('Erreur lors du chargement de l\'inventaire')
            }
        } catch (e) {
            showError('Erreur réseau')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        fetch('/api/parametres').then(r => r.ok && r.json()).then(d => { if (d) setEntreprise(d) }).catch(() => { })
    }, [date])

    const totalVentes = data?.ventes.reduce((acc, v) => acc + v.total, 0) || 0
    const totalEncaisse = data?.ventes.reduce((acc, v) => acc + v.encaisse, 0) || 0

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileBarChart className="h-7 w-7" />
                        Inventaire Global Journalier
                    </h1>
                    <p className="text-orange-100 text-sm">Vue consolidée des ventes, stocks et trésorerie par jour</p>
                </div>

                <div className="flex items-center gap-3 no-print">
                    <button 
                        onClick={() => { setIsPrinting(true); setTimeout(() => { window.print(); setIsPrinting(false); }, 500); }}
                        disabled={isPrinting}
                        className="flex items-center gap-2 rounded-xl border-2 border-orange-500 bg-white px-5 py-2.5 text-sm font-black text-orange-700 hover:bg-orange-50 shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                    >
                        {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} 
                        IMPRIMER BILAN
                    </button>
                    <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/20">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-white" />
                            <input 
                                type="date" 
                                value={date} 
                                onChange={e => setDate(e.target.value)}
                                className="bg-white border-0 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                    <p className="text-white font-medium">Compilation de l'inventaire journalier...</p>
                </div>
            ) : data && (
                <div className="grid gap-6">
                    {/* Synthèse Ventes */}
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700">
                            <h2 className="text-white font-bold flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                Synthèse des Ventes (CA : {totalVentes.toLocaleString()} FCFA)
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-4 md:grid-cols-4">
                                {data.ventes.map((v, i) => (
                                    <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-tighter">{v.mode}</p>
                                        <p className="text-lg font-bold text-gray-900 mt-1">{v.total.toLocaleString()} FCFA</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]">
                                            <span className="text-emerald-600 font-bold">Enc : {v.encaisse.toLocaleString()}</span>
                                            <span className="text-orange-600 font-bold">Créd : {v.credit.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Synthèse Stock */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700">
                                <h2 className="text-white font-bold flex items-center gap-2">
                                    <Package className="h-5 w-5" />
                                    Flux de Stocks
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <ArrowDownRight className="h-5 w-5 text-emerald-600" />
                                        <span className="font-medium text-emerald-900">Valeur des Entrées</span>
                                    </div>
                                    <span className="text-lg font-bold text-emerald-700">{data.stock.valeurEntree.toLocaleString()} FCFA</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <ArrowUpRight className="h-5 w-5 text-orange-600" />
                                        <span className="font-medium text-orange-900">Valeur des Sorties (Ventes)</span>
                                    </div>
                                    <span className="text-lg font-bold text-orange-700">{data.stock.valeurSortie.toLocaleString()} FCFA</span>
                                </div>
                                <p className="text-center text-xs text-gray-500 font-medium italic">
                                    Nombre total de mouvements ce jour : {data.stock.nbMouvements}
                                </p>
                            </div>
                        </div>

                        {/* Synthèse Trésorerie */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                            <div className="px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-700">
                                <h2 className="text-white font-bold flex items-center gap-2">
                                    <Wallet className="h-5 w-5" />
                                    Mouvements de Trésorerie (Caisse)
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <span className="font-medium text-gray-700">Total Entrées Caisse</span>
                                    <span className="text-lg font-bold text-emerald-600">+{data.tresorerie.entrees.toLocaleString()} FCFA</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <span className="font-medium text-gray-700">Total Sorties Caisse</span>
                                    <span className="text-lg font-bold text-red-600">-{data.tresorerie.sorties.toLocaleString()} FCFA</span>
                                </div>
                                <div className="pt-4 border-t flex items-center justify-between font-bold">
                                    <span className="text-gray-900">Solde Net du Jour</span>
                                    <span className={`text-xl ${(data.tresorerie.entrees - data.tresorerie.sorties) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(data.tresorerie.entrees - data.tresorerie.sorties).toLocaleString()} FCFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Zone d'impression professionnelle standardisée */}
            <ListPrintWrapper
                title="Bilan de Journée"
                subtitle="Inventaire Global Consolidé"
                dateRange={{ start: date, end: date }}
            >
                <div className="space-y-8">
                    {/* Tableau Ventes Impression */}
                    <div className="border-2 border-black p-4">
                        <h3 className="text-lg font-black uppercase mb-3 border-b-2 border-black pb-1 italic">I. RÉCAPITULATIF DES VENTES</h3>
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 uppercase font-black">
                                    <th className="border border-black px-2 py-2 text-left">Mode de Règlement</th>
                                    <th className="border border-black px-2 py-2 text-right">Encaissements</th>
                                    <th className="border border-black px-2 py-2 text-right">Crédits (Dettes)</th>
                                    <th className="border border-black px-2 py-2 text-right">Total CA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.ventes.map((v, i) => (
                                    <tr key={i}>
                                        <td className="border border-black px-2 py-1 font-bold uppercase">{v.mode}</td>
                                        <td className="border border-black px-2 py-1 text-right font-black text-emerald-800">{v.encaisse.toLocaleString()} F</td>
                                        <td className="border border-black px-2 py-1 text-right text-red-700">{v.credit.toLocaleString()} F</td>
                                        <td className="border border-black px-2 py-1 text-right font-black">{v.total.toLocaleString()} F</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="font-black bg-gray-900 text-white uppercase italic">
                                <tr>
                                    <td className="border border-black px-2 py-3 text-right">TOTAUX VENTES DU JOUR</td>
                                    <td className="border border-black px-2 py-3 text-right text-emerald-200">{totalEncaisse.toLocaleString()} F</td>
                                    <td className="border border-black px-2 py-3 text-right text-red-200">{(totalVentes - totalEncaisse).toLocaleString()} F</td>
                                    <td className="border border-black px-2 py-3 text-right text-xl underline">{totalVentes.toLocaleString()} F</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Stocks Impression */}
                        <div className="border-2 border-black p-4">
                            <h3 className="text-sm font-black uppercase mb-3 border-b-2 border-black pb-1 italic">II. FLUX DE STOCKS</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between border-b border-dashed border-black pb-1">
                                    <span className="text-[10px] uppercase font-bold">Valeur des Entrées :</span>
                                    <span className="font-black">+{data?.stock.valeurEntree.toLocaleString()} F</span>
                                </div>
                                <div className="flex justify-between border-b border-dashed border-black pb-1">
                                    <span className="text-[10px] uppercase font-bold">Valeur des Sorties :</span>
                                    <span className="font-black">-{data?.stock.valeurSortie.toLocaleString()} F</span>
                                </div>
                                <p className="text-[9px] italic mt-2">Mouvements enregistrés : {data?.stock.nbMouvements}</p>
                            </div>
                        </div>

                        {/* Trésorerie Impression */}
                        <div className="border-2 border-red-700 p-4">
                            <h3 className="text-sm font-black uppercase mb-3 border-b-2 border-red-700 pb-1 italic text-red-800">III. MOUVEMENTS CAISSE</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between border-b border-dashed border-red-200 pb-1">
                                    <span className="text-[10px] uppercase font-bold text-red-900">Total Recettes :</span>
                                    <span className="font-black text-emerald-700">+{data?.tresorerie.entrees.toLocaleString()} F</span>
                                </div>
                                <div className="flex justify-between border-b border-dashed border-red-200 pb-1">
                                    <span className="text-[10px] uppercase font-bold text-red-900">Total Dépenses :</span>
                                    <span className="font-black text-red-700">-{data?.tresorerie.sorties.toLocaleString()} F</span>
                                </div>
                                <div className="flex justify-between pt-2 text-red-900 bg-red-50 p-2">
                                    <span className="text-[10px] uppercase font-black">SOLDE NET CAISSE :</span>
                                    <span className="font-black text-lg underline">{( (data?.tresorerie?.entrees || 0) - (data?.tresorerie?.sorties || 0) ).toLocaleString()} F</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ListPrintWrapper>

            <style jsx global>{`
                @media print {
                    nav, aside, button, .no-print, form, header { display: none !important; }
                    body, .print-document { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                }
            `}</style>
        </div>
    )
}
