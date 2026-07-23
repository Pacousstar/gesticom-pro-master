'use client'

import { useState, useEffect } from 'react'
import {
    Printer,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Info,
    BookOpen,
    ChevronDown,
    ChevronUp,
    Calculator,
    BarChart3,
    FileSpreadsheet,
    FileText
} from 'lucide-react'
import ListPrintWrapper from '@/components/print/ListPrintWrapper'
import ComptabiliteNav from '../ComptabiliteNav'
import Pagination from '@/components/ui/Pagination'

type BilanItem = {
    numero: string
    libelle: string
    montant: number
    isResultat?: boolean
}

type MergedItem = BilanItem & {
    montantPrecedent: number
    evolution?: 'up' | 'down' | 'stable'
}

type BilanSectionData = {
    immobilise: BilanItem[]
    stocks: BilanItem[]
    creances: BilanItem[]
    tresorerie: BilanItem[]
    total: number
}

type BilanPassifSectionData = {
    capitaux: BilanItem[]
    dettes: BilanItem[]
    tresorerie: BilanItem[]
    total: number
}

type BilanData = {
    annee: number
    entiteId?: number
    debug?: { totalEcritures: number; debutAnnee: string; finAnnee: string }
    bilan: { actif: BilanSectionData; passif: BilanPassifSectionData }
    bilanPrecedent: { actif: BilanSectionData; passif: BilanPassifSectionData }
    ratios: {
        frng: number; bfr: number; tn: number
        frngLabel: string; bfrLabel: string; tnLabel: string
    }
    entreprise?: {
        nom: string; slogan?: string; contact?: string; localisation?: string
        codeEntite?: string; logo?: string; numNCC?: string
    }
}

function formatFcfa(n: number) {
    return Math.round(n).toLocaleString('fr-FR') + ' F'
}

function mergeItems(itemsN: BilanItem[], itemsN1: BilanItem[]): MergedItem[] {
    const mapN1 = new Map(itemsN1.map(i => [i.numero, i]))
    const seen = new Set<string>()
    const merged: MergedItem[] = itemsN.map(i => {
        seen.add(i.numero)
        const prev = mapN1.get(i.numero)
        const prevMontant = prev?.montant || 0
        return {
            ...i,
            montantPrecedent: prevMontant,
            evolution: i.montant > prevMontant ? 'up' : i.montant < prevMontant ? 'down' : 'stable'
        }
    })
    itemsN1.forEach(i => {
        if (!seen.has(i.numero)) {
            merged.push({ ...i, montant: 0, montantPrecedent: i.montant, evolution: 'down' })
        }
    })
    merged.sort((a, b) => a.numero.localeCompare(b.numero))
    return merged
}

function mergeSection(itemsN: BilanItem[], itemsN1: BilanItem[]): { merged: MergedItem[]; total: number; totalPrecedent: number } {
    const merged = mergeItems(itemsN, itemsN1)
    const total = merged.reduce((s, i) => s + i.montant, 0)
    const totalPrecedent = merged.reduce((s, i) => s + i.montantPrecedent, 0)
    return { merged, total, totalPrecedent }
}

