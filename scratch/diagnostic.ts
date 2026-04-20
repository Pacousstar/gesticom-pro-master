import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnostic() {
  console.log('--- STARTING SURGICAL DIAGNOSTIC ---')

  // 1. Audit Ventes & Règlements
  const ventes = await prisma.vente.findMany({
    include: { reglements: true }
  })
  
  let venteErrors = 0
  ventes.forEach(v => {
    const totalReglements = v.reglements.reduce((sum, r) => sum + r.montant, 0)
    if (Math.abs(v.montantPaye - totalReglements) > 1) {
      console.error(`[ERROR] Vente ${v.numero}: montantPaye (${v.montantPaye}) != totalReglements (${totalReglements})`)
      venteErrors++
    }
    const expectedStatut = totalReglements >= v.montantTotal ? 'PAYE' : totalReglements > 0 ? 'PARTIEL' : 'CREDIT'
    if (v.statutPaiement !== expectedStatut) {
        console.warn(`[WARN] Vente ${v.numero}: statutPaiement (${v.statutPaiement}) != expected (${expectedStatut})`)
    }
  })

  // 2. Audit Achats & Règlements
  const achats = await prisma.achat.findMany({
    include: { reglements: true }
  })
  let achatErrors = 0
  achats.forEach(a => {
    const totalReglements = a.reglements.reduce((sum, r) => sum + r.montant, 0)
    if (Math.abs((a.montantPaye || 0) - totalReglements) > 1) {
      console.error(`[ERROR] Achat ${a.numero}: montantPaye (${a.montantPaye}) != totalReglements (${totalReglements})`)
      achatErrors++
    }
  })

  // 3. Audit Stocks vs Mouvements
  const items = await prisma.stock.findMany({
    include: {
      produit: { select: { designation: true } },
      magasin: { select: { nom: true } }
    }
  })
  
  let stockErrors = 0
  for (const item of items) {
    const mvts = await prisma.mouvement.findMany({
      where: { produitId: item.produitId, magasinId: item.magasinId }
    })
    const totalMvts = mvts.reduce((sum, m) => {
      return sum + (m.type === 'ENTREE' ? m.quantite : -m.quantite)
    }, item.quantiteInitiale)
    
    if (Math.abs(item.quantite - totalMvts) > 0.01) {
      console.error(`[ERROR] Stock mismatch for ${item.produit.designation} in ${item.magasin.nom}: Stock=${item.quantite}, Computed from Mvts=${totalMvts}`)
      stockErrors++
    }
  }

  // 4. Audit Comptabilité (Balance des écritures)
  const ecrituresByVente = await prisma.ecritureComptable.groupBy({
    by: ['referenceId', 'referenceType'],
    _sum: { debit: true, credit: true },
    where: { referenceType: { in: ['VENTE', 'ACHAT', 'VENTE_REGLEMENT', 'ACHAT_REGLEMENT'] } }
  })
  
  let accountingErrors = 0
  // Note: VENTE entries alone don't balance (Debit Client / Credit Sale + TVA). 
  // We should check global balance per Journal/Date or per Reference if they are expected to balance.
  // Actually, a VENTE write usually balances: Debit Client (TTC) = Credit Vente (HT) + Credit TVA.
  
  const balancingGroups = await prisma.ecritureComptable.groupBy({
    by: ['referenceId', 'referenceType'],
    _sum: { debit: true, credit: true }
  })
  
  balancingGroups.forEach(g => {
      if (Math.abs((g._sum.debit || 0) - (g._sum.credit || 0)) > 1) {
          console.error(`[ERROR] Accounting imbalance for ${g.referenceType} #${g.referenceId}: Debit=${g._sum.debit}, Credit=${g._sum.credit}`)
          accountingErrors++
      }
  })

  console.log('--- DIAGNOSTIC SUMMARY ---')
  console.log(`Vente Errors: ${venteErrors}`)
  console.log(`Achat Errors: ${achatErrors}`)
  console.log(`Stock Errors: ${stockErrors}`)
  console.log(`Accounting Errors: ${accountingErrors}`)
  
  await prisma.$disconnect()
}

diagnostic().catch(e => {
  console.error(e)
  process.exit(1)
})
