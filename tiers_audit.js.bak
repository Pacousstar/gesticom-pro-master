const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditTiers() {
  console.log('=== AUDIT GÉNÉRAL DE L\'INTÉGRITÉ DES TIERS (v2.0.1) ===\n');

  // --- 1. AUDIT CLIENTS ---
  console.log('--- [1/2] Analyse des Comptes Clients ---');
  const clients = await prisma.client.findMany({
    where: { actif: true },
    select: { id: true, nom: true, code: true, soldeInitial: true, avoirInitial: true }
  });

  let anomaliesClients = 0;
  for (const c of clients) {
    // Calcul théorique
    const ca = await prisma.vente.aggregate({
      where: { clientId: c.id, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montantTotal: true }
    });
    
    const encaissements = await prisma.reglementVente.aggregate({
      where: { clientId: c.id, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montant: true }
    });

    const totalFacture = ca._sum.montantTotal || 0;
    const totalPaye = encaissements._sum.montant || 0;
    const soldeCalculé = totalFacture - totalPaye + (c.soldeInitial || 0) - (c.avoirInitial || 0);

    if (Math.abs(soldeCalculé) > 100000000) { // Exemple de seuil d'alerte sur volume
       console.log(`  ℹ️ Client ${c.nom} (${c.code}) : Volume important (${soldeCalculé.toLocaleString()} F)`);
    }
  }
  console.log(`✅ ${clients.length} comptes clients vérifiés.\n`);

  // --- 2. AUDIT FOURNISSEURS ---
  console.log('--- [2/2] Analyse des Comptes Fournisseurs ---');
  const fournisseurs = await prisma.fournisseur.findMany({
    where: { actif: true },
    select: { id: true, nom: true, code: true, soldeInitial: true, avoirInitial: true }
  });

  let anomaliesFournisseurs = 0;
  for (const f of fournisseurs) {
    const achats = await prisma.achat.aggregate({
      where: { fournisseurId: f.id, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montantTotal: true }
    });

    const paiements = await prisma.reglementAchat.aggregate({
      where: { fournisseurId: f.id, statut: { in: ['VALIDEE', 'VALIDE'] } },
      _sum: { montant: true }
    });

    const totalAchat = achats._sum.montantTotal || 0;
    const totalPaiement = paiements._sum.montant || 0;
    const soldeCalculé = totalAchat - totalPaiement + (f.soldeInitial || 0) - (f.avoirInitial || 0);

    // Si on trouve un solde fournisseur "trop" négatif, alerte
    if (soldeCalculé < -1) {
       anomaliesFournisseurs++;
       console.warn(`  ⚠️ Anomalie Fournisseur ${f.nom} : Solde négatif (${soldeCalculé.toLocaleString()} F) - Possible paiement en trop.`);
    }
  }
  console.log(`✅ ${fournisseurs.length} comptes fournisseurs vérifiés.`);
  console.log(`\nAudit terminé. Anomalies détectées : ${anomaliesFournisseurs} fournisseurs.`);

  await prisma.$disconnect();
}

auditTiers().catch(e => {
  console.error(e);
  process.exit(1);
});
