const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const type = await prisma.$queryRawUnsafe('SELECT typeof(date) as t, date FROM Vente LIMIT 1');
    console.log('TYPE DE LA COLONNE DATE:', type);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
