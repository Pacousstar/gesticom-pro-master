import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function finalInspection() {
  console.log('--- 🛡️ GRANDE PARADE D\'AUDIT FINAL GESTICOM PRO ---');
  
  try {
    // 1. Équilibrage Bilan (Comptabilité)
    const agg = await prisma.ecritureComptable.aggregate({ _sum: { debit: true, credit: true } });
    const ecart = (agg._sum.debit || 0) - (agg._sum.credit || 0);
    const balanceStatus = Math.abs(ecart) < 0.1 ? '✅ PARFAIT (Équilibré)' : `⚠️ ÉCART (${ecart})`;

    // 2. Parité Stocks (Logistique)
    const sTable = await prisma.stock.aggregate({ _sum: { quantite: true } });
    
    const entrees = await prisma.mouvement.aggregate({ where: { type: 'ENTREE' }, _sum: { quantite: true } });
    const sorties = await prisma.mouvement.aggregate({ where: { type: 'SORTIE' }, _sum: { quantite: true } });
    const soldeMvts = (entrees._sum.quantite || 0) - (sorties._sum.quantite || 0);
    
    const stockStatus = Math.abs((sTable._sum.quantite || 0) - soldeMvts) < 0.1 
        ? '✅ SYNC (Physique = Historique)' 
        : `⚠️ DESYNC (Table: ${sTable._sum.quantite}, Mvts: ${soldeMvts})`;

    // 3. Parité Trésorerie (Banque/Caisse -> Bilan)
    const bTable = await prisma.banque.aggregate({ _sum: { soldeActuel: true } });
    const cTable = await prisma.magasin.aggregate({ _sum: { soldeCaisse: true } });
    const tresoPhysique = (bTable._sum.soldeActuel || 0) + (cTable._sum.soldeCaisse || 0);
    
    // On récupère le solde comptable (Classe 5)
    let tresoCompta = 0;
    const comps = await prisma.planCompte.findMany({ where: { numero: { startsWith: '5' } } });
    for (const c of comps) {
        const a = await prisma.ecritureComptable.aggregate({ where: { compteId: c.id }, _sum: { debit: true, credit: true } });
        tresoCompta += (a._sum.debit || 0) - (a._sum.credit || 0);
    }
    const tresoStatus = Math.abs(tresoPhysique - tresoCompta) < 1 
        ? '✅ SYNC (Réel = Comptable)' 
        : `⚠️ DESYNC (Réel: ${tresoPhysique}, Compta: ${tresoCompta})`;

    console.log('1. ÉTAT DU BILAN     :', balanceStatus);
    console.log('2. ÉTAT DES STOCKS    :', stockStatus);
    console.log('3. ÉTAT TRÉSORERIE    :', tresoStatus);
    console.log('----------------------------------------------------');
    
    if (!balanceStatus.includes('⚠️') && !stockStatus.includes('⚠️') && !tresoStatus.includes('⚠️')) {
        console.log('🏆 GESTICOM PRO EST OFFICIELLEMENT CERTIFIÉ "ZERO ERREUR".');
    } else {
        console.log('❌ ÉCHEC DE LA CERTIFICATION : DES ANOMALIES SUBSISTENT.');
    }

  } catch (err) {
    console.error('Erreur pendant l\'audit :', err);
  }
}

finalInspection()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
