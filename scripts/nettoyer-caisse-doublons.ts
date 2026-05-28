import { prisma } from '@/lib/db'

async function main() {
  console.log('=== NETTOYAGE DES DOUBLONS CAISSE ===\n')

  // Trouver les doublons : même motif + montant + magasinId + date
  const all = await prisma.caisse.findMany({
    orderBy: [{ motif: 'asc' }, { montant: 'asc' }, { date: 'asc' }, { id: 'asc' }],
  })

  const seen = new Map<string, number[]>()
  for (const e of all) {
    const key = `${e.motif}|${e.montant}|${e.magasinId}|${e.date.getTime()}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key)!.push(e.id)
  }

  let totalDeleted = 0
  const magasinsToRecalc = new Set<number>()

  for (const [key, ids] of seen) {
    if (ids.length > 1) {
      const [keep, ...toDelete] = ids
      const sample = all.find(e => e.id === keep)!
      console.log(`Doublon trouvé : ${sample.motif} | ${sample.montant} F | ${sample.date.toLocaleDateString('fr-FR')}`)
      console.log(`  → Gardé  : id=${keep}`)
      console.log(`  → Suppr. : ids=${toDelete.join(', ')}`)
      
      await prisma.caisse.deleteMany({ where: { id: { in: toDelete } } })
      totalDeleted += toDelete.length
      magasinsToRecalc.add(sample.magasinId)
    }
  }

  // Recalculer les soldes caisse pour les magasins concernés
  for (const magasinId of magasinsToRecalc) {
    const { recalculerSoldeCaisse } = await import('@/lib/caisse')
    await recalculerSoldeCaisse(magasinId)
    console.log(`  → Solde recalculé pour magasinId=${magasinId}`)
  }

  console.log(`\nTotal : ${totalDeleted} doublons supprimés, ${magasinsToRecalc.size} magasin(s) recalculé(s).`)
}

main()
  .catch(e => {
    console.error('Erreur:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
