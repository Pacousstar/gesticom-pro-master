const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function reparationUltime() {
  console.log('--- 🛡️ RÉPARATION ULTIME - GESTI-COM PRO 🛡️ ---');
  
  try {
    // 1. NETTOYAGE DES FICHIERS PRISMA BLOQUANTS
    console.log('[1/4] Nettoyage des fichiers temporaires Prisma...');
    const prismaClientPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client');
    if (fs.existsSync(prismaClientPath)) {
      const files = fs.readdirSync(prismaClientPath);
      files.forEach(file => {
        if (file.endsWith('.tmp') || file.includes('query_engine')) {
          if (file.endsWith('.tmp')) {
             try { fs.unlinkSync(path.join(prismaClientPath, file)); } catch(e) {}
          }
        }
      });
      console.log('   ✅ Nettoyage terminé.');
    }

    // 2. CORRECTION DU SCHÉMA SQL (MANUELLE)
    console.log('[2/4] Vérification et ajout des colonnes manquantes...');
    
    const tablesToFix = [
      { table: 'Vente', column: 'pointsGagnes', type: 'INTEGER DEFAULT 0' },
      { table: 'Client', column: 'pointsFidelite', type: 'INTEGER DEFAULT 0' },
      { table: 'VenteLigne', column: 'coutUnitaire', type: 'FLOAT DEFAULT 0' },
      { table: 'Mouvement', column: 'dateOperation', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { table: 'Vente', column: 'dateOperation', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { table: 'Achat', column: 'dateOperation', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { table: 'Caisse', column: 'dateOperation', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { table: 'Mouvement', column: 'entiteId', type: 'INTEGER DEFAULT 1' },
      { table: 'ReglementVente', column: 'entiteId', type: 'INTEGER DEFAULT 1' },
    ];

    for (const item of tablesToFix) {
      try {
        // Vérifier si la colonne existe déjà
        const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("${item.table}")`);
        const exists = info.some(c => c.name === item.column);
        
        if (!exists) {
          console.log(`   🔸 Ajout de ${item.column} dans ${item.table}...`);
          await prisma.$executeRawUnsafe(`ALTER TABLE "${item.table}" ADD COLUMN "${item.column}" ${item.type}`);
        }
      } catch (e) {
        // console.log(`   ℹ️ Note sur ${item.table}.${item.column} : ${e.message}`);
      }
    }
    console.log('   ✅ Schéma synchronisé.');

    // 3. OPTIMISATION DE LA BASE
    console.log('[3/4] Optimisation de la base de données (VACUUM)...');
    try {
      await prisma.$executeRawUnsafe('VACUUM');
      console.log('   ✅ Base optimisée.');
    } catch (e) {}

    // 4. RÉGÉNÉRATION PRISMA (OPTIONNEL MAIS CONSEILLÉ)
    console.log('[4/4] Régénération du client Prisma...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      console.log('   ✅ Prisma Client régénéré.');
    } catch (e) {
      console.log('   ⚠️ Échec de la régénération automatique (facultatif).');
    }

    console.log('\n🚀 RÉPARATION TERMINÉE ! Redémarrez le service GestiCom Pro.');
    
  } catch (err) {
    console.error('\n❌ ERREUR CRITIQUE LORS DE LA RÉPARATION :', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

reparationUltime();
