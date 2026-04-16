import { prisma } from './db'

/**
 * RÉPARATION STOCKS : Aligne la table Stock sur l'historique des Mouvements.
 */
export async function repairStockIntegrity() {
  const stocks = await prisma.stock.findMany();
  let repairedCount = 0;

  for (const st of stocks) {
    const mvtAgg = await prisma.mouvement.aggregate({
      where: { produitId: st.produitId, magasinId: st.magasinId },
      _sum: { quantite: true } // Note: type ENTREE est +, type SORTIE est - (à vérifier dans le moteur)
    });
    
    // Si la logique de montant signé n'est pas utilisée dans Mouvement, 
    // il faut calculer Entrées - Sorties manuellement.
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
      await prisma.stock.update({
        where: { id: st.id },
        data: { quantite: calculReel }
      });
      repairedCount++;
    }
  }
  return repairedCount;
}

/**
 * RÉPARATION TRÉSORERIE : Aligne le solde des banques sur la dernière opération connue.
 */
export async function repairBankIntegrity() {
  const banques = await prisma.banque.findMany();
  let repairedCount = 0;

  for (const b of banques) {
    const lastOp = await prisma.operationBancaire.findFirst({
      where: { banqueId: b.id },
      orderBy: { id: 'desc' }
    });
    const soldeReel = lastOp ? lastOp.soldeApres : b.soldeInitial;
    
    if (Math.abs(b.soldeActuel - soldeReel) > 0.01) {
      await prisma.banque.update({
        where: { id: b.id },
        data: { soldeActuel: soldeReel }
      });
      repairedCount++;
    }
  }
  return repairedCount;
}

/**
 * Rattache toutes les données orphelines (entiteId = 0 ou null) à l'entité principale (ID: 1).
 */
export async function repairVisibility() {
  try {
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    if (!entite) return { error: 'Aucune entité trouvée.' }

    const eid = entite.id

    const results = await Promise.all([
      prisma.depense.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.charge.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.ecritureComptable.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.vente.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.achat.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.mouvement.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.client.updateMany({ where: { OR: [{ entiteId: 0 }, { entiteId: null }] }, data: { entiteId: eid } }),
      prisma.fournisseur.updateMany({ where: { OR: [{ entiteId: 0 }, { entiteId: null }] }, data: { entiteId: eid } }),
      prisma.stock.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
      prisma.caisse.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
    ])

    return {
      message: 'Réparation visibilité terminée.',
      repaired: {
        depenses: results[0].count,
        charges: results[1].count,
        ecritures: results[2].count,
        ventes: results[3].count,
        achats: results[4].count,
        mouvements: results[5].count,
      }
    }
  } catch (e) {
    console.error('RepairVisibility Error:', e)
    return { error: String(e) }
  }
}

/**
 * MAIN SELF-HEALING : Lance toutes les réparations
 */
export async function runFullSelfHealing() {
    console.log("🚀 Lancement du Self-Healing GestiCom Pro...");
    const vis = await repairVisibility();
    const stocks = await repairStockIntegrity();
    const banks = await repairBankIntegrity();
    
    return {
        visibility: vis,
        stocksRepaired: stocks,
        banksRepaired: banks,
        timestamp: new Date()
    };
}
