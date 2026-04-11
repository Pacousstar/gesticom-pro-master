const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateSchemaV3() {
  console.log('👷 MISE À JOUR DU SCHÉMA (V3) - DÉBLOQUAGE DES MOUVEMENTS...')
  
  try {
    // 1. AJOUT DE dateOperation SUR LES TABLES PRINCIPALES (INDISPENSABLE POUR LES MVT STOCK)
    console.log('⏳ Mise à jour table Mouvement (dateOperation)...')
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Mouvement" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Mouvement" ADD COLUMN "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}

    // 2. SECURITE SUR LES AUTRES TABLES
    console.log('⏳ Mise à jour table Vente (dateOperation)...')
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}
    
    console.log('⏳ Mise à jour table Achat (dateOperation)...')
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}

    console.log('⏳ Mise à jour table Caisse (dateOperation)...')
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch(e) {}

    // 3. VÉRIFICATION entiteId SUR MOUVEMENT (CRITIQUE POUR L'AFFICHAGE)
    console.log('⏳ Vérification table Mouvement (entiteId)...')
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Mouvement" ADD COLUMN "entiteId" INTEGER DEFAULT 1`); } catch(e) {}

    console.log('\n✅ MISE À JOUR V3 TERMINÉE !')
    console.log('📊 Les mouvements de stock vont maintenant s\'afficher.')

  } catch (err) {
    console.error('❌ ERREUR LORS DE LA MISE À JOUR :', err)
  } finally {
    await prisma.$disconnect()
  }
}

updateSchemaV3()
