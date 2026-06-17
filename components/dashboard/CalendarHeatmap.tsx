'use client'

const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getIntensity(montant: number, max: number): string {
  if (max === 0 || montant === 0) return 'bg-gray-100'
  const ratio = montant / max
  if (ratio > 0.75) return 'bg-orange-600'
  if (ratio > 0.5) return 'bg-orange-500'
  if (ratio > 0.25) return 'bg-orange-400'
  return 'bg-orange-200'
}

export default function CalendarHeatmap({
  data,
  mois,
  dark,
}: {
  data: Array<{ jour: number; montant: number }>
  mois: string
  dark?: boolean
}) {
  const now = new Date()
  const annee = now.getFullYear()
  const moisIndex = now.getMonth()
  const nbJours = new Date(annee, moisIndex + 1, 0).getDate()
  const premierJour = new Date(annee, moisIndex, 1).getDay()
  const decalage = premierJour === 0 ? 6 : premierJour - 1

  const mapJour = new Map(data.map(d => [d.jour, d.montant]))
  const maxMontant = Math.max(...data.map(d => d.montant), 0)

  const jours: Array<{ empty: boolean; jour?: number; montant?: number }> = []
  for (let i = 0; i < decalage; i++) jours.push({ empty: true })
  for (let j = 1; j <= nbJours; j++) {
    jours.push({ empty: false, jour: j, montant: mapJour.get(j) || 0 })
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">
        {JOURS_SEMAINE.map(j => (
          <div key={j} className="text-center">{j}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {jours.map((j, i) => (
          j.empty ? (
            <div key={`e-${i}`} className="h-7 w-full" />
          ) : (
            <div
              key={j.jour}
              title={`${j.jour} ${mois} ${annee} : ${(j.montant || 0).toLocaleString('fr-FR')} FCFA`}
              className={`h-7 w-full rounded-sm flex items-center justify-center text-[9px] font-bold transition-colors cursor-default ${getIntensity(j.montant || 0, maxMontant)} ${j.montant && j.montant >= maxMontant * 0.75 ? 'text-white' : 'text-gray-700'}`}
              style={{ color: (!j.montant || j.montant < maxMontant * 0.75) && dark ? '#d1d5db' : undefined }}
            >
              {j.jour}
            </div>
          )
        ))}
      </div>
    </div>
  )
}
