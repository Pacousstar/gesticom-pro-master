import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function audit() {
  console.log('--- DÉBUT DE L\'AUDIT GÉNÉRAL GESTICOM PRO ---')
  const report: any = {
    integrity: {},
    accounting: {},
    inventory: {},
    sales: {},
  }

  // 1. Audit d'intégrité de la base
  const counts = await Promise.all([
    prisma.vente.count(),
    prisma.achat.count(),
    prisma.produit.count(),
    prisma.stock.count(),
    prisma.ecritureComptable.count(),
    prisma.utilisateur.count(),
    prisma.entite.count(),
  ])

  report.integrity.counts = {
    Ventes: counts[0],
    Achats: counts[1],
    Produits: counts[2],
    Stocks: counts[3],
    Ecritures: counts[4],
    Utilisateurs: counts[5],
    Entites: counts[6],
  }

  // 2. Audit Comptable - Équilibre Débit/Crédit
  const totalBalances = await prisma.ecritureComptable.aggregate({
    _sum: { debit: true, credit: true }
  })
  const diff = (totalBalances._sum.debit || 0) - (totalBalances._sum.credit || 0)
  report.accounting.balanceGlobal = {
    totalDebit: totalBalances._sum.debit,
    totalCredit: totalBalances._sum.credit,
    ecart: diff,
    status: Math.abs(diff) < 1 ? 'OK' : 'ERREUR (DÉSÉQUILIBRE)'
  }

  // 3. Audit Ventes vs Comptabilité
  const ventesSansEcritures = await prisma.vente.count({
    where: {
      statut: { in: ['VALIDE', 'VALIDEE'] },
      NOT: {
        id: { in: (await prisma.ecritureComptable.findMany({ 
          where: { referenceType: 'VENTE' }, 
          select: { referenceId: true } 
        })).map(e => e.referenceId as number) }
      }
    }
  })
  report.sales.unaccounted = ventesSansEcritures

  // 4. Audit Stock
  const stockNegatif = await prisma.stock.count({
    where: { quantite: { lt: 0 } }
  })
  report.inventory.negativePositions = stockNegatif

  const produitsSansPamp = await prisma.produit.count({
    where: { pamp: 0 }
  })
  report.inventory.missingValuation = produitsSansPamp

  console.log(JSON.stringify(report, null, 2))
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
