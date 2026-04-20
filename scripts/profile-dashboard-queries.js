/**
 * scripts/profile-dashboard-queries.js
 * Test de performance des requêtes du Dashboard
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function profile() {
  console.log('--- PROFILAGE DES REQUÊTES DASHBOARD ---');
  
  const tests = [
    {
      name: 'KPIs Ventes (Standard)',
      fn: () => prisma.vente.aggregate({ 
        where: { date: { gte: new Date().toISOString() }, statut: 'VALIDE' }, 
        _sum: { montantTotal: true } 
      })
    },
    {
      name: 'Top 5 Produits (Lourd)',
      fn: () => prisma.venteLigne.groupBy({
        by: ['produitId', 'designation'],
        _sum: { montant: true, quantite: true },
        take: 5
      })
    },
    {
      name: 'Valeur Stock (Raw Query)',
      fn: () => prisma.$queryRaw`SELECT SUM(quantite * 1000) FROM "Stock"` // Simulation simplifiée
    },
    {
      name: 'Tendances 24 mois (Très Lourd)',
      fn: () => prisma.$queryRaw`
        SELECT SUBSTR(date, 1, 7) as mois, SUM("montantTotal") as montant
        FROM "Vente"
        WHERE statut IN ('VALIDE', 'VALIDEE')
        AND date >= date('now', '-24 month', 'start of month')
        GROUP BY mois
      `
    },
    {
      name: 'Compteurs Trésorerie (Grand Livre)',
      fn: () => prisma.ecritureComptable.aggregate({
        where: { compte: { numero: { startsWith: '5' } } },
        _sum: { debit: true, credit: true }
      })
    },
    {
      name: 'Alertes Crédit (Nouveau/Complexe)',
      fn: async () => {
        const clients = await prisma.client.findMany({ where: { plafondCredit: { gt: 0 } }, select: { id: true } });
        return prisma.vente.groupBy({
          by: ['clientId'],
          where: { clientId: { in: clients.map(c => c.id) }, statut: 'VALIDEE' },
          _sum: { montantTotal: true, montantPaye: true }
        });
      }
    }
  ];

  for (const test of tests) {
    const start = Date.now();
    try {
      await test.fn();
      const duration = Date.now() - start;
      console.log(`${duration.toString().padStart(5)}ms | ${test.name}`);
    } catch (e) {
      console.log(` ERROR  | ${test.name} : ${e.message}`);
    }
  }

  await prisma.$disconnect();
}

profile();