export default function BilanPage() {
    const [annee, setAnnee] = useState(new Date().getFullYear())
    const [dateDebut, setDateDebut] = useState('')
    const [dateFin, setDateFin] = useState('')
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [guideOpen, setGuideOpen] = useState(false)
    const [data, setData] = useState<BilanData | undefined>(undefined)
    const [error, setError] = useState<any>(undefined)
    const [isLoading, setIsLoading] = useState(true)

    const hasDateFilter = dateDebut !== '' && dateFin !== ''
    const url = hasDateFilter
        ? `/api/comptabilite/bilan?annee=${annee}&dateDebut=${dateDebut}&dateFin=${dateFin}`
        : `/api/comptabilite/bilan?annee=${annee}`

    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setError(undefined)
        fetch(url)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
            .then(json => { if (!cancelled) { setData(json); setIsLoading(false) } })
            .catch(e => { if (!cancelled) { setError(e); setIsLoading(false) } })
        return () => { cancelled = true }
    }, [url])

    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 100

    const handlePrint = () => window.print()

    if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Erreur de chargement du bilan</div>

    const actifImm = mergeSection(data?.bilan.actif?.immobilise || [], data?.bilanPrecedent?.actif?.immobilise || [])
    const actifStk = mergeSection(data?.bilan.actif?.stocks || [], data?.bilanPrecedent?.actif?.stocks || [])
    const actifCre = mergeSection(data?.bilan.actif?.creances || [], data?.bilanPrecedent?.actif?.creances || [])
    const actifTre = mergeSection(data?.bilan.actif?.tresorerie || [], data?.bilanPrecedent?.actif?.tresorerie || [])

    const passifCap = mergeSection(data?.bilan.passif?.capitaux || [], data?.bilanPrecedent?.passif?.capitaux || [])
    const passifDet = mergeSection(data?.bilan.passif?.dettes || [], data?.bilanPrecedent?.passif?.dettes || [])
    const passifTre = mergeSection(data?.bilan.passif?.tresorerie || [], data?.bilanPrecedent?.passif?.tresorerie || [])

    const totalActifN = data?.bilan?.actif?.total || 0
    const totalActifN1 = data?.bilanPrecedent?.actif?.total || 0
    const totalPassifN = data?.bilan?.passif?.total || 0
    const totalPassifN1 = data?.bilanPrecedent?.passif?.total || 0

    const r = data?.ratios

    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    function BilanSection({ title, section, color, isLast = false }: {
        title: string
        section: { merged: MergedItem[]; total: number; totalPrecedent: number }
        color: 'emerald' | 'blue'
        isLast?: boolean
    }) {
        const { merged, total, totalPrecedent } = section
        if (merged.length === 0) return null

        const tc = color === 'emerald' ? 'text-emerald-700' : 'text-blue-700'

        return (
            <div className={`p-6 ${!isLast ? 'border-b border-gray-50' : ''}`}>
                <h3 className={`text-sm font-black uppercase tracking-wider mb-4 ${tc}`}>{title}</h3>
                <div className="space-y-2.5">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">
                        <span>Compte</span>
                        <span className="text-right">N ({annee})</span>
                        <span className="text-right">N-1 ({annee - 1})</span>
                    </div>
                    {merged.map((it, idx) => (
                        <div key={idx} className={`grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm items-center ${it.isResultat ? 'bg-orange-50 -mx-3 px-3 py-2 rounded-xl border border-orange-100' : ''}`}>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded tabular-nums shrink-0">{it.numero}</span>
                                <span className={`truncate ${it.isResultat ? 'font-black text-orange-800' : 'font-medium text-gray-700'}`}>{it.libelle}</span>
                                {it.evolution === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />}
                                {it.evolution === 'down' && <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />}
                            </div>
                            <span className={`font-bold tabular-nums text-right ${it.isResultat ? 'text-orange-600 text-base' : 'text-gray-900'}`}>{formatFcfa(it.montant)}</span>
                            <span className="font-medium tabular-nums text-right text-gray-400 text-xs">{formatFcfa(it.montantPrecedent)}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center italic">
                    <span className="text-[11px] font-bold text-gray-400 uppercase">S/T {title}</span>
                    <span className="text-sm font-black text-gray-600 text-right">{formatFcfa(total)}</span>
                    <span className="text-xs font-medium text-gray-400 text-right">{formatFcfa(totalPrecedent)}</span>
                </div>
            </div>
        )
    }

    function BilanSectionPrint({ title, section }: { title: string; section: { merged: MergedItem[]; total: number; totalPrecedent: number } }) {
        const { merged, total, totalPrecedent } = section
        return (
            <div className="p-2 border-b border-black last:border-b-0">
                <h4 className="font-black text-[12px] uppercase mb-1 underline underline-offset-2">{title}</h4>
                {merged.length === 0 ? (
                    <div className="italic text-gray-400 text-[9px]">Aucun mouvement</div>
                ) : (
                    <div className="space-y-0.5">
                        {merged.map((it, idx) => (
                            <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-baseline text-[10px]">
                                <div className="flex gap-1 min-w-0">
                                    <span className="font-bold text-gray-500 w-6 tabular-nums shrink-0">{it.numero}</span>
                                    <span className="truncate">{it.libelle}</span>
                                </div>
                                <span className="font-bold tabular-nums text-right">{formatFcfa(it.montant)}</span>
                                <span className="text-gray-500 tabular-nums text-right">{formatFcfa(it.montantPrecedent)}</span>
                            </div>
                        ))}
                    </div>
                )}
                {merged.length > 0 && (
                    <div className="mt-2 text-right border-t border-black pt-1 font-black italic text-[11px] bg-gray-50/50 grid grid-cols-[1fr_auto_auto] gap-x-2">
                        <span className="text-left">S/T {title}</span>
                        <span>{formatFcfa(total)}</span>
                        <span className="text-gray-600">{formatFcfa(totalPrecedent)}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Bilan Comptable</h1>
                    <p className="text-white/80 font-medium">États financiers annuels (SYSCOHADA) — {hasDateFilter ? `Période du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}` : `Exercice ${annee}`}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateDebut}
                            onChange={(e) => setDateDebut(e.target.value)}
                            className="rounded-xl border-none bg-white/10 backdrop-blur-md text-white font-bold px-3 py-2.5 outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
                            title="Date de début"
                        />
                        <span className="text-white/60 font-bold">-</span>
                        <input
                            type="date"
                            value={dateFin}
                            onChange={(e) => setDateFin(e.target.value)}
                            className="rounded-xl border-none bg-white/10 backdrop-blur-md text-white font-bold px-3 py-2.5 outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert"
                            title="Date de fin"
                        />
                        {hasDateFilter && (
                            <button
                                onClick={() => { setDateDebut(''); setDateFin('') }}
                                className="rounded-xl bg-white/10 backdrop-blur-md text-white/70 hover:text-white px-2.5 py-2.5 text-sm font-bold hover:bg-white/20 transition-all"
                                title="Effacer le filtre de dates"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <select
                        value={annee}
                        onChange={(e) => setAnnee(parseInt(e.target.value))}
                        disabled={hasDateFilter}
                        className={`rounded-xl border-none bg-white/10 backdrop-blur-md text-white font-bold px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/20 ${hasDateFilter ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                    <button
                        onClick={async () => {
                            try {
                                const p = new URLSearchParams({ annee: String(annee) })
                                if (dateDebut) p.set('dateDebut', dateDebut)
                                if (dateFin) p.set('dateFin', dateFin)
                                const res = await fetch('/api/comptabilite/bilan/export-excel?' + p.toString())
                                if (!res.ok) { alert("Erreur d'export Excel"); return }
                                const blob = await res.blob()
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `bilan_${annee}.xlsx`
                                document.body.appendChild(a); a.click()
                                URL.revokeObjectURL(url); document.body.removeChild(a)
                            } catch { alert("Erreur d'export Excel") }
                        }}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-700 transition-all"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const p = new URLSearchParams({ annee: String(annee) })
                                if (dateDebut) p.set('dateDebut', dateDebut)
                                if (dateFin) p.set('dateFin', dateFin)
                                const res = await fetch('/api/comptabilite/bilan/export-pdf?' + p.toString())
                                if (!res.ok) { alert("Erreur d'export PDF"); return }
                                const blob = await res.blob()
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `bilan_${annee}.pdf`
                                document.body.appendChild(a); a.click()
                                URL.revokeObjectURL(url); document.body.removeChild(a)
                            } catch { alert("Erreur d'export PDF") }
                        }}
                        className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-rose-700 transition-all"
                    >
                        <FileText className="h-4 w-4" />
                        PDF
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
                    {/* MODALE D'APERÇU IMPRESSION */}
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
                                        {hasDateFilter ? `Du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}` : `Arrêté au 31/12/${annee}`}
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

                            <div className="flex-1 overflow-auto p-8 bg-gray-100/30">
                                <div className="mx-auto max-w-[210mm] bg-white shadow-2xl p-3">
                                    <ListPrintWrapper
                                        title="BILAN COMPTABLE"
                                        subtitle={hasDateFilter ? `DU ${new Date(dateDebut).toLocaleDateString('fr-FR').toUpperCase()} AU ${new Date(dateFin).toLocaleDateString('fr-FR').toUpperCase()} (SYSCOHADA)` : `ARRÊTÉ AU 31 DÉCEMBRE ${annee} (SYSCOHADA)`}
                                        pageNumber={1}
                                        totalPages={1}
                                        hideHeader={false}
                                        hideVisa={false}
                                    >
                                        <div className="text-[10px] text-gray-500 text-right mb-2 italic">
                                            {hasDateFilter ? `Période du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')} (comparé à N-1)` : `Exercice ${annee} (comparé à N-1)`}
                                        </div>
                                        <div className="grid grid-cols-2 gap-6 mt-4 border-t-2 border-black pt-6">
                                            {/* COLONNE ACTIF */}
                                            <div className="border-2 border-black overflow-hidden flex flex-col">
                                                <div className="bg-gray-100 p-2 border-b-2 border-black">
                                                    <h3 className="font-black text-[13px] uppercase text-center">ACTIF (EMPLOIS)</h3>
                                                </div>
                                                <div className="flex-1">
                                                    <BilanSectionPrint title="Actif Immobilisé" section={actifImm} />
                                                    <BilanSectionPrint title="Stocks" section={actifStk} />
                                                    <BilanSectionPrint title="Créances & Autres" section={actifCre} />
                                                    <BilanSectionPrint title="Trésorerie Actif" section={actifTre} />
                                                </div>
                                                <div className="bg-gray-200 p-2 border-t-2 border-black grid grid-cols-[1fr_auto_auto] gap-x-2 font-black text-[13px] uppercase">
                                                    <span>TOTAL ACTIF</span>
                                                    <span className="text-right">{formatFcfa(totalActifN)}</span>
                                                    <span className="text-right text-gray-600">{formatFcfa(totalActifN1)}</span>
                                                </div>
                                            </div>

                                            {/* COLONNE PASSIF */}
                                            <div className="border-2 border-black overflow-hidden flex flex-col">
                                                <div className="bg-gray-100 p-2 border-b-2 border-black">
                                                    <h3 className="font-black text-[13px] uppercase text-center">PASSIF (RESSOURCES)</h3>
                                                </div>
                                                <div className="flex-1">
                                                    <BilanSectionPrint title="Capitaux Propres" section={passifCap} />
                                                    <BilanSectionPrint title="Dettes & Tiers" section={passifDet} />
                                                    <BilanSectionPrint title="Trésorerie Passif" section={passifTre} />
                                                </div>
                                                <div className="bg-gray-200 p-2 border-t-2 border-black grid grid-cols-[1fr_auto_auto] gap-x-2 font-black text-[13px] uppercase">
                                                    <span>TOTAL PASSIF</span>
                                                    <span className="text-right">{formatFcfa(totalPassifN)}</span>
                                                    <span className="text-right text-gray-600">{formatFcfa(totalPassifN1)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ÉQUILIBRE */}
                                        <div className="mt-6 p-3 bg-gray-50 border-2 border-black flex justify-between items-center font-black text-[13px] italic uppercase">
                                            <span>ÉQUILIBRE ACTIF - PASSIF :</span>
                                            <span className={totalActifN === totalPassifN ? 'text-emerald-700 underline decoration-double' : 'text-rose-700 underline decoration-dashed'}>
                                                {formatFcfa(totalActifN - totalPassifN)}
                                            </span>
                                        </div>

                                        {/* RATIOS */}
                                        {r && (
                                            <div className="mt-4 p-3 border-2 border-black">
                                                <h4 className="font-black text-[12px] uppercase mb-2">Ratios Financiers</h4>
                                                <div className="grid grid-cols-3 gap-4 text-[11px]">
                                                    <div>
                                                        <span className="font-bold">FRNG :</span> {formatFcfa(r.frng)}
                                                        <div className="text-gray-500 text-[9px]">{r.frngLabel.split('(')[0]}</div>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold">BFR :</span> {formatFcfa(r.bfr)}
                                                        <div className="text-gray-500 text-[9px]">{r.bfrLabel.split('(')[0]}</div>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold">TN :</span> {formatFcfa(r.tn)}
                                                        <div className="text-gray-500 text-[9px]">{r.tnLabel.split('(')[0]}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* SIGNATURES */}
                                        <div className="mt-6 pt-4 border-t-2 border-black grid grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase mb-8">Cachet & Signature<br/>du Chef d'Entreprise</p>
                                                <div className="border-b border-black mt-12" />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase">Date d'Édition</p>
                                                <p className="text-[12px] font-black mt-1">{today}</p>
                                            </div>
                                        </div>

                                        {/* FOOTER */}
                                        <div className="mt-4 pt-2 border-t border-gray-300 text-[8px] text-gray-500 flex justify-between">
                                            <span>Document généré par GestiCom Pro — {hasDateFilter ? `Période du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}` : `Arrêté au 31/12/${annee}`}</span>
                                            <span>Émis le {today}</span>
                                        </div>
                                    </ListPrintWrapper>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RENDU MASQUÉ POUR IMPRESSION SYSTÈME */}
                    <div className="hidden print:block absolute inset-0 bg-white">
                        {data && (
                            <ListPrintWrapper
                                title="BILAN COMPTABLE"
                                subtitle={hasDateFilter ? `DU ${new Date(dateDebut).toLocaleDateString('fr-FR').toUpperCase()} AU ${new Date(dateFin).toLocaleDateString('fr-FR').toUpperCase()} (SYSCOHADA)` : `ARRÊTÉ AU 31 DÉCEMBRE ${annee} (SYSCOHADA)`}
                                hideHeader={false}
                                hideVisa={false}
                            >
                                <div className="text-[9px] text-gray-500 text-right mb-1 italic">{hasDateFilter ? `Période du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')} (comparé à N-1)` : `Exercice ${annee} (comparé à N-1)`}</div>
                                <div className="grid grid-cols-2 gap-4 mt-4 border-t-2 border-black pt-4">
                                    <div className="border-2 border-black overflow-hidden">
                                        <div className="bg-gray-100 p-1 border-b-2 border-black font-black text-[12px] uppercase text-center">ACTIF</div>
                                        <BilanSectionPrint title="Actif Immobilisé" section={actifImm} />
                                        <BilanSectionPrint title="Stocks" section={actifStk} />
                                        <BilanSectionPrint title="Créances" section={actifCre} />
                                        <BilanSectionPrint title="Trésorerie" section={actifTre} />
                                        <div className="bg-gray-100 p-1 border-t-2 border-black grid grid-cols-[1fr_auto_auto] gap-x-2 font-black text-[12px] uppercase">
                                            <span>TOTAL</span>
                                            <span className="text-right">{formatFcfa(totalActifN)}</span>
                                            <span className="text-right text-gray-600">{formatFcfa(totalActifN1)}</span>
                                        </div>
                                    </div>
                                    <div className="border-2 border-black overflow-hidden">
                                        <div className="bg-gray-100 p-1 border-b-2 border-black font-black text-[12px] uppercase text-center">PASSIF</div>
                                        <BilanSectionPrint title="Capitaux Propres" section={passifCap} />
                                        <BilanSectionPrint title="Dettes" section={passifDet} />
                                        <BilanSectionPrint title="Trésorerie" section={passifTre} />
                                        <div className="bg-gray-100 p-1 border-t-2 border-black grid grid-cols-[1fr_auto_auto] gap-x-2 font-black text-[12px] uppercase">
                                            <span>TOTAL</span>
                                            <span className="text-right">{formatFcfa(totalPassifN)}</span>
                                            <span className="text-right text-gray-600">{formatFcfa(totalPassifN1)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 p-2 border-2 border-black flex justify-between items-center font-black text-[12px] uppercase italic">
                                    <span>Différence Actif - Passif :</span>
                                    <span>{formatFcfa(totalActifN - totalPassifN)}</span>
                                </div>
                                {r && (
                                    <div className="mt-3 p-2 border-2 border-black">
                                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                                            <div><span className="font-bold">FRNG :</span> {formatFcfa(r.frng)}</div>
                                            <div><span className="font-bold">BFR :</span> {formatFcfa(r.bfr)}</div>
                                            <div><span className="font-bold">TN :</span> {formatFcfa(r.tn)}</div>
                                        </div>
                                    </div>
                                )}
                            </ListPrintWrapper>
                        )}
                    </div>

                    {/* VUE ÉCRAN : DEUX COLONNES AVEC N-1 */}
                    <div className="no-print space-y-8">
                        {/* LIGNE 1 : CARTES ACTIF / PASSIF (MÊME HAUTEUR) */}
                        <div className="grid gap-8 lg:grid-cols-2 items-stretch">
                            {/* COLONNE ACTIF */}
                            <div className="flex flex-col h-full">
                                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex-1 flex flex-col">
                                    <div className="bg-emerald-600 px-6 py-4 shrink-0">
                                        <h2 className="text-xl font-black text-white flex justify-between items-center uppercase">
                                            <span>Actif</span>
                                            <span className="text-sm font-medium normal-case opacity-80">(Emplois)</span>
                                        </h2>
                                    </div>
                                    <div className="p-0 flex-1">
                                        {actifImm.merged.length > 0 && <BilanSection title="Actif Immobilisé" section={actifImm} color="emerald" />}
                                        {actifStk.merged.length > 0 && <BilanSection title="Stocks" section={actifStk} color="emerald" />}
                                        {actifCre.merged.length > 0 && <BilanSection title="Créances & Autres" section={actifCre} color="emerald" />}
                                        {actifTre.merged.length > 0 && <BilanSection title="Trésorerie Actif" section={actifTre} color="emerald" />}
                                        {actifImm.merged.length === 0 && actifStk.merged.length === 0 && actifCre.merged.length === 0 && actifTre.merged.length === 0 && (
                                            <div className="p-8 text-center text-gray-400 italic">Aucun mouvement — Actif</div>
                                        )}
                                    </div>
                                    <div className="bg-emerald-50 px-6 py-5 border-t border-emerald-100 shrink-0">
                                        <div className="flex justify-between items-center text-sm text-emerald-600 mb-1">
                                            <span className="font-medium">N-1 ({annee - 1})</span>
                                            <span className="font-bold">{formatFcfa(totalActifN1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-black text-emerald-900 uppercase">Total Général Actif N</span>
                                            <span className="text-xl font-black text-emerald-700">{formatFcfa(totalActifN)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLONNE PASSIF */}
                            <div className="flex flex-col h-full">
                                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex-1 flex flex-col">
                                    <div className="bg-blue-700 px-6 py-4 shrink-0">
                                        <h2 className="text-xl font-black text-white flex justify-between items-center uppercase">
                                            <span>Passif</span>
                                            <span className="text-sm font-medium normal-case opacity-80">(Ressources)</span>
                                        </h2>
                                    </div>
                                    <div className="p-0 flex-1">
                                        {passifCap.merged.length > 0 && <BilanSection title="Capitaux Propres" section={passifCap} color="blue" />}
                                        {passifDet.merged.length > 0 && <BilanSection title="Dettes & Tiers" section={passifDet} color="blue" />}
                                        {passifTre.merged.length > 0 && <BilanSection title="Trésorerie Passif" section={passifTre} color="blue" />}
                                        {passifCap.merged.length === 0 && passifDet.merged.length === 0 && passifTre.merged.length === 0 && (
                                            <div className="p-8 text-center text-gray-400 italic">Aucun mouvement — Passif</div>
                                        )}
                                    </div>
                                    <div className="bg-blue-50 px-6 py-5 border-t border-blue-100 shrink-0">
                                        <div className="flex justify-between items-center text-sm text-blue-600 mb-1">
                                            <span className="font-medium">N-1 ({annee - 1})</span>
                                            <span className="font-bold">{formatFcfa(totalPassifN1)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-black text-blue-900 uppercase">Total Général Passif N</span>
                                            <span className="text-xl font-black text-blue-700">{formatFcfa(totalPassifN)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LIGNE 2 : INFOS COMPLÉMENTAIRES */}
                        <div className="grid gap-8 lg:grid-cols-2 items-start">
                            {/* GAUCHE : INFO BILAN + STRUCTURE DE L'ACTIF */}
                            <div className="space-y-6">
                                <div className="rounded-2xl p-6 border flex items-center justify-between bg-white border-gray-200">
                                    <div className="flex gap-3 items-center">
                                        <Info className="h-5 w-5 text-blue-500 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-gray-900">Comprendre le Bilan</h3>
                                            <p className="text-sm text-gray-600">Le Bilan est un "instantané" de la situation de l'entreprise à la date de clôture. Il présente ce que l'entreprise possède (Actif) et ce qu'elle doit (Passif). Les montants N-1 sont indiqués pour comparaison.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                                    <div className="bg-emerald-700 px-6 py-4">
                                        <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase">
                                            <BarChart3 className="h-5 w-5" />
                                            Structure de l'Actif
                                        </h3>
                                    </div>
                                    <div className="p-6 space-y-5">
                                        {(() => {
                                            const total = totalActifN
                                            const sections = [
                                                { label: 'Actif Immobilisé', valeur: actifImm.total, color: 'bg-indigo-500' },
                                                { label: 'Stocks', valeur: actifStk.total, color: 'bg-amber-500' },
                                                { label: 'Créances & Autres', valeur: actifCre.total, color: 'bg-cyan-500' },
                                                { label: 'Trésorerie Actif', valeur: actifTre.total, color: 'bg-emerald-500' },
                                            ]
                                            return sections.map(s => {
                                                const pct = total > 0 ? (s.valeur / total) * 100 : 0
                                                return (
                                                    <div key={s.label}>
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <span className="text-sm font-semibold text-gray-700">{s.label}</span>
                                                            <span className="text-sm font-bold text-gray-900">{pct.toFixed(1)}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className={`${s.color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">{formatFcfa(s.valeur)}</div>
                                                    </div>
                                                )
                                            })
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* DROITE : ÉQUILIBRE + RATIOS */}
                            <div className="space-y-6">
                                {/* ÉQUILIBRE */}
                                <div className={`rounded-2xl p-6 border flex items-center justify-between ${totalActifN === totalPassifN ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`} style={{ minHeight: '113px' }}>
                                    <div>
                                        <h3 className="font-bold text-gray-900">Équilibre du Bilan</h3>
                                        <p className="text-sm text-gray-600">Différence Actif / Passif</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`text-xl font-black ${totalActifN === totalPassifN ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {formatFcfa(totalActifN - totalPassifN)}
                                        </span>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Conformité SYSCOHADA</p>
                                    </div>
                                </div>

                                {/* RATIOS */}
                                {r && (
                                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden" style={{ minHeight: '65px' }}>
                                        <div className="bg-gray-900 px-6 py-4">
                                            <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase">
                                                <TrendingUp className="h-5 w-5" />
                                                Ratios Financiers
                                            </h3>
                                        </div>
                                        <div className="p-6 space-y-5">
                                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                                <div>
                                                    <span className="font-black text-gray-900 text-lg">FRNG</span>
                                                    <p className="text-xs text-gray-500 mt-0.5">Fonds de Roulement Net Global</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xl font-black ${r.frng >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatFcfa(r.frng)}
                                                    </span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{r.frngLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                                                <div>
                                                    <span className="font-black text-gray-900 text-lg">BFR</span>
                                                    <p className="text-xs text-gray-500 mt-0.5">Besoin en Fonds de Roulement</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xl font-black ${r.bfr >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {formatFcfa(r.bfr)}
                                                    </span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{r.bfrLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-black text-gray-900 text-lg">TN</span>
                                                    <p className="text-xs text-gray-500 mt-0.5">Trésorerie Nette</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xl font-black ${r.tn >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatFcfa(r.tn)}
                                                    </span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">{r.tnLabel}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-gray-100 italic text-xs text-gray-400">
                                                <p>FRNG - BFR = TN : {formatFcfa(r.frng)} - {formatFcfa(r.bfr)} = {formatFcfa(r.tn)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* GUIDE PÉDAGOGIQUE */}
                    <div className="no-print">
                        <button
                            onClick={() => setGuideOpen(!guideOpen)}
                            className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md px-6 py-4 text-white font-bold hover:bg-white/20 transition-all w-full border border-white/10"
                        >
                            <BookOpen className="h-5 w-5 text-orange-400" />
                            <span className="flex-1 text-left">Guide Pédagogique — Comprendre le Bilan et les Ratios</span>
                            {guideOpen ? <ChevronUp className="h-5 w-5 text-white/60" /> : <ChevronDown className="h-5 w-5 text-white/60" />}
                        </button>

                        {guideOpen && (
                            <div className="mt-4 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                                <div className="p-8 space-y-8 text-gray-700 text-sm leading-relaxed">
                                    {/* 1. QU'EST-CE QU'UN BILAN ? */}
                                    <section>
                                        <h3 className="text-lg font-black text-gray-900 uppercase mb-3 flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-orange-500" />
                                            1. Qu'est-ce qu'un Bilan Comptable ?
                                        </h3>
                                        <p className="mb-2">Le <strong>bilan</strong> est un document financier qui présente la situation patrimoniale de l'entreprise à une date donnée (généralement le 31 décembre). Il répond à une question simple :</p>
                                        <div className="grid grid-cols-2 gap-6 my-4">
                                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                                <h4 className="font-black text-emerald-800 uppercase text-sm mb-1">Actif (Emplois)</h4>
                                                <p className="text-xs text-emerald-700">Ce que l'entreprise <strong>possède</strong> : ses biens, ses créances, sa trésorerie.</p>
                                            </div>
                                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                                <h4 className="font-black text-blue-800 uppercase text-sm mb-1">Passif (Ressources)</h4>
                                                <p className="text-xs text-blue-700">Ce que l'entreprise <strong>doit</strong> : ses dettes, ses capitaux propres.</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 italic">Principe fondamental : <strong>Total Actif = Total Passif</strong> (équilibre parfait).</p>
                                    </section>

                                    {/* 2. STRUCTURE SYSCOHADA */}
                                    <section>
                                        <h3 className="text-lg font-black text-gray-900 uppercase mb-3 flex items-center gap-2">
                                            <Calculator className="h-5 w-5 text-orange-500" />
                                            2. Structure du Bilan (SYSCOHADA)
                                        </h3>
                                        <p className="mb-3">Le bilan suit le plan comptable SYSCOHADA. Les comptes sont classés par leur <strong>numéro</strong> (1ère chiffre) :</p>
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <span className="font-black text-emerald-700">ACTIF</span>
                                                <ul className="mt-1 space-y-1 text-gray-600">
                                                    <li><strong>Classe 2</strong> — Immobilisations (actif durable)</li>
                                                    <li><strong>Classe 3</strong> — Stocks (marchandises)</li>
                                                    <li><strong>Classe 4</strong> — Créances (solde ≥ 0)</li>
                                                    <li><strong>Classe 5</strong> — Trésorerie (banque, caisse)</li>
                                                </ul>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <span className="font-black text-blue-700">PASSIF</span>
                                                <ul className="mt-1 space-y-1 text-gray-600">
                                                    <li><strong>Classe 1</strong> — Capitaux propres (apport, résultat)</li>
                                                    <li><strong>Classe 4</strong> — Dettes (solde &lt; 0)</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 3. COMMENT LE BILAN EST CALCULÉ */}
                                    <section>
                                        <h3 className="text-lg font-black text-gray-900 uppercase mb-3">3. Calcul des Soldes</h3>
                                        <p className="mb-3">Chaque compte est calculé ainsi :</p>
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 font-mono text-sm">
                                            <p><strong>Solde d'un compte</strong> = Total des Débits - Total des Crédits</p>
                                            <p className="text-gray-500 mt-1 text-xs">Si le solde est positif → le compte est au Débit (actif). S'il est négatif → au Crédit (passif).</p>
                                        </div>
                                        <p className="mt-3 text-xs text-gray-500">Exemple : un client vous doit 61 320 F → compte <strong>411 Clients</strong> avec solde positif → classé en Actif (créances).</p>
                                    </section>

                                    {/* 4. RÉSULTAT NET */}
                                    <section>
                                        <h3 className="text-lg font-black text-gray-900 uppercase mb-3">4. Résultat Net (Bénéfice / Perte)</h3>
                                        <p className="mb-3">Le résultat net est la différence entre les <strong>produits</strong> (classe 7) et les <strong>charges</strong> (classe 6) de l'exercice :</p>
                                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 font-mono text-sm">
                                            <p><strong>Résultat Net</strong> = Total Produits - Total Charges</p>
                                        </div>
                                        <ul className="mt-3 space-y-1 text-xs">
                                            <li className="flex items-center gap-2"><TrendingUp className="h-3 w-3 text-emerald-500" /> Si positif : <strong>BÉNÉFICE</strong> → ajouté aux Capitaux Propres</li>
                                            <li className="flex items-center gap-2"><TrendingDown className="h-3 w-3 text-red-500" /> Si négatif : <strong>PERTE</strong> → déduit des Capitaux Propres</li>
                                        </ul>
                                        {data && (
                                            <div className="mt-3 p-3 bg-orange-100/50 rounded-lg border border-orange-200 text-xs">
                                                <span className="font-bold">Dans votre bilan {annee} : </span>
                                                {(() => {
                                                    const cp = data.bilan.passif.capitaux.find(i => i.isResultat)
                                                    return cp
                                                        ? <>Résultat Net = <strong className="text-orange-700">{formatFcfa(cp.montant)}</strong> ({cp.libelle})</>
                                                        : <>Pas de résultat net cette année.</>
                                                })()}
                                            </div>
                                        )}
                                    </section>

                                    {/* 5. RATIOS FINANCIERS */}
                                    <section>
                                        <h3 className="text-lg font-black text-gray-900 uppercase mb-3 flex items-center gap-2">
                                            <TrendingUp className="h-5 w-5 text-orange-500" />
                                            5. Ratios Financiers — FRNG, BFR, TN
                                        </h3>
                                        <p className="mb-4">Les ratios financiers permettent d'analyser la <strong>santé financière</strong> de l'entreprise. Les trois ratios essentiels sont :</p>

                                        {/* FRNG */}
                                        <div className="bg-white rounded-xl border-2 border-emerald-200 p-4 mb-4">
                                            <h4 className="font-black text-emerald-800 text-base uppercase mb-2">🔹 FRNG — Fonds de Roulement Net Global</h4>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
                                                <span className="font-bold text-gray-700">Formule :</span>
                                                <span className="font-mono bg-emerald-50 px-2 py-0.5 rounded text-emerald-800">Capitaux Propres - Actif Immobilisé</span>
                                                <span className="font-bold text-gray-700">Ce qu'il mesure :</span>
                                                <span>Les ressources durables (capitaux propres) disponibles après financement des investissements.</span>
                                                <span className="font-bold text-gray-700">Interprétation :</span>
                                                <span className={r && r.frng >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                                    {r && r.frng >= 0 ? '✓ Positif : l\'entreprise dispose de ressources stables suffisantes' : '✗ Négatif : déséquilibre financier, attention !'}
                                                </span>
                                            </div>
                                            {r && (
                                                <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs">
                                                    <span className="font-bold">Dans votre bilan : </span>
                                                    FRNG = {formatFcfa(r.frng)}
                                                    <span className="text-gray-500"> → {r.frngLabel}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* BFR */}
                                        <div className="bg-white rounded-xl border-2 border-amber-200 p-4 mb-4">
                                            <h4 className="font-black text-amber-800 text-base uppercase mb-2">🔹 BFR — Besoin en Fonds de Roulement</h4>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
                                                <span className="font-bold text-gray-700">Formule :</span>
                                                <span className="font-mono bg-amber-50 px-2 py-0.5 rounded text-amber-800">(Stocks + Créances) - Dettes</span>
                                                <span className="font-bold text-gray-700">Ce qu'il mesure :</span>
                                                <span>Le décalage entre les encaissements (clients) et les décaissements (fournisseurs, stocks).</span>
                                                <span className="font-bold text-gray-700">Interprétation :</span>
                                                <span className={r && r.bfr >= 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                                                    {r && r.bfr >= 0 ? '⚠ Positif : besoin de financement du cycle d\'exploitation' : '✓ Négatif : excédent de ressources (idéal)'}
                                                </span>
                                            </div>
                                            {r && (
                                                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs">
                                                    <span className="font-bold">Dans votre bilan : </span>
                                                    BFR = {formatFcfa(r.bfr)}
                                                    <span className="text-gray-500"> → {r.bfrLabel}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* TN */}
                                        <div className="bg-white rounded-xl border-2 border-cyan-200 p-4">
                                            <h4 className="font-black text-cyan-800 text-base uppercase mb-2">🔹 TN — Trésorerie Nette</h4>
                                            <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
                                                <span className="font-bold text-gray-700">Formule :</span>
                                                <span className="font-mono bg-cyan-50 px-2 py-0.5 rounded text-cyan-800">FRNG - BFR</span>
                                                <span className="font-bold text-gray-700">Ou :</span>
                                                <span className="font-mono bg-cyan-50 px-2 py-0.5 rounded text-cyan-800">Trésorerie Actif - Trésorerie Passif</span>
                                                <span className="font-bold text-gray-700">Ce qu'il mesure :</span>
                                                <span>La trésorerie disponible après couverture du BFR par le FRNG.</span>
                                                <span className="font-bold text-gray-700">Interprétation :</span>
                                                <span className={r && r.tn >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                                    {r && r.tn >= 0 ? '✓ Positif : trésorerie positive, bonne santé financière' : '✗ Négatif : découvert bancaire, alerte !'}
                                                </span>
                                            </div>
                                            {r && (
                                                <div className="mt-3 p-3 bg-cyan-50 rounded-lg border border-cyan-100 text-xs">
                                                    <span className="font-bold">Dans votre bilan : </span>
                                                    TN = {formatFcfa(r.frng)} - {formatFcfa(r.bfr)} = <strong className="text-cyan-700">{formatFcfa(r.tn)}</strong>
                                                    <span className="text-gray-500"> → {r.tnLabel}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* RELATION */}
                                        <div className="mt-4 p-4 bg-gray-900 rounded-xl text-white">
                                            <h4 className="font-black uppercase text-sm mb-2">Relation Fondamentale</h4>
                                            <p className="text-lg font-mono font-black text-orange-400">
                                                FRNG - BFR = TN
                                            </p>
                                            {r && (
                                                <p className="text-sm text-gray-300 mt-2">
                                                    {formatFcfa(r.frng)} - {formatFcfa(r.bfr)} = {formatFcfa(r.tn)}
                                                    <span className="text-gray-500 ml-2">(vérification : {r.frng - r.bfr === r.tn ? '✅ OK' : '⚠ incohérence'})</span>
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-2">
                                                Si TN ≥ 0 : entreprise en bonne santé (<span className="text-emerald-400">verte</span>).
                                                Si TN &lt; 0 : entreprise en découvert (<span className="text-red-400">alerte</span>).
                                            </p>
                                        </div>
                                    </section>

                                    {/* 6. EXEMPLE RÉCAPITULATIF */}
                                    {data && (
                                        <section>
                                            <h3 className="text-lg font-black text-gray-900 uppercase mb-3">6. Exemple : Votre Bilan {annee}</h3>
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs space-y-2">
                                                <p><strong>Actif total :</strong> {formatFcfa(totalActifN)}</p>
                                                <p className="pl-4 text-gray-500">→ dont Immobilisations : {formatFcfa(actifImm.total)} | Stocks : {formatFcfa(actifStk.total)} | Créances : {formatFcfa(actifCre.total)} | Trésorerie : {formatFcfa(actifTre.total)}</p>
                                                <p><strong>Passif total :</strong> {formatFcfa(totalPassifN)}</p>
                                                <p className="pl-4 text-gray-500">→ dont Capitaux Propres : {formatFcfa(passifCap.total)} | Dettes : {formatFcfa(passifDet.total)}</p>
                                                <div className="border-t border-gray-200 pt-2 mt-2">
                                                    <p className={totalActifN === totalPassifN ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                                                        Équilibre : {formatFcfa(totalActifN)} = {formatFcfa(totalPassifN)} {totalActifN === totalPassifN ? '✅' : '⚠'}
                                                    </p>
                                                </div>
                                                {r && (
                                                    <div className="border-t border-gray-200 pt-2 mt-2">
                                                        <p className="font-bold">Ratios :</p>
                                                        <p className="pl-4">FRNG = {formatFcfa(r.frng)}</p>
                                                        <p className="pl-4">BFR = {formatFcfa(r.bfr)}</p>
                                                        <p className="pl-4">TN = {formatFcfa(r.tn)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    )}

                                    {/* CONCLUSION */}
                                    <section className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
                                        <p className="text-xs text-gray-600 italic">
                                            💡 <strong>Conseil :</strong> Un bilan équilibré et une trésorerie positive sont les signes d'une entreprise en bonne santé financière.
                                            Surveillez régulièrement vos ratios FRNG, BFR et TN pour anticiper les besoins de financement.
                                        </p>
                                    </section>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PAGINATION */}
                    {data && (
                        <div className="mt-8 no-print">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={1}
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
