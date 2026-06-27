import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const codes = ['ETB-00152', 'ETB-00264'];
const debut = new Date('2026-06-12T08:00:00');
const fin = new Date('2026-06-25T18:00:00');

const prods = await prisma.produit.findMany({ where: { code: { in: codes } } });
for (const p of prods) {
  console.log(p.code + ' ' + p.designation.trim());
  const mvts = await prisma.mouvement.findMany({
    where: { produitId: p.id, date: { gte: debut, lte: fin }, magasinId: 1, entiteId: 1 },
    orderBy: { date: 'asc' }
  });
  let totalE = 0, totalS = 0;
  for (const m of mvts) {
    const date = m.date.toISOString().slice(0, 10);
    const heure = m.date.toISOString().slice(11, 16);
    const obs = (m.observation || '').padEnd(45);
    if (m.type === 'ENTREE') { console.log(`  ${date} ${heure}  ENTREE  +${m.quantite}  ${obs}`); totalE += m.quantite; }
    else { console.log(`  ${date} ${heure}  SORTIE  -${m.quantite}  ${obs}`); totalS += m.quantite; }
  }
  console.log(`  TOTAL ENTREE=${totalE}  SORTIE=${totalS}`);
  console.log('');
}
await prisma.$disconnect();
