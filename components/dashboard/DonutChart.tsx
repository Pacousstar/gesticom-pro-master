'use client'

const COULEURS = [
  '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899',
  '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#84cc16',
]

export default function DonutChart({
  data,
  total,
}: {
  data: Array<{ categorie: string; montant: number }>
  total: number
}) {
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
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" className="text-lg font-black fill-gray-800">
          {total.toLocaleString('fr-FR')}
        </text>
        <text x="70" y="86" textAnchor="middle" dominantBaseline="middle" className="text-[8px] fill-gray-400 font-bold uppercase">
          FCFA
        </text>
      </svg>

      <div className="space-y-1.5 w-full max-w-[180px]">
        {data.map((d, i) => {
          const pct = Math.round((d.montant / total) * 100)
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: COULEURS[i % COULEURS.length] }} />
              <span className="font-bold text-gray-700 truncate">{d.categorie}</span>
              <span className="ml-auto font-black text-gray-900">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
