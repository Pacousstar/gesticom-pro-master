import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function checkAzaro() { 
  const p = await prisma.produit.findFirst({ where: { designation: 'AZARO' } });
  if (p) {
    console.log(`Produit: ${p.designation} (ID: ${p.id})`);
    const mvts = await prisma.mouvement.findMany({ 
        where: { produitId: p.id }, 
        orderBy: { createdAt: 'asc' } 
    });
    console.log(JSON.stringify(mvts, null, 2));
    
    const stock = await prisma.stock.findMany({ where: { produitId: p.id } });
    console.log('Stock Table:', JSON.stringify(stock, null, 2));
  } else {
    console.log('Produit AZARO introuvable');
  }
} 

checkAzaro()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
