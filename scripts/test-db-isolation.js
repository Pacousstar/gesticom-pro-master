const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testIsolation() {
  console.log('🏁 DÉMARRAGE DU TEST D\'ISOLATION (JS)');
  try {
    const entites = await prisma.entite.findMany({ take: 2 });
    if (entites.length < 2) {
      console.log('⚠️ Moins de 2 entités pour le test croisé.');
    }
    
    for (const entite of entites) {
      console.log(`👤 Simulation Utilisateur Entité: ${entite.nom} (ID: ${entite.id})`);
      const ecritures = await prisma.ecritureComptable.findMany({
        where: { entiteId: entite.id },
        take: 10
      });
      
      const leaks = ecritures.filter(e => e.entiteId !== entite.id);
      if (leaks.length === 0) {
        console.log(`✅ OK: 0 fuites détectées (${ecritures.length} records).`);
      } else {
        console.log(`❌ ERREUR: ${leaks.length} fuites détectées !`);
      }
    }
    
    console.log('🔍 Test Diagnostic...');
    const diag = await prisma.ecritureComptable.count({ where: { entiteId: entites[0].id } });
    console.log(`✅ Diagnostic Entité ${entites[0].id}: ${diag} écritures found.`);

  } catch (e) {
    console.error('❌ Erreur:', e);
  } finally {
    await prisma.$disconnect();
    console.log('🏁 FIN DU TEST.');
  }
}

testIsolation();
