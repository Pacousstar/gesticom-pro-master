'use client'

import { useState, useEffect } from 'react'
import { Loader2, CalendarClock } from 'lucide-react'
import Link from 'next/link'
import useSWR from 'swr'

type Prediction = {
    produitId: number
    code: string
    designation: string
    stockTotal: number
    velociteJour: number
    joursRestants: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SuggestionsAchat() {
    const { data: predictions, error, isLoading } = useSWR<Prediction[]>('/api/predictions/rupture', fetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 10000,
    })

    if (isLoading) {
        return (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl bg-white p-6 shadow-lg border border-indigo-100">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-xl bg-white p-6 shadow-lg border border-red-100 text-red-500 min-h-[300px]">
                Erreur de chargement des prédictions.
            </div>
        )
    }

    const p = Array.isArray(predictions) ? (predictions as Prediction[]) : []

    return (
        <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-lg border border-indigo-100">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-xl font-bold text-gray-900">Prédictions (IA)</h2>
                </div>
                {p.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {p.length} alerte(s)
                    </span>
                )}
            </div>

            <p className="mb-4 text-xs text-gray-500">Estimations basées sur la vitesse de vente des 30 derniers jours.</p>

            <div className="flex-1 space-y-3 overflow-y-auto">
                {p.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Aucune rupture anticipée (14j).</p>
                ) : (
                    p.slice(0, 5).map((item: Prediction, i: number) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-indigo-50 bg-indigo-50/30 p-3">
                            <div className="min-w-0 flex-1 pr-4">
                                <p className="truncate text-sm font-semibold text-gray-900" title={item.designation}>
                                    {item.designation}
                                </p>
                                <div className="mt-1 flex gap-3 text-[11px]">
                                    <span className="text-gray-500">Stock: <strong className="text-gray-800">{item.stockTotal}</strong></span>
                                    <span className="text-gray-500">Ventes/j: <strong className="text-gray-800">{item.velociteJour.toFixed(1)}</strong></span>
                                </div>
                            </div>
                            <div className="whitespace-nowrap text-right">
                                {item.joursRestants === 0 ? (
                                    <span className="inline-flex items-center rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                                        Rupture 🔴
                                    </span>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm font-bold text-indigo-600">{item.joursRestants} j</span>
                                        <span className="text-[10px] uppercase text-gray-500">Restants</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            <Link
                href="/dashboard/produits"
                className="mt-4 block w-full rounded-lg bg-indigo-50 py-2.5 text-center text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
                Anticiper les achats
            </Link>
        </div>
    )
}
