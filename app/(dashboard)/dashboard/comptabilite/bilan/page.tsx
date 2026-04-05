'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import {
    FileText,
    Download,
    Printer,
    ArrowLeft,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Info,
    Calendar,
    MapPin,
    Building,
    Phone
} from 'lucide-react'
import Link from 'next/link'
import ComptabiliteNav from '../ComptabiliteNav'

type BilanItem = {
    numero: string
    libelle: string
    montant: number
    isResultat?: boolean
}

type BilanData = {
    annee: number
    bilan: {
        actif: {
            immobilise: BilanItem[]
            stocks: BilanItem[]
            creances: BilanItem[]
            tresorerie: BilanItem[]
            total: number
        }
        passif: {
            capitaux: BilanItem[]
            dettes: BilanItem[]
            tresorerie: BilanItem[]
            total: number
        }
    }
    entreprise?: {
        nom: string
        slogan?: string
        contact?: string
        localisation?: string
        piedDePage?: string
        codeEntite?: string
        logo?: string
        numNCC?: string
    }
}

function formatFcfa(n: number) {
    return Math.round(n).toLocaleString('fr-FR') + ' F'
}

export default function BilanPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear())
    const { data, error, isLoading, mutate } = useSWR<BilanData>(`/api/comptabilite/bilan?annee=${annee}`)

    const handlePrint = () => {
        window.print()
    }

    if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Erreur de chargement du bilan</div>

    return (
        <div className="space-y-6 pb-20">
            {/* EN-TÊTE PROFESSIONNEL (VISIBLE À L'IMPRESSION) */}
            <div className="hidden print:block mb-10 border-b-2 border-gray-900 pb-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-4">
                        <div className="bg-gray-900 text-white px-6 py-3 rounded-lg font-black text-2xl uppercase tracking-widest inline-block">
                            BILAN COMPTABLE
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-gray-800 uppercase">
                                Exercice clos au 31 décembre {annee}
                            </p>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-500 uppercase">
                                <span>Référentiel : SYSCOHADA RÉVISÉ</span>
                                <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                                <span>Edité le : {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-right border-l-2 border-gray-100 pl-8 min-w-[300px]">
                        {data?.entreprise?.logo && (
                            <img src={data.entreprise.logo} alt="Logo" className="h-16 w-auto ml-auto mb-4 object-contain" />
                        )}
                        <h2 className="text-xl font-black uppercase text-gray-900 leading-tight">{data?.entreprise?.nom}</h2>
                        <div className="mt-3 flex flex-col items-end gap-1 text-[11px] font-bold text-gray-700">
                            {data?.entreprise?.numNCC && (
                                <div className="flex items-center gap-2 bg-gray-50 px-2 py-0.5 rounded">
                                    <span className="text-gray-400">NCC :</span>
                                    <span className="text-gray-900 tracking-wider">{data?.entreprise?.numNCC}</span>
                                </div>
                            )}
                            {data?.entreprise?.contact && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-gray-400" />
                                    <span>{data?.entreprise?.contact}</span>
                                </div>
                            )}
                            {data?.entreprise?.localisation && (
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-gray-400" />
                                    <span>{data?.entreprise?.localisation}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Bilan Comptable</h1>
                    <p className="text-white/80 font-medium">États financiers annuels (SYSCOHADA) — Exercice {annee}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={annee}
                        onChange={(e) => setAnnee(parseInt(e.target.value))}
                        className="rounded-xl border-none bg-white/10 backdrop-blur-md text-white font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20"
                    >
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y} className="text-gray-900">{y}</option>)}
                    </select>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 shadow-lg hover:bg-gray-100 transition-all"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimer
                    </button>
                </div>
            </div>

            <ComptabiliteNav />

            {isLoading ? (
                <div className="flex h-64 items-center justify-center bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10">
                    <RefreshCw className="h-10 w-10 animate-spin text-white/40" />
                </div>
            ) : (
                <div className="grid gap-8 lg:grid-cols-2 print:grid-cols-2">
                    {/* COLONNE ACTIF */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="bg-emerald-600 px-6 py-4">
                                <h2 className="text-xl font-black text-white flex justify-between items-center uppercase">
                                    <span>Actif</span>
                                    <span className="text-sm font-medium normal-case opacity-80">(Emplois)</span>
                                </h2>
                            </div>

                            <div className="p-0">
                                <BilanSection title="Actif Immobilisé" items={data?.bilan.actif.immobilise || []} color="emerald" />
                                <BilanSection title="Stocks" items={data?.bilan.actif.stocks || []} color="emerald" />
                                <BilanSection title="Créances & Autres" items={data?.bilan.actif.creances || []} color="emerald" />
                                <BilanSection title="Trésorerie Actif" items={data?.bilan.actif.tresorerie || []} color="emerald" isLast />
                            </div>

                            <div className="bg-emerald-50 px-6 py-5 flex justify-between items-center border-t border-emerald-100">
                                <span className="text-lg font-black text-emerald-900 uppercase">Total Général Actif</span>
                                <span className="text-xl font-black text-emerald-700">{formatFcfa(data?.bilan.actif.total || 0)}</span>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex gap-3 no-print">
                            <Info className="h-5 w-5 text-blue-500 shrink-0" />
                            <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                Le Bilan est un "instantané" de la situation de l'entreprise à la date de clôture.
                                Il présente ce que l'entreprise possède (Actif) et ce qu'elle doit (Passif).
                            </p>
                        </div>
                    </div>

                    {/* COLONNE PASSIF */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="bg-blue-700 px-6 py-4">
                                <h2 className="text-xl font-black text-white flex justify-between items-center uppercase">
                                    <span>Passif</span>
                                    <span className="text-sm font-medium normal-case opacity-80">(Ressources)</span>
                                </h2>
                            </div>

                            <div className="p-0">
                                <BilanSection title="Capitaux Propres" items={data?.bilan.passif.capitaux || []} color="blue" />
                                <BilanSection title="Dettes & Tiers" items={data?.bilan.passif.dettes || []} color="blue" />
                                <BilanSection title="Trésorerie Passif" items={data?.bilan.passif.tresorerie || []} color="blue" isLast />
                            </div>

                            <div className="bg-blue-50 px-6 py-5 flex justify-between items-center border-t border-blue-100">
                                <span className="text-lg font-black text-blue-900 uppercase">Total Général Passif</span>
                                <span className="text-xl font-black text-blue-700">{formatFcfa(data?.bilan.passif.total || 0)}</span>
                            </div>
                        </div>

                        {/* Note sur l'équilibre */}
                        <div className={`rounded-2xl p-6 border flex items-center justify-between transition-all ${Math.round(data?.bilan.actif.total || 0) === Math.round(data?.bilan.passif.total || 0) ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <div>
                                <h3 className="font-bold text-gray-900">Équilibre du Bilan</h3>
                                <p className="text-sm text-gray-600">Différence Actif / Passif</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black ${(data?.bilan.actif.total || 0) === (data?.bilan.passif.total || 0) ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatFcfa((data?.bilan.actif.total || 0) - (data?.bilan.passif.total || 0))}
                                </span>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Conformité SYSCOHADA</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PIED DE PAGE LÉGAL (VISIBLE À L'IMPRESSION) */}
            <div className="hidden print:block mt-20 pt-8 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-8 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <div>Signature Gérant</div>
                    <div>Cachet Entreprise</div>
                    <div>Visa Expert/CGA</div>
                </div>
                {data?.entreprise?.piedDePage && (
                    <div className="mt-12 text-center text-[9px] text-gray-400 border-t border-dotted border-gray-200 pt-4 px-10">
                        {data.entreprise.piedDePage}
                    </div>
                )}
            </div>
        </div>
    )
}

function BilanSection({ title, items, color, isLast = false }: { title: string, items: BilanItem[], color: 'emerald' | 'blue', isLast?: boolean }) {
    const total = items.reduce((s, i) => s + i.montant, 0)

    return (
        <div className={`p-6 ${!isLast ? 'border-b border-gray-50' : ''}`}>
            <h3 className={`text-sm font-black uppercase tracking-wider mb-4 ${color === 'emerald' ? 'text-emerald-700' : 'text-blue-700'}`}>
                {title}
            </h3>
            <div className="space-y-2.5">
                {items.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun mouvement</p>
                ) : (
                    items.map((it, idx) => (
                        <div key={idx} className={`flex justify-between text-sm items-center ${it.isResultat ? 'bg-orange-50 -mx-3 px-3 py-2 rounded-xl border border-orange-100' : ''}`}>
                            <div className="flex items-center gap-2 max-w-[70%]">
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded tabular-nums">{it.numero}</span>
                                <span className={`truncate ${it.isResultat ? 'font-black text-orange-800' : 'font-medium text-gray-700'}`}>{it.libelle}</span>
                            </div>
                            <span className={`font-bold tabular-nums ${it.isResultat ? 'text-orange-600 text-base' : 'text-gray-900'}`}>{formatFcfa(it.montant)}</span>
                        </div>
                    ))
                )}
            </div>
            {items.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center italic">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">Sous-total {title}</span>
                    <span className="text-sm font-black text-gray-600">{formatFcfa(total)}</span>
                </div>
            )}
        </div>
    )
}
