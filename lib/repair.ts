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
 * RÉPARATION TRÉSORERIE : Recalcule le solde de chaque banque à partir de toutes les opérations.
 */
export async function repairBankIntegrity() {
  const { estTypeOperationBanqueEntree } = await import('./enums-commerce')
  const banques = await prisma.banque.findMany()
  let repairedCount = 0

  for (const b of banques) {
    const operations = await prisma.operationBancaire.findMany({
      where: { banqueId: b.id },
      select: { type: true, montant: true }
    })

    let soldeReel = b.soldeInitial
    for (const op of operations) {
      if (estTypeOperationBanqueEntree(op.type)) {
        soldeReel += op.montant
      } else {
        soldeReel -= op.montant
      }
    }

    if (Math.abs(b.soldeActuel - soldeReel) > 0.01) {
      await prisma.banque.update({
        where: { id: b.id },
        data: { soldeActuel: soldeReel }
      })
      repairedCount++
    }
  }
  return repairedCount
}

/**
 * RÉPARATION CAISSE : Recalcule le soldeCaisse de chaque magasin à partir des mouvements réels.
 */
export async function repairCaisseIntegrity() {
  const magasins = await prisma.magasin.findMany();
  let repairedCount = 0;

  for (const m of magasins) {
    const entrees = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'ENTREE' },
      _sum: { montant: true },
    }))._sum.montant || 0;

    const sorties = (await prisma.caisse.aggregate({
      where: { magasinId: m.id, type: 'SORTIE' },
      _sum: { montant: true },
    }))._sum.montant || 0;

    const soldeReel = entrees - sorties;

    if (Math.abs((m.soldeCaisse || 0) - soldeReel) > 0.01) {
      await prisma.magasin.update({
        where: { id: m.id },
        data: { soldeCaisse: soldeReel },
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
      prisma.client.updateMany({ where: { entiteId: { in: [0] } }, data: { entiteId: eid } }),
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
 * RÉPARATION LIGNES RÈGLEMENTS : Crée les ReglementVenteLigne et ReglementAchatLigne
 * manquantes pour les règlements qui n'ont aucune ligne associée.
 */
export async function repairReglementLigneIntegrity() {
  let venteLignesCreated = 0
  let achatLignesCreated = 0

  const reglementsVente = await prisma.reglementVente.findMany({
    where: { venteId: { not: null } },
    select: { id: true, venteId: true, montant: true }
  })
  for (const rv of reglementsVente) {
    if (!rv.venteId) continue
    const existing = await prisma.reglementVenteLigne.findFirst({
      where: { reglementId: rv.id, venteId: rv.venteId }
    })
    if (!existing) {
      await prisma.reglementVenteLigne.create({
        data: {
          reglementId: rv.id,
          venteId: rv.venteId,
          montant: rv.montant,
        }
      })
      venteLignesCreated++
    }
  }

  const reglementsAchat = await prisma.reglementAchat.findMany({
    where: { achatId: { not: null } },
    select: { id: true, achatId: true, montant: true }
  })
  for (const ra of reglementsAchat) {
    if (!ra.achatId) continue
    const existing = await prisma.reglementAchatLigne.findFirst({
      where: { reglementId: ra.id, achatId: ra.achatId }
    })
    if (!existing) {
      await prisma.reglementAchatLigne.create({
        data: {
          reglementId: ra.id,
          achatId: ra.achatId,
          montant: ra.montant,
        }
      })
      achatLignesCreated++
    }
  }

  return { venteLignesCreated, achatLignesCreated }
}

/**
 * RÉPARATION MONTANT PAYE : Recalcule vente.montantPaye et achat.montantPaye
 * à partir des ReglementLigne (source de vérité).
 */
export async function repairMontantPayeIntegrity() {
  let ventesRepaired = 0
  let achatsRepaired = 0

  const ventes = await prisma.vente.findMany({
    select: { id: true, montantPaye: true }
  })
  for (const v of ventes) {
    const lignes = await prisma.reglementVenteLigne.findMany({
      where: { venteId: v.id },
      select: { montant: true }
    })
    const montantPayeReel = lignes.reduce((s, l) => s + (l.montant || 0), 0)
    if (Math.abs((v.montantPaye || 0) - montantPayeReel) > 0.01) {
      await prisma.vente.update({
        where: { id: v.id },
        data: { montantPaye: montantPayeReel }
      })
      ventesRepaired++
    }
  }

  const achats = await prisma.achat.findMany({
    select: { id: true, montantPaye: true }
  })
  for (const a of achats) {
    const lignes = await prisma.reglementAchatLigne.findMany({
      where: { achatId: a.id },
      select: { montant: true }
    })
    const montantPayeReel = lignes.reduce((s, l) => s + (l.montant || 0), 0)
    if (Math.abs((a.montantPaye || 0) - montantPayeReel) > 0.01) {
      await prisma.achat.update({
        where: { id: a.id },
        data: { montantPaye: montantPayeReel }
      })
      achatsRepaired++
    }
  }

  return { ventesRepaired, achatsRepaired }
}

/**
 * MAIN SELF-HEALING : Lance toutes les réparations
 */
export async function runFullSelfHealing() {
    console.log("Lancement du Self-Healing GestiCom Pro...");
    const vis = await repairVisibility();
    const stocks = await repairStockIntegrity();
    const banks = await repairBankIntegrity();
    const caisses = await repairCaisseIntegrity();
    const lignes = await repairReglementLigneIntegrity();
    const montantPaye = await repairMontantPayeIntegrity();
    
    return {
        visibility: vis,
        stocksRepaired: stocks,
        banksRepaired: banks,
        caissesRepaired: caisses,
        lignesCreated: lignes,
        montantPayeRepaired: montantPaye,
        timestamp: new Date()
    };
}
