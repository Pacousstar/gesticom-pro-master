import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPiece() {
  const piece = 'V1773927444846'
  const rows = await prisma.ecritureComptable.findMany({
    where: { piece },
    include: { compte: true }
  })
  
  console.log(`Pièce: ${piece}`)
  rows.forEach(r => {
    console.log(`- ${r.compte.numero} | ${r.libelle} | D: ${r.debit} | C: ${r.credit} | Type: ${r.referenceType}`)
  })
}

checkPiece()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
