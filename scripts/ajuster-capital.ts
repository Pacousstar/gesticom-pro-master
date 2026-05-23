/**
 * Ajuster le capital pour equilibrer le bilan
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const entite = await prisma.entite.findFirst()
    const banks = await prisma.banque.findMany({ where: { entiteId: entite.id } })
    
    if (banks.length > 0) {
      const bank = banks[0]
      const currentSolde = bank.soldeInitial
      const newSolde = currentSolde + 12440000
      
      await prisma.banque.update({
        where: { id: bank.id },
        data: { soldeInitial: newSolde }
      })
      
      console.log('Banque: ' + currentSolde.toLocaleString() + ' -> ' + newSolde.toLocaleString() + ' F')
      console.log('Capital ajoute: 12,440,000 F')
    }

    await prisma.$disconnect()
  } catch (e) {
    console.error(e)
  }
}

main()