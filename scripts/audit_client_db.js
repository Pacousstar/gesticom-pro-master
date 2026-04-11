const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/gesticom/gesticom.db'
    }
  }
});

async function main() {
  console.log('--- AUDIT DE LA BASE DE DONNÉES CLIENT (C:/gesticom) ---');
  
  const entites = await prisma.entite.findMany();
  console.log('Entités trouvées:', entites.map(e => `${e.id}: ${e.nom_groupe}`));

  const depensesRaw = await prisma.depense.count();
  const depensesE1 = await prisma.depense.count({ where: { entiteId: 1 } });
  
  console.log(`Dépenses totales: ${depensesRaw}`);
  console.log(`Dépenses rattachées à Entité 1: ${depensesE1}`);

  const ecrituresRaw = await prisma.ecritureComptable.count();
  const ecrituresE1 = await prisma.ecritureComptable.count({ where: { entiteId: 1 } });
  console.log(`Écritures comptables totales: ${ecrituresRaw}`);
  console.log(`Écritures rattachées à Entité 1: ${ecrituresE1}`);

  const stocksRaw = await prisma.stock.count();
  const stocksE1 = await prisma.stock.count({ where: { entiteId: 1 } });
  console.log(`Entrées de stock totales: ${stocksRaw}`);
  console.log(`Stocks rattachés à Entité 1: ${stocksE1}`);

  // Vérifier si des données sont orphelines (entiteId null ou 0)
  // Note: entiteId est souvent requis mais vérifions
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
