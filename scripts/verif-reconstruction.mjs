import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const codes = ['ETB-00152','ETB-00264','ETB-00044','DIVE-018','NIVE-238','TOLE-068','VERN-218','ETB-00069'];
const prods = await prisma.produit.findMany({ where: { code: { in: codes } } });
for (const p of prods) {
  const s = await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } } });
  console.log(p.code + ' ' + p.designation.trim() + ' => ' + s?.quantite);
}
await prisma.$disconnect();
