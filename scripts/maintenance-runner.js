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

       let soldeReel = 0;
       for (const op of operations) {
         if (op.type === 'ENTREE') soldeReel += op.montant;
         else if (op.type === 'SORTIE') soldeReel -= op.montant;
       }

       if (soldeReel < 0) {
         const montantReparation = Math.abs(soldeReel);

         // 1. Création mouvement de caisse
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

         // 2. Écritures comptables (OD)
         const journalOD = await prisma.journal.findUnique({ where: { code: 'OD' } });
         const compte531 = await prisma.planCompte.findUnique({ where: { numero: '531' } });
         const compte101 = await prisma.planCompte.findUnique({ where: { numero: '101' } });

         if (journalOD && compte531 && compte101) {
           const commonNum = `REGUL-CAISSE-${magasin.code}-${Date.now()}`;
           
           // Débit Caisse (531)
           await prisma.ecritureComptable.create({
             data: {
               numero: `${commonNum}-D`,
               journalId: journalOD.id,
               compteId: compte531.id,
               debit: montantReparation,
               credit: 0,
               libelle: `Régul. Caisse ${magasin.nom} (Auto)`,
               utilisateurId: 1,
               entiteId: magasin.entiteId,
               date: new Date()
             }
           });

           // Crédit Capital (101)
           await prisma.ecritureComptable.create({
             data: {
               numero: `${commonNum}-C`,
               journalId: journalOD.id,
               compteId: compte101.id,
               debit: 0,
               credit: montantReparation,
               libelle: `Régul. Caisse ${magasin.nom} (Auto)`,
               utilisateurId: 1,
               entiteId: magasin.entiteId,
               date: new Date()
             }
           });
         }

         // 3. Correction du champ soldeCaisse
         await prisma.magasin.update({
           where: { id: magasin.id },
           data: { soldeCaisse: 0 }
         });
       }
    }
  } catch (e) {
    // Silence total sauf erreur critique (on pourrait loguer dans un fichier si besoin)
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

      let soldeReel = 0;
      for (const op of operations) {
        const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(op.type);
        if (isEntree) soldeReel += op.montant;
        else soldeReel -= op.montant;
      }

      if (soldeReel < 0) {
        const montantReparation = Math.abs(soldeReel);
        const soldeAvant = banque.soldeActuel;
        const soldeApres = soldeAvant + montantReparation;

        await prisma.operationBancaire.create({
          data: {
            banqueId: banque.id,
            date: new Date(),
            type: 'DEPOT',
            libelle: 'Régularisation solde négatif (Auto-Maintenance)',
            montant: montantReparation,
            soldeAvant: soldeAvant,
            soldeApres: soldeApres,
            utilisateurId: 1,
            observation: 'Correction automatique du solde négatif au démarrage.'
          }
        });

        const journalOD = await prisma.journal.findUnique({ where: { code: 'OD' } });
        const compte521 = await prisma.planCompte.findUnique({ where: { numero: '521' } });
        const compte101 = await prisma.planCompte.findUnique({ where: { numero: '101' } });

        if (journalOD && compte521 && compte101) {
          const commonNum = `REGUL-BANQUE-${banque.id}-${Date.now()}`;
          await prisma.ecritureComptable.create({
            data: {
              numero: `${commonNum}-D`,
              journalId: journalOD.id,
              compteId: compte521.id,
              debit: montantReparation,
              credit: 0,
              libelle: `Régul. Banque ${banque.nomBanque} (Auto)`,
              utilisateurId: 1,
              entiteId: banque.entiteId,
              date: new Date()
            }
          });

          await prisma.ecritureComptable.create({
            data: {
              numero: `${commonNum}-C`,
              journalId: journalOD.id,
              compteId: compte101.id,
              debit: 0,
              credit: montantReparation,
              libelle: `Régul. Banque ${banque.nomBanque} (Auto)`,
              utilisateurId: 1,
              entiteId: banque.entiteId,
              date: new Date()
            }
          });
        }

        await prisma.banque.update({
          where: { id: banque.id },
          data: { soldeActuel: 0 }
        });
      }
    }
  } catch (e) {
    // Silence total
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

    // 3. MÉDECINE DE CAISSE & BANQUE (Auto-correction des soldes négatifs)
    await repareCaisses();
    await repareBanques();

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
