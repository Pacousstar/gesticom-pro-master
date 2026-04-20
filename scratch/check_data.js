const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('--- DIAGNOSTIC GRAPHIQUE ---');
  try {
    // 1. Vérifier si on a des ventes
    const total = await prisma.vente.count();
    console.log('Total Ventes en base:', total);

    const validées = await prisma.vente.count({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] } }
    });
    console.log('Ventes validées (SQL/Prisma):', validées);

    // 2. Tester la requête SQL exacte du Dashboard
    const r = await prisma.$queryRawUnsafe(`
      SELECT 
        strftime('%Y-%m', date) as mois,
        SUM(montantTotal) as montant
      FROM Vente
      WHERE statut IN ('VALIDE', 'VALIDEE')
      AND date >= date('now', '-24 month', 'start of month')
      GROUP BY mois
      ORDER BY mois ASC
    `);
    
    console.log('RÉSULTAT SQL TENDANCES:', JSON.stringify(r, null, 2));
    
    if (r.length === 0) {
      console.log('!!! AUCUNE DONNÉE TROUVÉE !!!');
      console.log('Vérification du format de date sur une vente au hasard...');
      const samples = await prisma.$queryRawUnsafe('SELECT date FROM Vente LIMIT 3');
      console.log('EXEMPLES DE DATES BRUTES:', JSON.stringify(samples, null, 2));
    }

  } catch (e) {
    console.error('ERREUR DIAGNOSTIC:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
