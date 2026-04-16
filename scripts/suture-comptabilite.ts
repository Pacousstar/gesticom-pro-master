import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function suture() {
  console.log('🚀 Lancement de la Suture Comptable (Patrimoine -> Bilan)...');

  const entiteId = 1; // Défaut
  const utilisateurId = 1; // Admin
  const date = new Date();

  // 1. Récupérer les valeurs réelles
  // A. Trésorerie Banque (Somme de toutes les banques)
  const banques = await prisma.banque.findMany();
  const totalBanque = banques.reduce((sum, b) => sum + b.soldeActuel, 0);

  // B. Trésorerie Caisse (Somme de tous les magasins)
  const magasins = await prisma.magasin.findMany();
  const totalCaisse = magasins.reduce((sum, m) => sum + (m.soldeCaisse || 0), 0);

  // C. Stock (Somme de tous les stocks valorisés au PAMP)
  // Note: On utilise le PAMP du produit
  const stocks = await prisma.stock.findMany({ include: { produit: true } });
  const totalStock = stocks.reduce((sum, st) => sum + (st.quantite * st.produit.pamp), 0);

  console.log(`Valeurs détectées : Banque=${totalBanque}, Caisse=${totalCaisse}, Stock=${totalStock}`);

  // 2. Nettoyer les anciennes écritures d'initialisation pour éviter les doublons
  await prisma.ecritureComptable.deleteMany({
    where: { piece: 'INIT-AUDIT-2026' }
  });

  // 3. Récupérer le journal (Journal des Opérations Diverses ou Général)
  let journal = await prisma.journal.findFirst({ where: { code: 'OD' } });
  if (!journal) {
      journal = await prisma.journal.findFirst();
  }
  if (!journal) throw new Error('Aucun journal comptable trouvé.');

  // 4. Créer l'écriture d'équilibre au Bilan (Partie Double)
  const piece = 'INIT-AUDIT-2026';
  const prefix = `OD-${new Date().getTime()}`;
  
  // Comptes
  const cCapital = await prisma.planCompte.findFirst({ where: { numero: '101' } });
  const cStock = await prisma.planCompte.findFirst({ where: { numero: '311' } });
  const cBanque = await prisma.planCompte.findFirst({ where: { numero: '521' } });
  const cCaisse = await prisma.planCompte.findFirst({ where: { numero: '531' } });

  if (!cCapital || !cStock || !cBanque || !cCaisse) {
    throw new Error('Comptes de base introuvables');
  }

  // Équilibre : Actif (Deb) = Passif (Cred)
  const totalActif = totalBanque + totalCaisse + totalStock;

  // Création individuelle pour gérer les numéros uniques simplement
  const entries = [
    { num: `${prefix}-1`, lib: 'Suture Audit - Stock Initial', deb: totalStock, cred: 0, cid: cStock.id },
    { num: `${prefix}-2`, lib: 'Suture Audit - Trésorerie Banque', deb: totalBanque, cred: 0, cid: cBanque.id },
    { num: `${prefix}-3`, lib: 'Suture Audit - Trésorerie Caisse', deb: totalCaisse, cred: 0, cid: cCaisse.id },
    { num: `${prefix}-4`, lib: 'Suture Audit - Capitalisation Patrimoine', deb: 0, cred: totalActif, cid: cCapital.id },
  ];

  for (const en of entries) {
    await prisma.ecritureComptable.create({
        data: {
            numero: en.num,
            date,
            piece,
            libelle: en.lib,
            debit: en.deb,
            credit: en.cred,
            compteId: en.cid,
            journalId: journal.id,
            entiteId,
            utilisateurId
        }
    });
  }

  console.log(`✅ Suture terminée avec succès. Total Patrimoine Initial: ${totalActif} FCFA.`);
}

suture()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
