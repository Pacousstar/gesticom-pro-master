'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Trend = 'up' | 'down' | 'neutral'

interface KpiCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    color: string // Tailwind gradient class ex: 'from-orange-500 to-orange-600'
    trend?: Trend
    trendValue?: number // pourcentage
    trendLabel?: string // ex: "vs hier"
    subtitle?: string
    loading?: boolean
}

function formatValue(value: string | number): string {
    if (typeof value === 'number') {
        return value.toLocaleString('fr-FR')
    }
    return value
}

export default function KpiCard({
    title,
    value,
    icon: Icon,
    color,
    trend,
    trendValue,
    trendLabel = 'vs hier',
    subtitle,
    loading = false,
}: KpiCardProps) {
    const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus
    const trendColor =
        trend === 'up'
            ? 'text-green-200'
            : trend === 'down'
                ? 'text-red-200'
                : 'text-white/60'

    return (
        <div
            className={`overflow-hidden rounded-xl bg-gradient-to-br ${color} p-6 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-default`}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/90 truncate">{title}</p>
                    {loading ? (
                        <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-white/20" />
                    ) : (
                        <p className="mt-2 text-3xl font-bold text-white leading-none">
                            {formatValue(value)}
                        </p>
                    )}
                    {subtitle && !loading && (
                        <p className="mt-1 text-xs text-white/70 truncate">{subtitle}</p>
                    )}
                    {trendValue !== undefined && !loading && (
                        <div className="mt-2 flex items-center gap-1">
                            <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                            <span className={`text-xs font-medium ${trendColor}`}>
                                {Math.abs(trendValue)}%
                            </span>
                            <span className="text-xs text-white/60">{trendLabel}</span>
                        </div>
                    )}
                </div>
                <div className="ml-4 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
                    <Icon className="h-7 w-7 text-white" />
                </div>
            </div>
        </div>
    )
}
