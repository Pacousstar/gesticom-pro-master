'use client'

import Link from 'next/link'
import { ShoppingCart, ShoppingBag, Clock } from 'lucide-react'

type ActivityItem = {
    id: string
    type: 'vente' | 'achat'
    label: string // client ou fournisseur
    montant: number
    time: string // ISO date string
}

interface RecentActivityProps {
    items: ActivityItem[]
    loading?: boolean
    maxItems?: number
}

function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 60000
    if (diff < 1) return 'À l\'instant'
    if (diff < 60) return `Il y a ${Math.floor(diff)} min`
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)} h`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMontant(montant: number): string {
    return montant.toLocaleString('fr-FR') + ' F'
}

export default function RecentActivity({
    items = [],
    loading = false,
    maxItems = 5,
}: RecentActivityProps) {
    const displayed = (Array.isArray(items) ? items : []).slice(0, maxItems)

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="h-9 w-9 rounded-full bg-gray-200 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                            <div className="h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                        <div className="h-3.5 w-16 rounded bg-gray-200" />
                    </div>
                ))}
            </div>
        )
    }

    if (displayed.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Clock className="h-8 w-8 mb-2" />
                <p className="text-sm">Aucune activité récente</p>
            </div>
        )
    }

    return (
        <div className="divide-y divide-gray-100">
            {displayed.map((item) => {
                const isVente = item.type === 'vente'
                const Icon = isVente ? ShoppingCart : ShoppingBag
                const iconBg = isVente ? 'bg-emerald-100' : 'bg-blue-100'
                const iconColor = isVente ? 'text-emerald-600' : 'text-blue-600'
                const href = isVente ? '/dashboard/ventes' : '/dashboard/achats'

                return (
                    <Link
                        key={`${item.type}-${item.id}`}
                        href={href}
                        className="flex items-center gap-3 py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors group"
                    >
                        <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}
                        >
                            <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                                {item.label}
                            </p>
                            <p className="text-xs text-gray-400">
                                {item.id} · {formatTime(item.time)}
                            </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p
                                className={`text-sm font-semibold ${isVente ? 'text-emerald-600' : 'text-blue-600'
                                    }`}
                            >
                                {item.montant > 0 ? formatMontant(item.montant) : '—'}
                            </p>
                            <p className="text-xs text-gray-400">
                                {isVente ? 'Vente' : 'Achat'}
                            </p>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
