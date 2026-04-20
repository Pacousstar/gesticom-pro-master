const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('--- DIAGNOSTIC FINAL ---');
  try {
    // 1. Qui possède les ventes ? (Conversion BigInt en String pour affichage)
    const repartition = await prisma.$queryRawUnsafe('SELECT entiteId, COUNT(*) as nb, SUM(montantTotal) as total FROM Vente GROUP BY entiteId');
    console.log('REPARTITION DES VENTES PAR ENTITÉ:');
    repartition.forEach(r => {
        console.log(`- Entité ID: ${r.entiteId}, Nb Ventes: ${r.nb}, CA Total: ${r.total}`);
    });

    // 2. Vérifier le format précis du résultat SQL du Dashboard
    const targetDate = new Date(new Date().getFullYear() - 2, new Date().getMonth(), 1).toISOString().split('T')[0];
    const r = await prisma.$queryRawUnsafe(`
      SELECT 
        SUBSTR(date, 1, 7) as mois,
        SUM(montantTotal) as montant
      FROM Vente
      WHERE statut IN ('VALIDE', 'VALIDEE')
      AND SUBSTR(date, 1, 10) >= '${targetDate}'
      GROUP BY mois
      ORDER BY mois ASC
    `);
    
    console.log('RÉSULTAT TENDANCES RAW (SANS FILTRE ENTITÉ):');
    r.forEach(l => console.log(`  ${l.mois}: ${l.montant} (${typeof l.montant})`));

  } catch (e) {
    console.error('ERREUR:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
