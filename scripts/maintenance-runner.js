/**
 * scripts/maintenance-runner.js
 * Médecin de bord GestiCom Pro - Version STANDALONE (Zéro dépendance externe)
 * Exécuté automatiquement par le launcher au démarrage/MAJ.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repareCaisses() {
  try {
    const magasins = await prisma.magasin.findMany();
    for (const magasin of magasins) {
       const operations = await prisma.caisse.findMany({
         where: { magasinId: magasin.id },
         select: { type: true, montant: true }
       });

       const soldeReel = operations.reduce((acc, op) => {
         return op.type === 'ENTREE' ? acc + op.montant : acc - op.montant;
       }, 0);

       // Toujours synchroniser le solde stocké avec le solde réel
       if (Math.abs(magasin.soldeCaisse - soldeReel) > 0.01) {
         await prisma.magasin.update({
           where: { id: magasin.id },
           data: { soldeCaisse: soldeReel }
         });
       }

       // Si après synchronisation c'est toujours négatif, on régularise à 0
       if (soldeReel < 0) {
         const montantReparation = Math.abs(soldeReel);
         await prisma.caisse.create({
           data: {
             magasinId: magasin.id,
             type: 'ENTREE',
             motif: 'Régularisation solde négatif (Auto-Maintenance)',
             montant: montantReparation,
             utilisateurId: 1,
             entiteId: magasin.entiteId,
             dateOperation: new Date(),
             date: new Date()
           }
         });

         await prisma.magasin.update({
           where: { id: magasin.id },
           data: { soldeCaisse: 0 }
         });
       }
    }
  } catch (e) {
    // Silence
  }
}

async function repareBanques() {
  try {
    const banques = await prisma.banque.findMany();
    for (const banque of banques) {
      const operations = await prisma.operationBancaire.findMany({
        where: { banqueId: banque.id },
        select: { type: true, montant: true }
      });

      const totalMouvements = operations.reduce((acc, op) => {
        const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(op.type);
        return isEntree ? acc + op.montant : acc - op.montant;
      }, 0);

      const soldeReel = banque.soldeInitial + totalMouvements;

      // Toujours synchroniser
      if (Math.abs(banque.soldeActuel - soldeReel) > 0.01) {
        await prisma.banque.update({
          where: { id: banque.id },
          data: { soldeActuel: soldeReel }
        });
      }

      if (soldeReel < 0) {
        const montantReparation = Math.abs(soldeReel);
        await prisma.operationBancaire.create({
          data: {
            banqueId: banque.id,
            date: new Date(),
            type: 'DEPOT',
            libelle: 'Régularisation solde négatif (Auto-Maintenance)',
            montant: montantReparation,
            soldeAvant: 0,
            soldeApres: montantReparation,
            utilisateurId: 1,
            observation: 'Correction automatique du solde négatif.'
          }
        });

        await prisma.banque.update({
          where: { id: banque.id },
          data: { soldeActuel: 0 }
        });
      }
    }
  } catch (e) {
    // Silence
  }
}

async function repareStocks() {
  try {
    const stocks = await prisma.stock.findMany();
    for (const s of stocks) {
      const mouvements = await prisma.mouvement.findMany({
        where: { produitId: s.produitId, magasinId: s.magasinId },
        select: { type: true, quantite: true }
      });

      const quantiteCalculee = mouvements.reduce((acc, m) => {
        const isEntree = ['ENTREE', 'ACHAT', 'RETOUR_CLIENT', 'TRANSFERT_IN', 'AJUSTEMENT_POSITIF', 'INITIAL'].includes(m.type);
        return isEntree ? acc + m.quantite : acc - m.quantite;
      }, 0);

      if (Math.abs(s.quantite - quantiteCalculee) > 0.001) {
        await prisma.stock.update({
          where: { id: s.id },
          data: { quantite: quantiteCalculee }
        });
      }
    }
  } catch (e) {
    // Silence
  }
}

async function repareTiers() {
  try {
    // 1. RECALCUL DETTES CLIENTS
    const clients = await prisma.client.findMany();
    for (const client of clients) {
      // Somme des ventes validées
      const statsVentes = await prisma.vente.aggregate({
        where: { 
          clientId: client.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] } 
        },
        _sum: { montantTotal: true }
      });

      // Somme des règlements validés
      const statsReglements = await prisma.reglementVente.aggregate({
        where: { 
          clientId: client.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] } 
        },
        _sum: { montant: true }
      });

      const totalVentes = statsVentes._sum.montantTotal || 0;
      const totalReglements = statsReglements._sum.montant || 0;
      const detteReelle = totalVentes - totalReglements;

      // Correction si écart détecté
      if (Math.abs((client.dette || 0) - detteReelle) > 0.1) {
        await prisma.client.update({
          where: { id: client.id },
          data: { dette: detteReelle }
        });
      }
    }

    // 2. RECALCUL DETTES FOURNISSEURS
    const fournisseurs = await prisma.fournisseur.findMany();
    for (const f of fournisseurs) {
      // Somme des achats validés
      const statsAchats = await prisma.achat.aggregate({
        where: { 
          fournisseurId: f.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] } 
        },
        _sum: { montantTotal: true, fraisApproche: true }
      });

      // Somme des règlements validés
      const statsReglements = await prisma.reglementAchat.aggregate({
        where: { 
          fournisseurId: f.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] } 
        },
        _sum: { montant: true }
      });

      const totalAchats = (statsAchats._sum.montantTotal || 0) + (statsAchats._sum.fraisApproche || 0);
      const totalReglements = statsReglements._sum.montant || 0;
      const detteReelle = totalAchats - totalReglements;

      // Correction si écart détecté
      if (Math.abs((f.dette || 0) - detteReelle) > 0.1) {
        await prisma.fournisseur.update({
          where: { id: f.id },
          data: { dette: detteReelle }
        });
      }
    }
  } catch (e) {
    // Silence
  }
}

async function runMaintenance() {
  try {
    // 1. DÉTECTION MODE MISE À JOUR (Correctif des décimales historiques)
    const allEntries = await prisma.ecritureComptable.findMany({
      select: { id: true, debit: true, credit: true }
    });
    
    for (const entry of allEntries) {
      const dRounded = Math.round(entry.debit);
      const cRounded = Math.round(entry.credit);
      
      if (entry.debit !== dRounded || entry.credit !== cRounded) {
        await prisma.ecritureComptable.update({
          where: { id: entry.id },
          data: { debit: dRounded, credit: cRounded }
        });
      }
    }

    // 2. INITIALISATION / SYNCHRONISATION DU PLAN COMPTABLE
    const journals = [
      { code: 'VE', libelle: 'Journal des Ventes', type: 'VENTES' },
      { code: 'AC', libelle: 'Journal des Achats', type: 'ACHATS' },
      { code: 'CA', libelle: 'Journal de Caisse', type: 'CAISSE' },
      { code: 'BA', libelle: 'Journal de Banque', type: 'BANQUE' },
      { code: 'OD', libelle: 'Journal des Opérations Diverses', type: 'OD' }
    ];

    for (const j of journals) {
      await prisma.journal.upsert({
        where: { code: j.code },
        update: {},
        create: { ...j, actif: true }
      });
    }

    const comptes = [
      { numero: '101', libelle: 'Capital', classe: '1', type: 'PASSIF' },
      { numero: '311', libelle: 'Stock de marchandises', classe: '3', type: 'ACTIF' },
      { numero: '401', libelle: 'Fournisseurs', classe: '4', type: 'PASSIF' },
      { numero: '411', libelle: 'Clients', classe: '4', type: 'ACTIF' },
      { numero: '521', libelle: 'Banque', classe: '5', type: 'ACTIF' },
      { numero: '531', libelle: 'Caisse', classe: '5', type: 'ACTIF' },
      { numero: '601', libelle: 'Achats de marchandises', classe: '6', type: 'CHARGES' },
      { numero: '603', libelle: 'Variation de stocks', classe: '6', type: 'CHARGES' },
      { numero: '443', libelle: 'État, TVA collectée', classe: '4', type: 'PASSIF' },
      { numero: '445', libelle: 'État, TVA récupérable', classe: '4', type: 'ACTIF' },
      { numero: '701', libelle: 'Ventes de marchandises', classe: '7', type: 'PRODUITS' },
      { numero: '703', libelle: 'Ventes de produits finis', classe: '7', type: 'PRODUITS' }
    ];

    for (const c of comptes) {
      await prisma.planCompte.upsert({
        where: { numero: c.numero },
        update: {},
        create: { ...c, actif: true }
      });
    }

    // 3. MÉDECINE FINANCIÈRE (Auto-correction + Synchronisation)
    await repareCaisses();
    await repareBanques();
    // await repareStocks(); // Désactivé : Pose problème avec l'historique manuel
    await repareTiers();

  } catch (error) {
    // Erreurs ignorées en mode silencieux, le système continue le démarrage
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMaintenance();
}

module.exports = { runMaintenance };
