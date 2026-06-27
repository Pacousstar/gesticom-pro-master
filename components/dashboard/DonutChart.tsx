'use client'

import { useState } from 'react'

const COULEURS = [
  '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#84cc16',
]

export default function DonutChart({
  data,
  total,
  dark,
}: {
  data: Array<{ categorie: string; montant: number }>
  total: number
  dark?: boolean
}) {
  const [page, setPage] = useState(0)
  const perPage = 15
  const totalPages = Math.max(1, Math.ceil(data.length / perPage))
  const pageData = data.slice(page * perPage, (page + 1) * perPage)

  if (!data.length || !total) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-xs font-bold uppercase tracking-wider">
        Aucune donnée
      </div>
    )
  }

  const segments: Array<{ percent: number; color: string; offset: number }> = []
  let cumul = 0
  data.forEach((d, i) => {
    const percent = (d.montant / total) * 100
    segments.push({
      percent,
      color: COULEURS[i % COULEURS.length],
      offset: cumul,
    })
    cumul += percent
  })

  const radius = 60
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {segments.map((seg, i) => {
          const dashLength = (seg.percent / 100) * circumference
          return (
            <circle
              key={i}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-seg.offset / 100 * circumference}
              transform="rotate(-90 70 70)"
              className="transition-all duration-700"
            />
          )
        })}
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="text-lg font-black" fill={dark ? '#f3f4f6' : '#424242'}>
          {total.toLocaleString('fr-FR')}
        </text>
        <text x="70" y="86" textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-bold uppercase" fill={dark ? '#9e9e9e' : '#bdbdbd'}>
          FCFA
        </text>
      </svg>

      <div className="flex flex-col items-center w-full max-w-[200px]">
        <div className="space-y-1.5 w-full">
          {pageData.map((d, i) => {
            const idx = page * perPage + i
            const pct = Math.round((d.montant / total) * 100)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COULEURS[idx % COULEURS.length] }} />
                <span className="font-bold truncate" style={{ color: dark ? '#d1d5db' : '#616161' }}>{d.categorie}</span>
                <span className="ml-auto font-black" style={{ color: dark ? '#f3f4f6' : '#212121' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                page === 0
                  ? 'opacity-30 cursor-not-allowed'
                  : dark
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              ←
            </button>
            <span className={`text-[10px] font-bold ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                page >= totalPages - 1
                  ? 'opacity-30 cursor-not-allowed'
                  : dark
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
