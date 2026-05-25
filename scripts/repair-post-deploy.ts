/**
 * Script de réparation Post-Déploiement
 * Réaligne soldeCaisse, stocks et soldes bancaires après les corrections C1-C8.
 * 
 * Usage: npx tsx scripts/repair-post-deploy.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function repairCaisseIntegrity() {
  const magasins = await prisma.magasin.findMany()
  let repaired = 0

  for (const m of magasins) {
    const entrees = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'ENTREE' },
      _sum: { montant: true },
    }))._sum.montant || 0

    const sorties = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'SORTIE' },
      _sum: { montant: true },
    }))._sum.montant || 0

    const soldeReel = entrees - sorties

    if (Math.abs((m.soldeCaisse || 0) - soldeReel) > 0.01) {
      console.log(`  Caisse Magasin "${m.nom}" (ID:${m.id}): ${m.soldeCaisse} -> ${soldeReel}`)
      await prisma.magasin.update({
        where: { id: m.id },
        data: { soldeCaisse: soldeReel },
      })
      repaired++
    }
  }
  return repaired
}

async function repairStockIntegrity() {
  const stocks = await prisma.stock.findMany()
  let repaired = 0

  for (const st of stocks) {
    const entrees = await prisma.mouvement.aggregate({
      where: { produitId: st.produitId, magasinId: st.magasinId, type: 'ENTREE' },
      _sum: { quantite: true },
    })
    const sorties = await prisma.mouvement.aggregate({
      where: { produitId: st.produitId, magasinId: st.magasinId, type: 'SORTIE' },
      _sum: { quantite: true },
    })

    const calculReel = (entrees._sum.quantite || 0) - (sorties._sum.quantite || 0)

    if (Math.abs(st.quantite - calculReel) > 0.001) {
      console.log(`  Stock Produit:${st.produitId} Magasin:${st.magasinId}: ${st.quantite} -> ${calculReel}`)
      await prisma.stock.update({
        where: { id: st.id },
        data: { quantite: calculReel },
      })
      repaired++
    }
  }
  return repaired
}

async function repairBankIntegrity() {
  const banques = await prisma.banque.findMany()
  let repaired = 0

  for (const b of banques) {
    const entreesAgg = await prisma.operationBancaire.aggregate({
      where: { banqueId: b.id, type: { in: ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'] } },
      _sum: { montant: true },
    })
    const sortiesAgg = await prisma.operationBancaire.aggregate({
      where: { banqueId: b.id, type: { notIn: ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'] } },
      _sum: { montant: true },
    })
    const soldeReel = (b.soldeInitial || 0) + (entreesAgg._sum.montant || 0) - (sortiesAgg._sum.montant || 0)

    if (Math.abs(b.soldeActuel - soldeReel) > 0.01) {
      console.log(`  Banque "${b.nom}" (ID:${b.id}): ${b.soldeActuel} -> ${soldeReel}`)
      await prisma.banque.update({
        where: { id: b.id },
        data: { soldeActuel: soldeReel },
      })
      repaired++
    }
  }
  return repaired
}

async function repairReglementLigneIntegrity() {
  let venteLignesCreated = 0
  let achatLignesCreated = 0

  const reglementsVente = await prisma.reglementVente.findMany({
    where: { venteId: { not: null } },
    select: { id: true, venteId: true, montant: true }
  })
  for (const rv of reglementsVente) {
    if (!rv.venteId) continue
    const existing = await prisma.reglementVenteLigne.findFirst({
      where: { reglementId: rv.id, venteId: rv.venteId }
    })
    if (!existing) {
      console.log(`  Ligne manquante: ReglementVente #${rv.id} -> Vente #${rv.venteId} montant=${rv.montant}`)
      await prisma.reglementVenteLigne.create({
        data: { reglementId: rv.id, venteId: rv.venteId, montant: rv.montant }
      })
      venteLignesCreated++
    }
  }

  const reglementsAchat = await prisma.reglementAchat.findMany({
    where: { achatId: { not: null } },
    select: { id: true, achatId: true, montant: true }
  })
  for (const ra of reglementsAchat) {
    if (!ra.achatId) continue
    const existing = await prisma.reglementAchatLigne.findFirst({
      where: { reglementId: ra.id, achatId: ra.achatId }
    })
    if (!existing) {
      console.log(`  Ligne manquante: ReglementAchat #${ra.id} -> Achat #${ra.achatId} montant=${ra.montant}`)
      await prisma.reglementAchatLigne.create({
        data: { reglementId: ra.id, achatId: ra.achatId, montant: ra.montant }
      })
      achatLignesCreated++
    }
  }
  return { venteLignesCreated, achatLignesCreated }
}

async function repairMontantPayeIntegrity() {
  let ventesRepaired = 0
  let achatsRepaired = 0

  const ventes = await prisma.vente.findMany({ select: { id: true, numero: true, montantPaye: true } })
  for (const v of ventes) {
    const lignes = await prisma.reglementVenteLigne.findMany({ where: { venteId: v.id }, select: { montant: true } })
    const montantPayeReel = lignes.reduce((s: number, l: { montant: number }) => s + (l.montant || 0), 0)
    if (Math.abs((v.montantPaye || 0) - montantPayeReel) > 0.01) {
      console.log(`  Vente ${v.numero || v.id}: montantPaye ${v.montantPaye || 0} -> ${montantPayeReel}`)
      await prisma.vente.update({ where: { id: v.id }, data: { montantPaye: montantPayeReel } })
      ventesRepaired++
    }
  }

  const achats = await prisma.achat.findMany({ select: { id: true, numero: true, montantPaye: true } })
  for (const a of achats) {
    const lignes = await prisma.reglementAchatLigne.findMany({ where: { achatId: a.id }, select: { montant: true } })
    const montantPayeReel = lignes.reduce((s: number, l: { montant: number }) => s + (l.montant || 0), 0)
    if (Math.abs((a.montantPaye || 0) - montantPayeReel) > 0.01) {
      console.log(`  Achat ${a.numero || a.id}: montantPaye ${a.montantPaye || 0} -> ${montantPayeReel}`)
      await prisma.achat.update({ where: { id: a.id }, data: { montantPaye: montantPayeReel } })
      achatsRepaired++
    }
  }
  return { ventesRepaired, achatsRepaired }
}

async function main() {
  console.log('=== Relecture Post-Deploiement GestiCom Pro ===')
  console.log()

  console.log('1. Recalcul des soldes caisse...')
  const caisses = await repairCaisseIntegrity()
  console.log(`   ${caisses} magasin(s) recalcule(s)`)

  console.log('2. Recalcul des quantites stock...')
  const stocks = await repairStockIntegrity()
  console.log(`   ${stocks} stock(s) recalcule(s)`)

  console.log('3. Recalcul des soldes bancaires...')
  const banks = await repairBankIntegrity()
  console.log(`   ${banks} banque(s) recalculee(s)`)

  console.log('4. Creation des Lignes Reglement manquantes...')
  const lignes = await repairReglementLigneIntegrity()
  console.log(`   ${lignes.venteLignesCreated} Ligne(s) Vente creee(s), ${lignes.achatLignesCreated} Ligne(s) Achat creee(s)`)

  console.log('5. Recalcul des montantPaye (Ventes & Achats)...')
  const montantPaye = await repairMontantPayeIntegrity()
  console.log(`   ${montantPaye.ventesRepaired} vente(s) recalculee(s), ${montantPaye.achatsRepaired} achat(s) recalcule(s)`)

  console.log()
  console.log('=== Termine ===')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})