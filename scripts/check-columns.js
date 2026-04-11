const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumns() {
  console.log('--- VÉRIFICATION DES COLONNES (ÉLARGIE) ---');
  try {
    const tables = ['Mouvement', 'Achat', 'Charge', 'Depense', 'ReglementVente', 'Utilisateur', 'Caisse'];
    for (const table of tables) {
      console.log(`\nTable: ${table}`);
      const info = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
      console.log(info.map(c => c.name).join(', '));
    }
  } catch (err) {
    console.error('Erreur:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
