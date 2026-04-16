import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diag() {
  console.log('--- DIAGNOSTIC DÉSÉQUILIBRE COMPTABLE ---')
  
  // 1. Trouver les documents (pièces) déséquilibrés
  const pieces = await prisma.ecritureComptable.groupBy({
    by: ['piece', 'referenceType'],
    _sum: { debit: true, credit: true },
    having: {
      id: { _count: { gt: 0 } } // dummy to use having
    }
  })

  let countUnbalanced = 0
  pieces.forEach(p => {
    const diff = (p._sum.debit || 0) - (p._sum.credit || 0)
    if (Math.abs(diff) > 0.1) {
      countUnbalanced++
      if (countUnbalanced < 20) {
        console.log(`Pièce: ${p.piece} (${p.referenceType}) | Diff: ${diff} | D:${p._sum.debit} C:${p._sum.credit}`)
      }
    }
  })

  console.log(`Total pièces déséquilibrées: ${countUnbalanced}`)

  // 2. Vérifier les écritures sans pièce
  const sansPiece = await prisma.ecritureComptable.findMany({
    where: { piece: '' }
  })
  console.log(`Écritures sans numéro de pièce: ${sansPiece.length}`)
}

diag()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
