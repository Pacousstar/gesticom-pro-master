import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function nettoyerReglementsCreditVentes() {
  const creditReglements = await prisma.reglementVente.findMany({
    where: { modePaiement: 'CREDIT', venteId: { not: null } },
    select: { id: true, venteId: true, montant: true },
  })

  console.log(`  ${creditReglements.length} ReglementVente CREDIT trouvé(s)`)

  for (const r of creditReglements) {
    if (!r.venteId) continue
    console.log(`    ReglementVente #${r.id} (${r.montant} F) -> Vente #${r.venteId}`)
    await prisma.reglementVenteLigne.deleteMany({ where: { reglementId: r.id } })
    await prisma.reglementVente.delete({ where: { id: r.id } })
  }

  const ventesIds = [...new Set(creditReglements.map(r => r.venteId).filter(Boolean) as number[])]
  let recalculées = 0

  for (const vId of ventesIds) {
    const totalLignes = await prisma.reglementVenteLigne.aggregate({
      where: { venteId: vId },
      _sum: { montant: true },
    })
    const montantPayeReel = totalLignes._sum.montant || 0
    const vente = await prisma.vente.findUnique({ where: { id: vId }, select: { id: true, numero: true, montantTotal: true, montantPaye: true, statutPaiement: true } })
    if (!vente) continue
    const nouveauStatut = montantPayeReel >= vente.montantTotal ? 'PAYE' : montantPayeReel > 0 ? 'PARTIEL' : 'CREDIT'
    console.log(`    Vente ${vente.numero || vente.id}: montantPaye ${vente.montantPaye} -> ${montantPayeReel}, statut ${vente.statutPaiement} -> ${nouveauStatut}`)
    await prisma.vente.update({
      where: { id: vId },
      data: { montantPaye: montantPayeReel, statutPaiement: nouveauStatut },
    })
    recalculées++
  }

  return { supprimés: creditReglements.length, recalculées }
}

async function nettoyerReglementsCreditAchats() {
  const creditReglements = await prisma.reglementAchat.findMany({
    where: { modePaiement: 'CREDIT', achatId: { not: null } },
    select: { id: true, achatId: true, montant: true },
  })

  console.log(`  ${creditReglements.length} ReglementAchat CREDIT trouvé(s)`)

  for (const r of creditReglements) {
    if (!r.achatId) continue
    console.log(`    ReglementAchat #${r.id} (${r.montant} F) -> Achat #${r.achatId}`)
    await prisma.reglementAchatLigne.deleteMany({ where: { reglementId: r.id } })
    await prisma.reglementAchat.delete({ where: { id: r.id } })
  }

  const achatsIds = [...new Set(creditReglements.map(r => r.achatId).filter(Boolean) as number[])]
  let recalculés = 0

  for (const aId of achatsIds) {
    const totalLignes = await prisma.reglementAchatLigne.aggregate({
      where: { achatId: aId },
      _sum: { montant: true },
    })
    const montantPayeReel = totalLignes._sum.montant || 0
    const achat = await prisma.achat.findUnique({ where: { id: aId }, select: { id: true, numero: true, montantTotal: true, montantPaye: true, statutPaiement: true } })
    if (!achat) continue
    const nouveauStatut = montantPayeReel >= achat.montantTotal ? 'PAYE' : montantPayeReel > 0 ? 'PARTIEL' : 'CREDIT'
    console.log(`    Achat ${achat.numero || achat.id}: montantPaye ${achat.montantPaye} -> ${montantPayeReel}, statut ${achat.statutPaiement} -> ${nouveauStatut}`)
    await prisma.achat.update({
      where: { id: aId },
      data: { montantPaye: montantPayeReel, statutPaiement: nouveauStatut },
    })
    recalculés++
  }

  return { supprimés: creditReglements.length, recalculés }
}

async function main() {
  console.log('=== Nettoyage des règlements CREDIT erronés ===')
  console.log()

  console.log('1/2 - Suppression des ReglementVente CREDIT...')
  const ventes = await nettoyerReglementsCreditVentes()
  console.log(`   ${ventes.supprimés} règlement(s) supprimé(s), ${ventes.recalculées} vente(s) recalculée(s)`)
  console.log()

  console.log('2/2 - Suppression des ReglementAchat CREDIT...')
  const achats = await nettoyerReglementsCreditAchats()
  console.log(`   ${achats.supprimés} règlement(s) supprimé(s), ${achats.recalculés} achat(s) recalculé(s)`)
  console.log()

  console.log('=== Terminé ===')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
