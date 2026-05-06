/**
 * scripts/maintenance-runner.js
 * Médecin de bord GestiCom Pro - Version STANDALONE (Zéro dépendance externe)
 * Exécuté automatiquement par le launcher au démarrage/MAJ.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ALLOW_AGGRESSIVE_AUTO_REPAIR = process.env.ALLOW_AGGRESSIVE_AUTO_REPAIR === 'true';
const REBUILD_ECRITURES_FROM = process.env.REBUILD_ECRITURES_FROM || ''; // ex: 2026-01-01
const REBUILD_ECRITURES_ENTITE_ID = process.env.REBUILD_ECRITURES_ENTITE_ID || ''; // optionnel

const fs = require('fs');
const path = require('path');

function safeMkdirp(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

function markerPath(fromDate, entiteId) {
  const base = 'C:\\\\gesticom\\\\maintenance';
  safeMkdirp(base);
  const suffix = entiteId ? `-entite-${entiteId}` : '';
  return path.join(base, `rebuild-ecritures-${fromDate}${suffix}.done`);
}

function parseStartDate(raw) {
  const s = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // début journée locale
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

async function rebuildEcrituresIfRequested() {
  const startDate = parseStartDate(REBUILD_ECRITURES_FROM);
  if (!startDate) return;

  const entiteId = REBUILD_ECRITURES_ENTITE_ID ? Number(REBUILD_ECRITURES_ENTITE_ID) : null;
  const mark = markerPath(REBUILD_ECRITURES_FROM, entiteId ? String(entiteId) : '');
  if (fs.existsSync(mark)) return;

  // On ne tente que si les modules compilés existent (environnement installé / standalone)
  let compta = null;
  try {
    const comptaPath = path.join(__dirname, '..', 'lib', 'comptabilisation.js');
    if (fs.existsSync(comptaPath)) {
      compta = require(comptaPath);
    } else {
      // fallback: certains bundles peuvent résoudre sans extension
      compta = require(path.join(__dirname, '..', 'lib', 'comptabilisation'));
    }
  } catch (e) {
    return;
  }

  const {
    comptabiliserVente,
    comptabiliserAchat,
    comptabiliserReglementVente,
    comptabiliserReglementAchat,
    comptabiliserDepense,
    comptabiliserCharge,
    comptabiliserCaisse,
    comptabiliserMouvementStock,
  } = compta || {};

  if (!comptabiliserVente || !comptabiliserAchat) return;

  try {
    const whereDate = { gte: startDate };
    const whereEntite = entiteId ? { entiteId } : {};

    // VENTES
    const ventes = await prisma.vente.findMany({
      where: { ...whereEntite, statut: { in: ['VALIDE', 'VALIDEE'] }, date: whereDate },
      include: { lignes: true, reglements: { select: { modePaiement: true, montant: true } } },
      orderBy: { date: 'asc' }
    });
    for (const v of ventes) {
      await comptabiliserVente({
        venteId: v.id,
        numeroVente: v.numero,
        date: v.date,
        montantTotal: v.montantTotal,
        modePaiement: v.modePaiement,
        clientId: v.clientId,
        entiteId: v.entiteId,
        utilisateurId: v.utilisateurId,
        magasinId: v.magasinId,
        fraisApproche: v.fraisApproche,
        reglements: (v.reglements || []).map(r => ({ mode: r.modePaiement, montant: r.montant })),
        lignes: (v.lignes || []).map(l => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          coutUnitaire: l.coutUnitaire,
          tva: l.tva,
          remise: l.remise
        }))
      });
    }

    // ACHATS
    if (comptabiliserAchat) {
      const achats = await prisma.achat.findMany({
        where: { ...whereEntite, statut: { in: ['VALIDE', 'VALIDEE'] }, date: whereDate },
        include: { lignes: true, reglements: { select: { modePaiement: true, montant: true } } },
        orderBy: { date: 'asc' }
      });
      for (const a of achats) {
        await comptabiliserAchat({
          achatId: a.id,
          numeroAchat: a.numero,
          date: a.date,
          montantTotal: a.montantTotal,
          fraisApproche: a.fraisApproche,
          modePaiement: a.modePaiement,
          fournisseurId: a.fournisseurId,
          entiteId: a.entiteId,
          utilisateurId: a.utilisateurId,
          magasinId: a.magasinId,
          reglements: (a.reglements || []).map(r => ({ mode: r.modePaiement, montant: r.montant })),
          lignes: (a.lignes || []).map(l => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            remise: l.remise
          }))
        });
      }
    }

    // Règlements (sécurité)
    if (comptabiliserReglementVente) {
      const regsV = await prisma.reglementVente.findMany({
        where: { ...whereEntite, statut: { in: ['VALIDE', 'VALIDEE'] }, date: whereDate },
        include: { vente: { select: { numero: true, entiteId: true } } },
        orderBy: { date: 'asc' }
      });
      for (const r of regsV) {
        await comptabiliserReglementVente({
          reglementId: r.id,
          venteId: r.venteId || 0,
          numeroVente: (r.vente && r.vente.numero) ? r.vente.numero : `AC-CLI-${r.clientId || r.id}`,
          date: r.date,
          montant: r.montant,
          modePaiement: r.modePaiement,
          utilisateurId: r.utilisateurId,
          entiteId: r.entiteId || (r.vente ? r.vente.entiteId : (entiteId || 1))
        });
      }
    }
    if (comptabiliserReglementAchat) {
      const regsA = await prisma.reglementAchat.findMany({
        where: { ...whereEntite, statut: { in: ['VALIDE', 'VALIDEE'] }, date: whereDate },
        include: { achat: { select: { numero: true, entiteId: true } } },
        orderBy: { date: 'asc' }
      });
      for (const r of regsA) {
        await comptabiliserReglementAchat({
          reglementId: r.id,
          achatId: r.achatId || 0,
          numeroAchat: (r.achat && r.achat.numero) ? r.achat.numero : `AC-FOURN-${r.fournisseurId || r.id}`,
          date: r.date,
          montant: r.montant,
          modePaiement: r.modePaiement,
          utilisateurId: r.utilisateurId,
          entiteId: r.entiteId || (r.achat ? r.achat.entiteId : (entiteId || 1))
        });
      }
    }

    // Dépenses / Charges / Caisse
    if (comptabiliserDepense) {
      const deps = await prisma.depense.findMany({ where: { ...whereEntite, date: whereDate }, orderBy: { date: 'asc' } });
      for (const d of deps) {
        await comptabiliserDepense({
          depenseId: d.id,
          date: d.date,
          montant: d.montant,
          categorie: d.categorie,
          libelle: d.libelle,
          modePaiement: d.modePaiement,
          utilisateurId: d.utilisateurId,
          entiteId: d.entiteId,
          magasinId: d.magasinId
        });
      }
    }
    if (comptabiliserCharge) {
      const ch = await prisma.charge.findMany({ where: { ...whereEntite, date: whereDate }, orderBy: { date: 'asc' } });
      for (const c of ch) {
        await comptabiliserCharge({
          chargeId: c.id,
          date: c.date,
          montant: c.montant,
          rubrique: c.rubrique,
          libelle: c.observation || null,
          utilisateurId: c.utilisateurId,
          entiteId: c.entiteId,
          magasinId: c.magasinId,
          modePaiement: c.modePaiement
        });
      }
    }
    if (comptabiliserCaisse) {
      const caisses = await prisma.caisse.findMany({ where: { ...whereEntite, date: whereDate }, orderBy: { date: 'asc' } });
      for (const c of caisses) {
        await comptabiliserCaisse({
          caisseId: c.id,
          date: c.date,
          type: c.type,
          montant: c.montant,
          motif: c.motif,
          utilisateurId: c.utilisateurId,
          entiteId: c.entiteId
        });
      }
    }

    // Stock ajustements (stock initial / inventaire / régul)
    if (comptabiliserMouvementStock) {
      const mvts = await prisma.mouvement.findMany({
        where: {
          ...whereEntite,
          dateOperation: whereDate,
          OR: [
            { observation: { contains: 'Stock initial' } },
            { observation: { contains: 'Inventaire' } },
            { observation: { contains: 'Régul' } },
            { observation: { contains: 'Ajust' } }
          ]
        },
        orderBy: { dateOperation: 'asc' }
      });
      for (const m of mvts) {
        const t = String(m.type).toUpperCase() === 'SORTIE' ? 'SORTIE' : 'ENTREE';
        await comptabiliserMouvementStock({
          produitId: m.produitId,
          magasinId: m.magasinId,
          type: t,
          quantite: m.quantite,
          date: m.dateOperation,
          motif: m.observation || 'Ajustement stock',
          utilisateurId: m.utilisateurId,
          entiteId: m.entiteId,
          mouvementId: m.id
        });
      }
    }

    // Marquer terminé (verrou)
    try { fs.writeFileSync(mark, `done:${new Date().toISOString()}`); } catch (e) { /* ignore */ }
  } catch (e) {
    // Silence: ne doit pas bloquer l'installation
  }
}

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

      // Régularisation intrusive désactivée par défaut en production.
      if (ALLOW_AGGRESSIVE_AUTO_REPAIR && soldeReel < 0) {
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
        const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(String(op.type || '').toUpperCase());
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

      if (ALLOW_AGGRESSIVE_AUTO_REPAIR && soldeReel < 0) {
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

async function reparePaiementsArrondis() {
  try {
    // VENTES: corriger les cas "reste 1F" (ou <= 1) sur l'historique
    const ventes = await prisma.vente.findMany({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true, statutPaiement: true }
    })

    for (const v of ventes) {
      const total = Number(v.montantTotal) || 0
      const paye = Number(v.montantPaye) || 0
      const diff = total - paye
      if (total > 0 && paye > 0 && diff > 0 && diff <= 1) {
        await prisma.vente.update({
          where: { id: v.id },
          data: { montantPaye: total, statutPaiement: 'PAYE' }
        })
      }
    }

    // ACHATS: même logique si besoin
    const achats = await prisma.achat.findMany({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true, statutPaiement: true }
    })
    for (const a of achats) {
      const total = Number(a.montantTotal) || 0
      const paye = Number(a.montantPaye) || 0
      const diff = total - paye
      if (total > 0 && paye > 0 && diff > 0 && diff <= 1) {
        await prisma.achat.update({
          where: { id: a.id },
          data: { montantPaye: total, statutPaiement: 'PAYE' }
        })
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
    // 1. RECALCUL DETTES CLIENTS (soldeRestant = ventes - règlements + soldeInitial - avoirInitial)
    const clients = await prisma.client.findMany();
    for (const client of clients) {
      const clientEntiteFilter = client.entiteId ? { entiteId: client.entiteId } : {};
      const statsVentes = await prisma.vente.aggregate({
        where: { 
          clientId: client.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...clientEntiteFilter
        },
        _sum: { montantTotal: true }
      });

      const statsReglements = await prisma.reglementVente.aggregate({
        where: { 
          clientId: client.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...clientEntiteFilter
        },
        _sum: { montant: true }
      });

      const totalVentes = statsVentes._sum.montantTotal || 0;
      const totalReglements = statsReglements._sum.montant || 0;
      const soldeRestant = (totalVentes - totalReglements) + (client.soldeInitial || 0) - (client.avoirInitial || 0);

      // Log si écart détecté (pas de champ dette en DB, on se contente de vérifier)
      if (soldeRestant !== 0) {
        console.log(`[Maintenance] Client ${client.nom}: solde restant = ${soldeRestant}`);
      }
    }

    // 2. RECALCUL DETTES FOURNISSEURS
    const fournisseurs = await prisma.fournisseur.findMany();
    for (const f of fournisseurs) {
      const fournisseurEntiteFilter = f.entiteId ? { entiteId: f.entiteId } : {};
      const statsAchats = await prisma.achat.aggregate({
        where: { 
          fournisseurId: f.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...fournisseurEntiteFilter
        },
        _sum: { montantTotal: true, fraisApproche: true }
      });

      const statsReglements = await prisma.reglementAchat.aggregate({
        where: { 
          fournisseurId: f.id, 
          statut: { in: ['VALIDE', 'VALIDEE'] },
          ...fournisseurEntiteFilter
        },
        _sum: { montant: true }
      });

      const totalAchats = statsAchats._sum.montantTotal || 0;
      const totalReglements = statsReglements._sum.montant || 0;
      const soldeRestant = (totalAchats - totalReglements) + (f.soldeInitial || 0) - (f.avoirInitial || 0);

      if (soldeRestant !== 0) {
        console.log(`[Maintenance] Fournisseur ${f.nom}: solde restant = ${soldeRestant}`);
      }
    }
  } catch (e) {
    // Silence
  }
}

async function runMaintenance() {
  try {
    // 1. Correction intrusive des écritures historiques (désactivée par défaut).
    if (ALLOW_AGGRESSIVE_AUTO_REPAIR) {
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
    await reparePaiementsArrondis();
    await repareCaisses();
    await repareBanques();
    // await repareStocks(); // Désactivé : Pose problème avec l'historique manuel
    await repareTiers();

    // 4. REBUILD écritures (optionnel, 1 seule fois)
    await rebuildEcrituresIfRequested();

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
