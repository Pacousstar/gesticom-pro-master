const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- DIAGNOSTIC DES MOUVEMENTS DE STOCK ---');
  try {
    const total = await prisma.mouvement.count();
    console.log('NOMBRE DE MOUVEMENTS TROUVES : ' + total);
    
    if (total > 0) {
      console.log('-------------------------------------------');
      console.log('CONSEIL : Si le tableau est vide, reglez le');
      console.log('filtre de date sur le 01/01/2020.');
    } else {
      console.log('ALERTE : La table est VIDE.');
    }
  } catch (err) {
    console.log('ERREUR : ' + err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
