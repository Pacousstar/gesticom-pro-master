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
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
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
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex items-center gap-2 rounded-xl border-2 border-slate-800 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-900 hover:bg-slate-200 shadow-xl transition-all active:scale-95 no-print uppercase tracking-widest"
                    >
                        <Printer className="h-4 w-4" /> 
                        Aperçu Impression
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
            <div className="hidden print:block absolute inset-0 bg-white">
                <ListPrintWrapper
                    title="Bilan d'Inventaire Global"
                    subtitle={`Rapport de synthèse consolidé - Journée du ${date}`}
                    pageNumber={1}
                    totalPages={1}
                >
                    <div className="space-y-8">
                        {/* SYNTHESE VENTES IMPRESSION */}
                        <div className="border-2 border-black p-6 bg-gray-50/50">
                            <h3 className="text-[15px] font-black uppercase mb-4 border-b-2 border-black pb-2 italic text-blue-900">
                                I. RÉCAPITULATIF DES TRANSACTIONS COMMERCIALES
                            </h3>
                            <table className="w-full text-[14px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-200 border-2 border-black uppercase font-black">
                                        <th className="border-2 border-black px-3 py-3 text-left">Mode de Règlement</th>
                                        <th className="border-2 border-black px-3 py-3 text-right">Encaissements</th>
                                        <th className="border-2 border-black px-3 py-3 text-right">Crédits</th>
                                        <th className="border-2 border-black px-3 py-3 text-right text-indigo-900 shadow-inner">Total Chiffre d'Affaires</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.ventes.map((v, i) => (
                                        <tr key={i} className="border-b border-black">
                                            <td className="border-r-2 border-l-2 border-black px-3 py-2 font-bold uppercase">{v.mode}</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black text-emerald-800">{v.encaisse.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right text-rose-700 font-medium">{v.credit.toLocaleString()} F</td>
                                            <td className="border-r-2 border-black px-3 py-2 text-right font-black bg-gray-50">{v.total.toLocaleString()} F</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="font-black border-2 border-black uppercase italic">
                                    <tr className="bg-gray-100">
                                        <td className="border-r-2 border-black px-3 py-4 text-right">VOLUME GLOBAL DE LA JOURNÉE</td>
                                        <td className="border-r-2 border-black px-3 py-4 text-right text-emerald-700 underline underline-offset-4 decoration-double">{totalEncaisse.toLocaleString()} F</td>
                                        <td className="border-r-2 border-black px-3 py-4 text-right text-rose-700">{(totalVentes - totalEncaisse).toLocaleString()} F</td>
                                        <td className="px-3 py-4 text-right text-[15px] underline underline-offset-4 text-blue-900 decoration-double">{totalVentes.toLocaleString()} F</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            {/* STOCKS IMPRESSION */}
                            <div className="border-2 border-black p-6">
                                <h3 className="text-[14px] font-black uppercase mb-4 border-b-2 border-black pb-2 italic text-emerald-900 flex items-center gap-2">
                                    II. MOUVEMENTS DE STOCKS
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-emerald-50/50 p-2 border border-dashed border-emerald-200">
                                        <span className="text-[12px] uppercase font-bold text-emerald-800 italic">Valeur des Entrées :</span>
                                        <span className="text-[15px] font-black text-emerald-700">+{data?.stock.valeurEntree.toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-orange-50/50 p-2 border border-dashed border-orange-200">
                                        <span className="text-[12px] uppercase font-bold text-orange-800 italic">Valeur des Sorties :</span>
                                        <span className="text-[15px] font-black text-orange-700">-{data?.stock.valeurSortie.toLocaleString()} F</span>
                                    </div>
                                    <p className="text-[11px] font-black italic mt-4 text-gray-500 uppercase tracking-widest text-center border-t border-gray-100 pt-2 shadow-inner">
                                        Flux Logistique : {data?.stock.nbMouvements} Mouvements
                                    </p>
                                </div>
                            </div>

                            {/* TRESORERIE IMPRESSION */}
                            <div className="border-2 border-orange-700 p-6 bg-orange-50/20">
                                <h3 className="text-[14px] font-black uppercase mb-4 border-b-2 border-orange-700 pb-2 italic text-red-800">
                                    III. ANALYSE DE LA CAISSE
                                </h3>
                                <div className="space-y-4 font-sans tracking-tighter">
                                    <div className="flex justify-between border-b border-dashed border-red-300 pb-2">
                                        <span className="text-[12px] uppercase font-black text-red-900">Total Recettes :</span>
                                        <span className="text-[14px] font-black text-emerald-700">+{data?.tresorerie.entrees.toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-red-300 pb-2">
                                        <span className="text-[12px] uppercase font-black text-red-900">Total Dépenses :</span>
                                        <span className="text-[14px] font-black text-red-700">-{data?.tresorerie.sorties.toLocaleString()} F</span>
                                    </div>
                                    <div className="flex justify-between mt-4 bg-red-600 text-white p-4 shadow-xl ring-2 ring-red-700">
                                        <span className="text-[12px] uppercase font-black italic tracking-normal">SOLDE NET RÉEL :</span>
                                        <span className="text-[18px] font-black tabular-nums underline decoration-double shadow-2xl">
                                            {( (data?.tresorerie?.entrees || 0) - (data?.tresorerie?.sorties || 0) ).toLocaleString()} F
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ListPrintWrapper>
            </div>

            {/* MODALE D'APERÇU IMPRESSION INVENTAIRE GLOBAL */}
            {isPreviewOpen && (
              <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans text-slate-900 uppercase italic tracking-tighter">
                <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl not-italic tracking-normal">
                    <div className="flex items-center gap-6">
                       <div>
                         <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Bilan Journalier</h2>
                         <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                           Consolidation des Opérations et Flux Globaux
                         </p>
                       </div>
                       <div className="h-10 w-px bg-gray-200" />
                       <div className="flex flex-col">
                         <span className="text-xs font-black text-orange-600 italic">Inventaire du {date}</span>
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Rapport Camicase Pro</span>
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
                    <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-12 text-slate-900 not-italic tracking-normal">
                        <ListPrintWrapper
                            title="BILAN D'INVENTAIRE GLOBAL"
                            subtitle={`Audit journalier consolidé - État au ${date}`}
                            pageNumber={1}
                            totalPages={1}
                        >
                            <div className="space-y-12">
                                {/* SYNTHESE VENTES IMPRESSION */}
                                <div className="border-4 border-black p-8 bg-gray-50 shadow-inner">
                                    <h3 className="text-[18px] font-black uppercase mb-6 border-b-4 border-black pb-4 italic text-blue-900 flex items-center justify-between">
                                        <span>I. PERFORMANCE COMMERCIALE & FLUX VENTES</span>
                                        <TrendingUp className="h-6 w-6" />
                                    </h3>
                                    <table className="w-full text-[15px] border-collapse">
                                        <thead>
                                            <tr className="bg-black text-white uppercase font-black">
                                                <th className="border-2 border-black px-4 py-4 text-left">Mode de Paiement</th>
                                                <th className="border-2 border-black px-4 py-4 text-right">Encaissements</th>
                                                <th className="border-2 border-black px-4 py-4 text-right">Créances</th>
                                                <th className="border-2 border-black px-4 py-4 text-right bg-blue-800 shadow-2xl">Total Ventes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data?.ventes.map((v, i) => (
                                                <tr key={i} className="border-b-2 border-black font-medium">
                                                    <td className="border-x-2 border-black px-4 py-3 font-black uppercase text-slate-700 tracking-tighter italic">{v.mode}</td>
                                                    <td className="border-r-2 border-black px-4 py-3 text-right font-black text-emerald-700 tabular-nums">{v.encaisse.toLocaleString()} F</td>
                                                    <td className="border-r-2 border-black px-4 py-3 text-right text-rose-600 tabular-nums font-bold italic">{v.credit.toLocaleString()} F</td>
                                                    <td className="border-r-2 border-black px-4 py-3 text-right font-black bg-gray-100 tabular-nums text-lg shadow-sm font-mono">{v.total.toLocaleString()} F</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="font-black border-4 border-black uppercase italic">
                                            <tr className="bg-gray-200 shadow-2xl">
                                                <td className="px-4 py-6 text-right tracking-[0.2em] italic underline decoration-double underline-offset-8">CHIFFRE D'AFFAIRES GLOBAL</td>
                                                <td className="px-4 py-6 text-right text-emerald-800 tabular-nums underline decoration-double">{totalEncaisse.toLocaleString()} F</td>
                                                <td className="px-4 py-6 text-right text-rose-700 tabular-nums">{(totalVentes - totalEncaisse).toLocaleString()} F</td>
                                                <td className="px-4 py-6 text-right text-2xl tabular-nums bg-blue-900 text-white shadow-2xl ring-4 ring-blue-950">{totalVentes.toLocaleString()} F</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="grid grid-cols-2 gap-12">
                                    {/* STOCKS IMPRESSION */}
                                    <div className="border-4 border-black p-8 bg-emerald-50 shadow-2xl flex flex-col justify-between">
                                        <h3 className="text-[16px] font-black uppercase mb-6 border-b-2 border-black pb-4 italic text-emerald-900 flex items-center justify-between">
                                            <span>II. ANALYSE LOGISTIQUE</span>
                                            <Package className="h-6 w-6" />
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center bg-white p-4 border-2 border-emerald-200 shadow-sm rounded-2xl">
                                                <span className="text-[13px] uppercase font-black text-emerald-800 italic tracking-tighter">Entrées Stock :</span>
                                                <span className="text-[18px] font-black text-emerald-700 tabular-nums decoration-white shadow-inner px-4">+{data?.stock.valeurEntree.toLocaleString()} F</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-white p-4 border-2 border-orange-200 shadow-sm rounded-2xl">
                                                <span className="text-[13px] uppercase font-black text-orange-800 italic tracking-tighter">Sorties Stock :</span>
                                                <span className="text-[18px] font-black text-orange-700 tabular-nums decoration-white shadow-inner px-4">-{data?.stock.valeurSortie.toLocaleString()} F</span>
                                            </div>
                                            <div className="p-6 bg-emerald-900 text-white rounded-[2rem] text-center shadow-2xl ring-4 ring-emerald-950 mt-8">
                                                <p className="text-[10px] uppercase font-bold tracking-[0.3em] opacity-60 mb-2">Volume Transactions</p>
                                                <p className="text-3xl font-black italic tabular-nums tracking-tighter">{data?.stock.nbMouvements} OPÉRATIONS</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TRESORERIE IMPRESSION */}
                                    <div className="border-4 border-red-700 p-8 bg-rose-50 shadow-2xl flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                            <Wallet className="h-32 w-32" />
                                        </div>
                                        <h3 className="text-[16px] font-black uppercase mb-6 border-b-2 border-red-700 pb-4 italic text-red-900 flex items-center justify-between">
                                            <span>III. ÉQUILIBRE TRÉSORERIE</span>
                                            <Wallet className="h-6 w-6" />
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="flex justify-between border-b-2 border-dashed border-red-300 pb-4">
                                                <span className="text-[14px] uppercase font-black text-slate-800 italic tracking-tighter">Flux Entrant :</span>
                                                <span className="text-[18px] font-black text-emerald-700 tabular-nums">+{data?.tresorerie.entrees.toLocaleString()} F</span>
                                            </div>
                                            <div className="flex justify-between border-b-2 border-dashed border-red-300 pb-4">
                                                <span className="text-[14px] uppercase font-black text-slate-800 italic tracking-tighter">Décaiss. Charges :</span>
                                                <span className="text-[18px] font-black text-red-700 tabular-nums">-{data?.tresorerie.sorties.toLocaleString()} F</span>
                                            </div>
                                            <div className="mt-8 bg-red-700 text-white p-6 shadow-2xl rounded-[2rem] ring-4 ring-red-900 transform scale-105 border-4 border-white">
                                                <p className="text-[12px] uppercase font-black tracking-[0.2em] italic mb-2 text-red-100">SOLDE NET CAISSE DU JOUR</p>
                                                <p className="text-4xl font-black tabular-nums underline underline-offset-8 decoration-double tracking-tighter">
                                                    {( (data?.tresorerie?.entrees || 0) - (data?.tresorerie?.sorties || 0) ).toLocaleString()} F
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListPrintWrapper>
                    </div>
                </div>
              </div>
            )}

        </div>
    )
}
