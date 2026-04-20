/**
 * scripts/verify-dashboard-health.js
 * Script de diagnostic pour le Dashboard GestiCom Pro
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDashboard() {
  console.log('--- DIAGNOSTIC DASHBOARD GESTICOM PRO ---');
  
  try {
    // 1. Test de connexion DB
    console.log('[1/4] Vérification connexion Base de données...');
    await prisma.$connect();
    console.log('      OK : Connexion établie.');

    // 2. Vérification des KPIs critiques
    console.log('[2/4] Audit des compteurs KPIs...');
    const now = new Date();
    const debAuj = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const [ventes, produits, stocks, clients] = await Promise.all([
      prisma.vente.count({ where: { date: { gte: debAuj } } }),
      prisma.produit.count({ where: { actif: true } }),
      prisma.stock.aggregate({ _sum: { quantite: true } }),
      prisma.client.count({ where: { actif: true } })
    ]);

    console.log(`      Ventes du jour : ${ventes}`);
    console.log(`      Produits catalogue : ${produits}`);
    console.log(`      Articles en stock : ${stocks._sum.quantite || 0}`);
    console.log(`      Clients actifs : ${clients}`);
    console.log('      OK : KPIs accessibles.');

    // 3. Vérification des alertes système
    console.log('[3/4] Audit des alertes système...');
    const alertes = await prisma.systemAlerte.count({ where: { lu: false } });
    console.log(`      Alertes non lues : ${alertes}`);
    console.log('      OK : Système d\'alertes opérationnel.');

    // 4. Vérification du flux d\'activité (Bug correctif)
    console.log('[4/4] Vérification du flux d\'activité...');
    const flux = await prisma.vente.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: { client: true }
    });
    console.log(`      Entrées trouvées : ${flux.length}`);
    if (flux.length > 0) {
      console.log(`      Dernière vente : ${flux[0].numero} (${flux[0].montantTotal} F)`);
    }
    console.log('      OK : Flux d\'activité validé.');

    console.log('\n--- RÉSULTAT DU SCAN : DASHBOARD EN BONNE SANTÉ ---');

  } catch (error) {
    console.error('\n!!! ERREUR DE DIAGNOSTIC !!!');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDashboard();
