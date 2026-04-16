/**
 * scripts/maintenance-runner.js
 * Médecin de bord GestiCom Pro - Version STANDALONE (Zéro dépendance externe)
 * Exécuté automatiquement par le launcher au démarrage/MAJ.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMaintenance() {
  console.log('\n[Auto-Maintenance] Démarrage de la stabilisation du système...');
  
  try {
    // 1. DÉTECTION MODE MISE À JOUR (Correctif des décimales historiques)
    console.log('[Auto-Maintenance] Vérification de l\'intégrité des calculs...');
    const allEntries = await prisma.ecritureComptable.findMany({
      select: { id: true, debit: true, credit: true }
    });
    
    let fixedCount = 0;
    for (const entry of allEntries) {
      const dRounded = Math.round(entry.debit);
      const cRounded = Math.round(entry.credit);
      
      if (entry.debit !== dRounded || entry.credit !== cRounded) {
        await prisma.ecritureComptable.update({
          where: { id: entry.id },
          data: { debit: dRounded, credit: cRounded }
        });
        fixedCount++;
      }
    }
    if (fixedCount > 0) console.log(`[Auto-Maintenance] ✅ Arrondi fiscal appliqué sur ${fixedCount} écritures.`);

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

    console.log('[Auto-Maintenance] ✅ Système stabilisé et prêt pour exploitation.');

  } catch (error) {
    console.error('[Auto-Maintenance] ❌ Erreur de stabilisation :', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMaintenance();
}

module.exports = { runMaintenance };
