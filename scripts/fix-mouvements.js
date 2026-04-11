const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixMouvements() {
  console.log('🏗️ RÉPARATION CIBLÉE DE LA TABLE MOUVEMENT...')
  
  try {
    // On tente d'ajouter les colonnes une par une avec du SQL pur
    console.log('⏳ Ajout de dateOperation...')
    try { 
      await prisma.$executeRawUnsafe(`ALTER TABLE "Mouvement" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('   ✅ Colonne dateOperation ajoutée !');
    } catch(e) { 
      console.log('   ℹ️ dateOperation déjà présente ou erreur SQLite.'); 
    }

    console.log('⏳ Ajout de createdAt...')
    try { 
      await prisma.$executeRawUnsafe(`ALTER TABLE "Mouvement" ADD COLUMN "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('   ✅ Colonne createdAt ajoutée !');
    } catch(e) { 
      console.log('   ℹ️ createdAt déjà présente.'); 
    }

    console.log('\n✅ TABLE MOUVEMENT RÉPARÉE !');
    console.log('📊 Vous pouvez maintenant voir vos mouvements de stock.');

  } catch (err) {
    console.error('❌ ERREUR FATALE :', err);
  } finally {
    await prisma.$disconnect();
  }
}

fixMouvements()
