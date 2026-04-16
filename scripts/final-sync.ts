import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function finalSync() {
  console.log('🚀 Lancement de la Synchronisation Finale (Caisse/Banque/Bilan)...');

  // 1. Synchroniser les Magasins (Caisse Physique)
  const magasins = await prisma.magasin.findMany();
  for (const mag of magasins) {
    const agg = await prisma.caisse.aggregate({
        where: { magasinId: mag.id },
        _sum: { montant: true } // Note: Dans cet ERP, le montant semble être signé ou typé (ENTREE/SORTIE)
        // Vérifions d'abord la logique des types de caisse
    });
    
    // Pour cet audit, on va recalculer le solde réel de caisse
    const entrees = await prisma.caisse.aggregate({
        where: { magasinId: mag.id, type: 'ENTREE' },
        _sum: { montant: true }
    });
    const sorties = await prisma.caisse.aggregate({
        where: { magasinId: mag.id, type: 'SORTIE' },
        _sum: { montant: true }
    });
    const soldeReel = (entrees._sum.montant || 0) - (sorties._sum.montant || 0);
    
    await prisma.magasin.update({
        where: { id: mag.id },
        data: { soldeCaisse: soldeReel }
    });
    console.log(`Magasin ${mag.nom} : Solde Caisse mis à jour (${soldeReel} FCFA)`);
  }

  // 2. Suture Comptable (Alignement Bilan)
  // On reprend la logique de suture mais avec les soldes Magasin maintenant accessibles
  console.log('Mise à jour du Bilan Comptable...');
  const banques = await prisma.banque.findMany();
  const totalBanque = banques.reduce((sum, b) => sum + b.soldeActuel, 0);
  const updatedMagasins = await prisma.magasin.findMany();
  const totalCaisse = updatedMagasins.reduce((sum, m) => sum + m.soldeCaisse, 0);
  const stocks = await prisma.stock.findMany({ include: { produit: true } });
  const totalStock = stocks.reduce((sum, st) => sum + (st.quantite * st.produit.pamp), 0);

  // Équilibrage initial
  const journal = await prisma.journal.findFirst({ where: { code: 'OD' } }) || await prisma.journal.findFirst();
  const piece = 'INIT-AUDIT-2026';
  const prefix = `OD-${Date.now()}`;
  
  await prisma.ecritureComptable.deleteMany({ where: { piece: 'INIT-AUDIT-2026' } });

  const cCapital = await prisma.planCompte.findFirst({ where: { numero: '101' } });
  const cStock = await prisma.planCompte.findFirst({ where: { numero: '311' } });
  const cBanque = await prisma.planCompte.findFirst({ where: { numero: '521' } });
  const cCaisse = await prisma.planCompte.findFirst({ where: { numero: '531' } });

  if (cCapital && cStock && cBanque && cCaisse && journal) {
    const totalActif = totalBanque + totalCaisse + totalStock;
    const entries = [
        { num: `${prefix}-1`, lib: 'Suture Audit - Stock Initial', deb: totalStock, cred: 0, cid: cStock.id },
        { num: `${prefix}-2`, lib: 'Suture Audit - Trésorerie Banque', deb: totalBanque, cred: 0, cid: cBanque.id },
        { num: `${prefix}-3`, lib: 'Suture Audit - Trésorerie Caisse', deb: totalCaisse, cred: 0, cid: cCaisse.id },
        { num: `${prefix}-4`, lib: 'Suture Audit - Capitalisation Patrimoine', deb: 0, cred: totalActif, cid: cCapital.id },
    ];
    for (const en of entries) {
        await prisma.ecritureComptable.create({
            data: { numero: en.num, date: new Date(), piece, libelle: en.lib, debit: en.deb, credit: en.cred, compteId: en.cid, journalId: journal.id, entiteId: 1, utilisateurId: 1 }
        });
    }
  }

  console.log('✅ Synchronisation Finale Terminée.');
}

finalSync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
