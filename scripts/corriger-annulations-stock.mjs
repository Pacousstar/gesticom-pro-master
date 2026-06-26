import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

console.log('=== Correction rétroactive stock annulations ===');
console.log(dryRun ? '⚠ MODE DRY-RUN — aucune écriture en DB' : '⚠ MODE RÉEL — va modifier la DB');
if (!dryRun) {
  console.log('Pour faire un essai à blanc, relancez avec --dry-run');
}
console.log('');

const ventes = await prisma.vente.findMany({
  where: {
    statut: 'ANNULEE',
    typeVente: 'LIVRAISON_IMMEDIATE',
    retraitDiffere: false,
  },
  include: { lignes: true },
  orderBy: { id: 'asc' },
});

console.log(`Ventes annulées LIVRAISON_IMMEDIATE trouvées : ${ventes.length}`);
console.log('');

let totalCorrigees = 0;
let totalLignes = 0;

for (const v of ventes) {
  const mouvementExistant = await prisma.mouvement.findFirst({
    where: { observation: `Annulation vente ${v.numero}`, type: 'ENTREE' },
  });

  if (mouvementExistant) {
    continue;
  }

  if (dryRun) {
    const details = v.lignes.map(l => `    - ${l.designation || l.produitId}: qte ${l.quantite}`);
    console.log(`  📋 V${v.id} (${v.numero}) — ${new Date(v.date).toLocaleDateString('fr-FR')}`);
    console.log(details.join('\n'));
    totalCorrigees++;
    totalLignes += v.lignes.length;
    continue;
  }

  await prisma.$transaction(async (tx) => {
    for (const l of v.lignes) {
      await tx.stock.updateMany({
        where: { produitId: l.produitId, magasinId: v.magasinId, entiteId: v.entiteId },
        data: { quantite: { increment: l.quantite } },
      });
      await tx.mouvement.create({
        data: {
          type: 'ENTREE',
          produitId: l.produitId,
          magasinId: v.magasinId,
          entiteId: v.entiteId,
          utilisateurId: 1,
          quantite: l.quantite,
          dateOperation: new Date(),
          observation: `Annulation vente ${v.numero} (correction rétro)`,
        },
      });
    }
  });

  totalCorrigees++;
  totalLignes += v.lignes.length;
  console.log(`  ✅ V${v.id} (${v.numero}) corrigée — ${v.lignes.length} ligne(s)`);
}

console.log('');
if (dryRun) {
  console.log(`=== DRY-RUN terminé : ${totalCorrigees} ventes à corriger (${totalLignes} lignes) ===`);
  console.log(`Relancez sans --dry-run pour exécuter la correction réelle.`);
} else {
  console.log(`=== Correction terminée : ${totalCorrigees} ventes corrigées (${totalLignes} lignes) ===`);
}

await prisma.$disconnect();
