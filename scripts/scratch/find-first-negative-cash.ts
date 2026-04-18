import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findFirstNegative() {
  console.log('--- 🔍 ANALYSE DU PREMIER DÉFICIT CAISSE ---')
  const ops = await prisma.caisse.findMany({
    orderBy: { id: 'asc' }
  })

  let cumulativeBalance = 0
  let found = false

  for (const op of ops) {
    if (op.type === 'ENTREE') {
      cumulativeBalance += op.montant
    } else {
      cumulativeBalance -= op.montant
    }

    if (cumulativeBalance < 0 && !found) {
      console.log('\n🚩 BASCULEMENT DÉTECTÉ :')
      console.log(`Date : ${op.date.toLocaleDateString()}`)
      console.log(`Motif : ${op.motif}`)
      console.log(`Montant de l'opération : ${op.montant.toLocaleString()} FCFA`)
      console.log(`Solde juste après cette opération : ${cumulativeBalance.toLocaleString()} FCFA`)
      console.log('\n--- DÉTAIL TECHNIQUE ---')
      console.log(JSON.stringify(op, null, 2))
      found = true
      break
    }
  }

  if (!found) {
    console.log('Le solde n\'est jamais descendu en dessous de zéro.')
  }
}

findFirstNegative()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
