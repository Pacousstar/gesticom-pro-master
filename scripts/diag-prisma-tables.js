const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullDiag() {
  console.log('--- DIAGNOSTIC COMPLET DES TABLES PRISMA ---');
  const tables = [
    'entite', 'utilisateur', 'magasin', 'produit', 'stock', 'client', 
    'vente', 'venteLigne', 'reglementVente', 'journal', 'planCompte', 'ecritureComptable', 'caisse'
  ];

  for (const table of tables) {
    try {
      const count = await prisma[table].count();
      console.log(`[OK] Table ${table.padEnd(18)} : ${count} enregistrements`);
    } catch (err) {
      console.log(`[ERR] Table ${table.padEnd(18)} : ${err.message.split('\n')[0]}`);
    }
  }

  await prisma.$disconnect();
}

fullDiag();
