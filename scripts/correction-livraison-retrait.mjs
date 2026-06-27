import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const corrections = [
  { code: 'ETB-00152', nouveauStock: 304, raison: 'Correction Livraison commande V1781958946508 -40' },
  { code: 'ETB-00264', nouveauStock: 339, raison: 'Correction Retrait vente V1782324109829 -20' }
];

for (const c of corrections) {
  const p = await prisma.produit.findFirst({ where: { code: c.code } });
  if (!p) { console.log(c.code, 'introuvable'); continue; }

  const stock = await prisma.stock.findUnique({
    where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } }
  });
  if (!stock) { console.log(c.code, 'pas de stock'); continue; }

  const delta = Math.round((c.nouveauStock - stock.quantite) * 100) / 100;
  console.log(`${c.code} ${p.designation.trim()} : ${stock.quantite} → ${c.nouveauStock} (${delta > 0 ? '+' : ''}${delta})`);
  console.log(`  Raison: ${c.raison}`);

  if (delta !== 0) {
    await prisma.stock.update({
      where: { produitId_magasinId_entiteId: { produitId: p.id, magasinId: 1, entiteId: 1 } },
      data: { quantite: c.nouveauStock }
    });
    await prisma.mouvement.create({
      data: {
        date: new Date(),
        type: delta > 0 ? 'ENTREE' : 'SORTIE',
        produitId: p.id,
        magasinId: 1,
        entiteId: 1,
        utilisateurId: 1,
        quantite: Math.abs(delta),
        observation: `Correction ${c.raison}`
      }
    });
    console.log(`  ✓ Stock mis à jour + mouvement créé`);
  }
}

await prisma.$disconnect();
