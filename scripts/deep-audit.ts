import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function audit() {
  console.log('--- DÉBUT DE L\'AUDIT PROFOND GESTICOM PRO (SCEAU PRODUCTION) ---')

  const report: any = {
    banque: [],
    ventes: [],
    stocks: {
      negatifs: [],
      desynchronises: []
    },
    bilan: {
      desequilibreGlobal: 0,
      ecrituresIncoherentes: []
    }
  }

  // 1. Audit Banques (Solde vs Opérations)
  const banques = await prisma.banque.findMany()
  for (const b of banques) {
    const lastOp = await prisma.operationBancaire.findFirst({
        where: { banqueId: b.id },
        orderBy: { id: 'desc' }
    });
    const soldeTheo = lastOp ? lastOp.soldeApres : b.soldeInitial;
    
    if (Math.abs(b.soldeActuel - soldeTheo) > 0.01) {
      report.banque.push({ nom: b.nomBanque, table: b.soldeActuel, calcule: soldeTheo, ecart: b.soldeActuel - soldeTheo })
    }
  }

  // 2. Audit Stocks (Physique vs Table)
  const stocks = await prisma.stock.findMany({
    include: { produit: { select: { designation: true } } }
  });
  for (const st of stocks) {
    if (st.quantite < 0) {
        report.stocks.negatifs.push({ produit: st.produit.designation, quantite: st.quantite });
    }
    
    const entrees = await prisma.mouvement.aggregate({
        where: { produitId: st.produitId, magasinId: st.magasinId, type: 'ENTREE' },
        _sum: { quantite: true }
    });
    const sorties = await prisma.mouvement.aggregate({
        where: { produitId: st.produitId, magasinId: st.magasinId, type: 'SORTIE' },
        _sum: { quantite: true }
    });
    const calculReel = (entrees._sum.quantite || 0) - (sorties._sum.quantite || 0);
    
    if (Math.abs(st.quantite - calculReel) > 0.001) {
        report.stocks.desynchronises.push({ produit: st.produit.designation, table: st.quantite, calcule: calculReel });
    }
  }

  // 3. Audit Bilan (Équilibre des Écritures par Référence)
  const ecritures = await prisma.ecritureComptable.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  // Groupement par référence pour vérifier l'équilibre de chaque transaction
  const groups: Record<string, { debit: number, credit: number }> = {};
  for (const ec of ecritures) {
    const key = `${ec.referenceType}-${ec.referenceId}`;
    if (!groups[key]) groups[key] = { debit: 0, credit: 0 };
    groups[key].debit += ec.debit;
    groups[key].credit += ec.credit;
  }
  
  for (const [key, totals] of Object.entries(groups)) {
    if (Math.abs(totals.debit - totals.credit) > 1) {
        report.bilan.ecrituresIncoherentes.push({ ref: key, debit: totals.debit, credit: totals.credit, ecart: totals.debit - totals.credit });
    }
  }

  // 4. Équilibre Global
  const globalAgg = await prisma.ecritureComptable.aggregate({
    _sum: { debit: true, credit: true }
  });
  report.bilan.desequilibreGlobal = (globalAgg._sum.debit || 0) - (globalAgg._sum.credit || 0);

  console.log('--- RAPPORT D\'AUDIT FINAL ---')
  console.log(JSON.stringify(report, null, 2))
  
  const hasErrors = 
    report.banque.length > 0 || 
    report.stocks.negatifs.length > 0 || 
    report.stocks.desynchronises.length > 0 || 
    report.bilan.ecrituresIncoherentes.length > 0 ||
    Math.abs(report.bilan.desequilibreGlobal) > 1;

  if (hasErrors) {
      console.warn('⚠️ AUDIT ÉCHOUÉ : DES ANOMALIES PERSISTENT !');
  } else {
      console.log('✅ AUDIT RÉUSSI : LE SYSTÈME EST PRÊT POUR LA PRODUCTION.');
  }
}

audit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
