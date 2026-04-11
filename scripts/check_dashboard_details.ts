import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:C:/gesticom/gesticom.db',
    },
  },
});

async function checkDetails() {
  console.log('--- VÉRIFICATION DÉTAILLÉE DES MAGASINS ET PRIX ---');

  try {
    const magasins = await prisma.magasin.findMany();
    console.log('Magasins :', magasins.map(m => `ID:${m.id} Name:${m.nom} EntiteID:${m.entiteId}`));

    const productsWithPrice = await prisma.produit.count({
      where: {
        OR: [
          { prixAchat: { gt: 0 } },
          { pamp: { gt: 0 } }
        ]
      }
    });
    console.log(`Produits avec un prix d'achat/PAMP > 0 : ${productsWithPrice} / 291`);

    const comptesClasse5 = await prisma.planCompte.findMany({
      where: { numero: { startsWith: '5' } }
    });
    console.log('Comptes de Trésorerie (Classe 5) :', comptesClasse5.map(c => `${c.numero}: ${c.libelle}`));

    const depTotal = await prisma.depense.aggregate({
      where: { entiteId: 1 },
      _sum: { montant: true },
      _count: { id: true }
    });
    console.log('Total Dépenses (Entité 1) :', depTotal);

  } catch (error) {
    console.error('[ERR]', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDetails();
