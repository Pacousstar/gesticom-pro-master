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
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ComptabiliteNav from '../ComptabiliteNav'
import Pagination from '@/components/ui/Pagination'

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
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    
    // Construire l'URL avec l'année (l'entité est gérée par la session côté serveur)
    const url = `/api/comptabilite/bilan?annee=${annee}`
    const { data, error, isLoading, mutate } = useSWR<BilanData>(url)

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 100 // Affichage plus large pour le bilan comme demandé

    const handlePrint = () => {
        window.print()
    }

    if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Erreur de chargement du bilan</div>

    return (
        <div className="space-y-6 pb-20">
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
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-gray-900 shadow-lg hover:bg-gray-100 transition-all border-2 border-orange-500"
                    >
                        <Printer className="h-4 w-4" />
                        Aperçu Impression
                    </button>
                </div>
            </div>

            <ComptabiliteNav />

            {isLoading ? (
                <div className="flex h-64 items-center justify-center bg-white/5 rounded-3xl backdrop-blur-sm border border-white/10">
                    <RefreshCw className="h-10 w-10 animate-spin text-white/40" />
                </div>
            ) : (
                <>
                    {/* MODALE D'APERÇU IMPRESSION BILAN */}
                    {isPreviewOpen && data && (
                        <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/95 backdrop-blur-sm no-print font-sans">
                            <div className="flex items-center justify-between bg-white px-8 py-4 shadow-2xl">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 uppercase italic leading-none">Aperçu Bilan Annuel</h2>
                                        <p className="mt-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest italic leading-none">
                                            SYSCOHADA - EXERCICE {annee}
                                        </p>
                                    </div>
                                    <div className="h-10 w-px bg-gray-200" />
                                    <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-600 uppercase">
                                        Arrêté au 31/12/{annee}
                                    </span>
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
                                <div className="mx-auto max-w-[210mm] bg-white shadow-2xl min-h-screen p-4">
                                    <ListPrintWrapper
                                        title="BILAN COMPTABLE RÉVISÉ"
                                        subtitle={`ARRÊTÉ AU 31 DÉCEMBRE ${annee} (SYSCOHADA)`}
                                        pageNumber={1}
                                        totalPages={1}
                                        hideHeader={false}
                                        hideVisa={false}
                                    >
                                        <div className="grid grid-cols-2 gap-8 mt-6 border-t-2 border-black pt-8">
                                            {/* COLONNE ACTIF */}
                                            <div className="border-2 border-black rounded-sm overflow-hidden flex flex-col">
                                                <div className="bg-gray-100 p-3 border-b-2 border-black">
                                                    <h3 className="font-black text-[15px] uppercase text-center">ACTIF (EMPLOIS)</h3>
                                                </div>
                                                <div className="flex-1">
                                                    <BilanSectionPrint title="Actif Immobilisé" items={data?.bilan.actif.immobilise || []} />
                                                    <BilanSectionPrint title="Stocks" items={data?.bilan.actif.stocks || []} />
                                                    <BilanSectionPrint title="Créances & Autres" items={data?.bilan.actif.creances || []} />
                                                    <BilanSectionPrint title="Trésorerie Actif" items={data?.bilan.actif.tresorerie || []} />
                                                </div>
                                                <div className="bg-gray-200 p-3 border-t-2 border-black flex justify-between font-black text-[15px] uppercase">
                                                    <span>TOTAL ACTIF</span>
                                                    <span>{formatFcfa(data?.bilan.actif.total || 0)}</span>
                                                </div>
                                            </div>

                                            {/* COLONNE PASSIF */}
                                            <div className="border-2 border-black rounded-sm overflow-hidden flex flex-col">
                                                <div className="bg-gray-100 p-3 border-b-2 border-black">
                                                    <h3 className="font-black text-[15px] uppercase text-center">PASSIF (RESSOURCES)</h3>
                                                </div>
                                                <div className="flex-1">
                                                    <BilanSectionPrint title="Capitaux Propres" items={data?.bilan.passif.capitaux || []} />
                                                    <BilanSectionPrint title="Dettes & Tiers" items={data?.bilan.passif.dettes || []} />
                                                    <BilanSectionPrint title="Trésorerie Passif" items={data?.bilan.passif.tresorerie || []} />
                                                </div>
                                                <div className="bg-gray-200 p-3 border-t-2 border-black flex justify-between font-black text-[15px] uppercase">
                                                    <span>TOTAL PASSIF</span>
                                                    <span>{formatFcfa(data?.bilan.passif.total || 0)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ÉQUILIBRE DU BILAN */}
                                        <div className="mt-8 p-4 bg-gray-50 border-2 border-black rounded-xl flex justify-between items-center font-black text-[15px] italic uppercase tracking-tighter">
                                            <span>ÉQUILIBRE DU BILAN (DIFFÉRENCE ACTIF - PASSIF) :</span>
                                            <span className={Math.round((data?.bilan.actif.total || 0) - (data?.bilan.passif.total || 0)) === 0 ? 'text-emerald-700 underline decoration-double' : 'text-rose-700 underline decoration-dashed'}>
                                                {formatFcfa((data?.bilan.actif.total || 0) - (data?.bilan.passif.total || 0))}
                                            </span>
                                        </div>
                                    </ListPrintWrapper>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rendu masqué pour l'impression système direct */}
                    <div className="hidden print:block absolute inset-0 bg-white">
                        {data && (
                            <ListPrintWrapper
                                title="BILAN COMPTABLE RÉVISÉ"
                                subtitle={`ARRÊTÉ AU 31 DÉCEMBRE ${annee} (SYSCOHADA)`}
                                hideHeader={false}
                                hideVisa={false}
                            >
                                <div className="grid grid-cols-2 gap-8 mt-6 border-t-2 border-black pt-8">
                                    <div className="border-2 border-black overflow-hidden">
                                        <div className="bg-gray-100 p-2 border-b-2 border-black font-black text-[14px] uppercase text-center">ACTIF</div>
                                        <BilanSectionPrint title="Actif Immobilisé" items={data?.bilan.actif.immobilise || []} />
                                        <BilanSectionPrint title="Stocks" items={data?.bilan.actif.stocks || []} />
                                        <BilanSectionPrint title="Créances" items={data?.bilan.actif.creances || []} />
                                        <BilanSectionPrint title="Trésorerie" items={data?.bilan.actif.tresorerie || []} />
                                        <div className="bg-gray-100 p-2 border-t-2 border-black flex justify-between font-black text-[15px]">
                                            <span>TOTAL ACTIF</span>
                                            <span>{formatFcfa(data?.bilan.actif.total || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="border-2 border-black overflow-hidden">
                                        <div className="bg-gray-100 p-2 border-b-2 border-black font-black text-[14px] uppercase text-center">PASSIF</div>
                                        <BilanSectionPrint title="Capitaux Propres" items={data?.bilan.passif.capitaux || []} />
                                        <BilanSectionPrint title="Dettes" items={data?.bilan.passif.dettes || []} />
                                        <BilanSectionPrint title="Trésorerie" items={data?.bilan.passif.tresorerie || []} />
                                        <div className="bg-gray-100 p-2 border-t-2 border-black flex justify-between font-black text-[15px]">
                                            <span>TOTAL PASSIF</span>
                                            <span>{formatFcfa(data?.bilan.passif.total || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 p-4 border-2 border-black flex justify-between items-center font-black text-[15px] uppercase italic">
                                    <span>Différence Actif - Passif :</span>
                                    <span>{formatFcfa((data?.bilan.actif.total || 0) - (data?.bilan.passif.total || 0))}</span>
                                </div>
                            </ListPrintWrapper>
                        )}
                    </div>

                    <div className="grid gap-8 lg:grid-cols-2 no-print">
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

                            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex gap-3">
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

                    {/* Pagination Global (si nécessaire pour de très grands bilans détaillés) */}
                    {data && (
                      <div className="mt-8 no-print">
                         <Pagination 
                            currentPage={currentPage}
                            totalPages={1} // Le bilan est généralement un résumé, mais on garde le composant pour la cohérence visuelle
                            totalItems={1}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                         />
                      </div>
                    )}
                </>
            )}
        </div>
    )
}

function BilanSectionPrint({ title, items }: { title: string, items: BilanItem[] }) {
    const total = items.reduce((acc, it) => acc + it.montant, 0)
    return (
        <div className="p-3 border-b-2 border-black last:border-b-0">
            <h4 className="font-black text-[15px] uppercase mb-2 underline decoration-1 underline-offset-2">{title}</h4>
            <div className="space-y-1">
                {items.length === 0 ? (
                    <div className="italic text-gray-400 text-[10px]">Aucun élément</div>
                ) : (
                    items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-baseline gap-2">
                            <div className="flex gap-2 flex-1 min-w-0">
                                <span className="font-bold text-gray-600 text-[11px] w-8 tabular-nums">{it.numero}</span>
                                <span className="uppercase text-[14px] truncate">{it.libelle}</span>
                            </div>
                            <span className="font-black text-[14px] tabular-nums">{formatFcfa(it.montant)}</span>
                        </div>
                    ))
                )}
            </div>
            {items.length > 0 && (
                <div className="mt-3 text-right border-t-2 border-black pt-1 font-black italic text-[15px] bg-gray-50/50">
                    S/T {title} : {formatFcfa(total)}
                </div>
            )}
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
