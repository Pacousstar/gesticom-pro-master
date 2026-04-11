import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/gesticom/gesticom.db',
    },
  },
});

async function repair() {
  console.log('--- RÉPARATION PRÉCISE DES DONNÉES (MODE PRODUCTION ETB) ---');

  try {
    // 1. Mise à jour de l'Entité (Correcte)
    console.log("[REPAIR] Mise à jour de l'Entité...");
    await prisma.$executeRawUnsafe(
      "UPDATE Entite SET code = 'ETB01', nom = 'QUINCAILLERIE ETB' WHERE id = 1"
    );
    console.log("[OK] Entité ID 1 -> ETB01 - QUINCAILLERIE ETB");

    // 2. Mise à jour du Magasin (Correct)
    console.log("[REPAIR] Mise à jour du Magasin...");
    await prisma.$executeRawUnsafe(
      "UPDATE Magasin SET code = 'MAG-ETB', nom = 'MAGASIN PRINCIPAL ETB' WHERE id = 1"
    );
    console.log("[OK] Magasin ID 1 -> MAG-ETB - MAGASIN PRINCIPAL ETB");

    // 3. Rattachement GLOBAL de toutes les tables à l'Entité 1
    const tables = ['Depense', 'EcritureComptable', 'Stock', 'Produit', 'Vente', 'Achat', 'Client', 'Fournisseur', 'Mouvement', 'Caisse'];
    
    for (const table of tables) {
        console.log(`[REPAIR] Nettoyage Table ${table}...`);
        const count = await prisma.$executeRawUnsafe(
          `UPDATE ${table} SET entiteId = 1 WHERE entiteId IS NULL OR entiteId != 1`
        );
        if (count > 0) console.log(`[OK] ${count} lignes corrigées pour l'Entité dans ${table}.`);

        // Pour les tables liées au magasin, on force le Magasin 1 (MAG-ETB)
        if (['Depense', 'Stock', 'Vente', 'Achat', 'Mouvement', 'Caisse'].includes(table)) {
            const magCount = await prisma.$executeRawUnsafe(
                `UPDATE ${table} SET magasinId = 1 WHERE magasinId IS NULL OR magasinId != 1`
            );
            if (magCount > 0) console.log(`[OK] ${magCount} lignes rattachées au Magasin Principal (ID 1) dans ${table}.`);
        }
    }

    console.log('--- VÉRIFICATION FINALE DES INDICATEURS ---');
    
    const d35 = await prisma.depense.count({ where: { entiteId: 1 } });
    console.log(`[VÉRIF] Dépenses rattachées : ${d35} (Cible : 35)`);

    const s253 = await prisma.stock.count({ where: { quantite: { gt: 0 }, magasinId: 1 } });
    console.log(`[VÉRIF] Lignes de Stock (>0) : ${s253} (Cible : 253)`);

    const eBilan = await prisma.ecritureComptable.count({ where: { entiteId: 1 } });
    console.log(`[VÉRIF] Écritures Bilan : ${eBilan} (Cible : >2000)`);

    console.log('--- RÉPARATION TERMINÉE AVEC SUCCÈS ---');
    console.log('NOTE : Lancez "npm run build" pour voir les changements sur le Dashboard.');

  } catch (error) {
    console.error('[ERR] Erreur lors de la réparation SQL :', error);
  } finally {
    await prisma.$disconnect();
  }
}

repair();
