import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== AUDIT DES SOLDES CLIENTS ===')
  console.log()

  const clients = await prisma.client.findMany({
    orderBy: { nom: 'asc' },
    select: { id: true, code: true, nom: true, soldeInitial: true, avoirInitial: true, type: true, plafondCredit: true },
  })

  for (const c of clients) {
    const ventesAgg = await prisma.vente.aggregate({
      where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montantTotal: true },
    })
    const totalVentes = ventesAgg._sum.montantTotal || 0

    const paiementsAgg = await prisma.reglementVente.aggregate({
      where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE', 'VALIDE'] } },
      _sum: { montant: true },
    })
    const totalPaiements = paiementsAgg._sum.montant || 0

    // Vérifier aussi les reglements libres (sans venteId)
    const reglementsLibres = await prisma.reglementVente.aggregate({
      where: { clientId: c.id, venteId: null, statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })
    const totalLibres = reglementsLibres._sum.montant || 0

    // Vérifier les reglements CREDIT qui pourraient encore exister
    const reglementsCredit = await prisma.reglementVente.aggregate({
      where: { clientId: c.id, modePaiement: 'CREDIT', statut: { in: ['VALIDE', 'VALIDEE'] } },
      _sum: { montant: true },
    })
    const totalCredit = reglementsCredit._sum.montant || 0

    // Vérifier montantPaye via ReglementVenteLigne (source de vérité)
    const ventesAvecLignes = await prisma.vente.findMany({
      where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true },
    })
    let totalPayeViaLignes = 0
    for (const v of ventesAvecLignes) {
      const lignesAgg = await prisma.reglementVenteLigne.aggregate({
        where: { venteId: v.id },
        _sum: { montant: true },
      })
      totalPayeViaLignes += lignesAgg._sum.montant || 0
    }

    const netVentes = totalVentes - totalPaiements
    const soldeCalcule = netVentes + (c.soldeInitial || 0) - (c.avoirInitial || 0)

    // Vérifier le nombre de ventes et paiements
    const nbVentes = await prisma.vente.count({ where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } } })
    const nbPaiements = await prisma.reglementVente.count({ where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } } })

    const flag = soldeCalcule !== 0 ? ' ⚠️' : ''
    const flagType = c.type === 'CASH' && soldeCalcule > 0 ? ' 🔴 CASH avec dette!' : ''

    console.log(`[${c.code || '?'}] ${c.nom}${flag}${flagType}`)
    console.log(`   Ventes: ${totalVentes.toLocaleString('fr-FR')} F (${nbVentes} factures)`)
    console.log(`   Paiements: ${totalPaiements.toLocaleString('fr-FR')} F (${nbPaiements} reglements)`)
    if (totalLibres > 0) console.log(`   → dont libres: ${totalLibres.toLocaleString('fr-FR')} F`)
    if (totalCredit > 0) console.log(`   ⛔ CREDIT encore présents: ${totalCredit.toLocaleString('fr-FR')} F`)
    const diffLignes = Math.abs(totalPaiements - totalPayeViaLignes)
    if (diffLignes > 1) console.log(`   ⚠️ Écart Paiements vs Lignes: ${diffLignes.toLocaleString('fr-FR')} F`)
    console.log(`   SoldeInitial: ${(c.soldeInitial || 0).toLocaleString('fr-FR')} F`)
    console.log(`   AvoirInitial: ${(c.avoirInitial || 0).toLocaleString('fr-FR')} F`)
    console.log(`   Solde calculé: ${soldeCalcule.toLocaleString('fr-FR')} F`)
    if (c.type === 'CREDIT') console.log(`   Plafond: ${(c.plafondCredit || 0).toLocaleString('fr-FR')} F`)
    console.log()
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
