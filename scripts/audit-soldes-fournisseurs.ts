import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== AUDIT DES SOLDES FOURNISSEURS ===')
  console.log()

  const fournisseurs = await prisma.fournisseur.findMany({
    orderBy: { nom: 'asc' },
    select: { id: true, code: true, nom: true, soldeInitial: true, avoirInitial: true, numeroCamion: true },
  })

  for (const f of fournisseurs) {
    const achatsAgg = await prisma.achat.aggregate({
      where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montantTotal: true, fraisApproche: true },
    })
    const totalAchats = (achatsAgg._sum.montantTotal || 0) + (achatsAgg._sum.fraisApproche || 0)

    const paiementsAgg = await prisma.reglementAchat.aggregate({
      where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })
    const totalPaiements = paiementsAgg._sum.montant || 0

    const reglementsLibres = await prisma.reglementAchat.aggregate({
      where: { fournisseurId: f.id, achatId: null, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })
    const totalLibres = reglementsLibres._sum.montant || 0

    const reglementsCredit = await prisma.reglementAchat.aggregate({
      where: { fournisseurId: f.id, modePaiement: 'CREDIT', statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })
    const totalCredit = reglementsCredit._sum.montant || 0

    const achatsAvecLignes = await prisma.achat.findMany({
      where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true },
    })
    let totalPayeViaLignes = 0
    for (const a of achatsAvecLignes) {
      const lignesAgg = await prisma.reglementAchatLigne.aggregate({
        where: { achatId: a.id },
        _sum: { montant: true },
      })
      totalPayeViaLignes += lignesAgg._sum.montant || 0
    }

    const nbAchats = await prisma.achat.count({ where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } } })
    const nbPaiements = await prisma.reglementAchat.count({ where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } } })

    const netAchats = totalAchats - totalPaiements
    const soldeCalcule = netAchats + (f.soldeInitial || 0) - (f.avoirInitial || 0)

    const flag = soldeCalcule !== 0 ? ' ⚠️' : ''
    console.log(`[${f.code || '?'}] ${f.nom}${flag}`)
    console.log(`   Achats: ${totalAchats.toLocaleString('fr-FR')} F (${nbAchats} achats)`)
    console.log(`   Paiements: ${totalPaiements.toLocaleString('fr-FR')} F (${nbPaiements} reglements)`)
    if (totalLibres > 0) console.log(`   → dont libres: ${totalLibres.toLocaleString('fr-FR')} F`)
    if (totalCredit > 0) console.log(`   ⛔ CREDIT encore présents: ${totalCredit.toLocaleString('fr-FR')} F`)
    const diffLignes = Math.abs(totalPaiements - totalPayeViaLignes)
    if (diffLignes > 1) console.log(`   ⚠️ Écart Paiements vs Lignes: ${diffLignes.toLocaleString('fr-FR')} F`)
    console.log(`   SoldeInitial: ${(f.soldeInitial || 0).toLocaleString('fr-FR')} F`)
    console.log(`   AvoirInitial: ${(f.avoirInitial || 0).toLocaleString('fr-FR')} F`)
    console.log(`   Solde calculé: ${soldeCalcule.toLocaleString('fr-FR')} F`)
    console.log()
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
