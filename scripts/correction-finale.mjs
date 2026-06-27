import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const corrections = [
  { code: 'ETB-00044', stock: 2537, delta: -400, raison: 'Livraison commande V1781545121378' },
  { code: 'ETB-00069', stock: 349,  delta: -100, raison: 'Livraison commande V1781545121378' },
  { code: 'ETB-00064', stock: 549,  delta: -50,  raison: 'Livraison commande V1781545121378' },
  { code: 'TOLE-066',  stock: 2368, delta: -50,  raison: 'Livraison commande V1781272506351' },
  { code: 'ETB-00152', stock: 304,  delta: -40,  raison: 'Livraison commande V1781958946508' },
  { code: 'ETB-00022', stock: 2148, delta: -39,  raison: 'Livraison commande V1781548091442' },
  { code: 'ETB-00264', stock: 339,  delta: -20,  raison: 'Retrait vente V1782324109829' },
  { code: 'ETB-00157', stock: 0,    delta: -6,   raison: 'Livraison commande V1782381892761' },
  { code: 'ETB-00156', stock: 26,   delta: -3,   raison: 'Livraison commande V1782381892761' },
];

console.log('Corrections stocks :');
console.log('Code\tDesignation\tActuel\tNouveau\tDelta');

for (const c of corrections) {
  const p = await prisma.produit.findFirst({ where: { code: c.code } });
  if (!p) { console.log(c.code, 'introuvable'); continue; }

  const s = await prisma.stock.findUnique({
    where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } }
  });
  if (!s) { console.log(c.code, 'pas de stock'); continue; }

  console.log(`${c.code}\t${p.designation.trim()}\t${s.quantite}\t${c.stock}\t${c.delta}`);

  await prisma.stock.update({
    where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } },
    data: { quantite: c.stock }
  });

  await prisma.mouvement.create({
    data: {
      date: new Date(),
      type: 'SORTIE',
      produitId: p.id,
      magasinId: 1,
      entiteId: 1,
      utilisateurId: 1,
      quantite: Math.abs(c.delta),
      observation: `Correction ${c.raison}`
    }
  });
}

console.log('\nTermine : 9 produits corriges');

await prisma.$disconnect();
