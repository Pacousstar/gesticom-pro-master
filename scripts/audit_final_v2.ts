import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/gesticom/gesticom.db',
    },
  },
});

async function audit() {
  console.log('--- AUDIT PROFOND DE LA BASE CLIENT (C:/gesticom/gesticom.db) ---');

  try {
    const entites = await prisma.entite.findMany();
    console.log('Entités présentes :', entites.map(e => `ID:${e.id} Name:${e.nom}`));

    const depCount = await prisma.depense.count();
    console.log(`Nombre total de Dépenses : ${depCount}`);
    if (depCount > 0) {
      const sample = await prisma.depense.findFirst();
      console.log('Exemple Dépense :', JSON.stringify(sample, null, 2));
    }

    const stockCount = await prisma.stock.count();
    console.log(`Nombre total d'entrées Stock : ${stockCount}`);

    const ecritCount = await prisma.ecritureComptable.count();
    console.log(`Nombre total d'Écritures Comptables : ${ecritCount}`);

    const prodCount = await prisma.produit.count();
    console.log(`Nombre total de Produits : ${prodCount}`);

    // Vérification des entiteId distincts
    const distinctEntDep = await prisma.depense.groupBy({ by: ['entiteId'] });
    console.log('IDs Entité utilisés dans Dépenses :', distinctEntDep.map(d => d.entiteId));

  } catch (error) {
    console.error('[ERR] Erreur Audit :', error);
  } finally {
    await prisma.$disconnect();
  }
}

audit();
