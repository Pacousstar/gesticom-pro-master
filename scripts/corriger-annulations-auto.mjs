// Auto-correction rétroactive des annulations LIVRAISON_IMMEDIATE
// Exécuté automatiquement par standalone-launcher.js à chaque démarrage

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const ventes = await prisma.vente.findMany({
    where: {
      statut: 'ANNULEE',
      typeVente: 'LIVRAISON_IMMEDIATE',
      retraitDiffere: false,
    },
    include: { lignes: true },
    orderBy: { id: 'asc' },
  });

  let corrigees = 0;

  for (const v of ventes) {
    const mouvementExistant = await prisma.mouvement.findFirst({
      where: { observation: { contains: `Annulation vente ${v.numero}` }, type: 'ENTREE' },
    });
    if (mouvementExistant) continue;

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
            observation: `Annulation vente ${v.numero} (correction auto)`,
          },
        });
      }
    });
    corrigees++;
  }

  if (corrigees > 0) {
    console.log(`[AutoCorrection] ${corrigees} annulation(s) corrigée(s) — stock restauré.`);
  }
} catch (err) {
  console.error('[AutoCorrection] Erreur:', err.message);
} finally {
  await prisma.$disconnect();
}
