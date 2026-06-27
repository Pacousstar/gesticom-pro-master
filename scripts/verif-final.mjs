import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const codes = ['ETB-00044','ETB-00069','ETB-00064','TOLE-066','ETB-00152','ETB-00022','ETB-00264','ETB-00157','ETB-00156'];
for (const code of codes) {
  const p = await prisma.produit.findFirst({ where: { code } });
  const s = await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } } });
  console.log(code, '=>', s?.quantite);
}
await prisma.$disconnect();
