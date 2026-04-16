import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function cleanup() {
  console.log('🚀 Lancement du nettoyage des mouvements de réconciliation redondants...');

  const deleted = await prisma.mouvement.deleteMany({
    where: {
      OR: [
        { observation: { contains: 'RÉCONCILIATION PHASE II' } },
        { observation: { contains: 'Alignement automatique Audit GestiCom Pro' } }
      ]
    }
  });

  console.log(`✅ Nettoyage terminé. ${deleted.count} mouvements supprimés.`);
  
  // Re-vérifier un exemple (Azaro)
  const p = await prisma.produit.findFirst({ where: { designation: 'AZARO' } });
  if (p) {
    const mvts = await prisma.mouvement.findMany({ where: { produitId: p.id } });
    console.log(`Produit AZARO: ${mvts.length} mouvements restants.`);
  }
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
