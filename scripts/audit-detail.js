const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Ventes : détail des écarts montantPaye
  console.log('=== VENTES montantPaye vs Lignes ===');
  const ventes = await prisma.vente.findMany({ orderBy: { id: 'asc' } });
  for (const v of ventes) {
    const lignes = await prisma.reglementVenteLigne.findMany({ where: { venteId: v.id } });
    const totalLignes = lignes.reduce((s, l) => s + (l.montant || 0), 0);
    const ecart = (v.montantPaye || 0) - totalLignes;
    const reglements = await prisma.reglementVente.findMany({ where: { venteId: v.id } });
    const totalReglements = reglements.reduce((s, r) => s + (r.montant || 0), 0);
    console.log(`Vente#${v.id} ${v.numero} | total=${v.montantTotal} | montantPaye=${v.montantPaye || 0} | totalLignes=${totalLignes} | totalReglements=${totalReglements} | ecart=${ecart}`);
    for (const l of lignes) {
      console.log(`  Ligne venteId=${l.venteId} reglementId=${l.reglementId} montant=${l.montant}`);
    }
    for (const r of reglements) {
      console.log(`  Reglement id=${r.id} montant=${r.montant} mode=${r.modePaiement} statut=${r.statut}`);
    }
  }

  // 2. Achats : détail des écarts montantPaye
  console.log('\n=== ACHATS montantPaye vs Lignes ===');
  const achats = await prisma.achat.findMany({ orderBy: { id: 'asc' } });
  for (const a of achats) {
    const lignes = await prisma.reglementAchatLigne.findMany({ where: { achatId: a.id } });
    const totalLignes = lignes.reduce((s, l) => s + (l.montant || 0), 0);
    const ecart = (a.montantPaye || 0) - totalLignes;
    const reglements = await prisma.reglementAchat.findMany({ where: { achatId: a.id } });
    const totalReglements = reglements.reduce((s, r) => s + (r.montant || 0), 0);
    console.log(`Achat#${a.id} ${a.numero} | total=${a.montantTotal} | montantPaye=${a.montantPaye || 0} | totalLignes=${totalLignes} | totalReglements=${totalReglements} | ecart=${ecart}`);
    for (const l of lignes) {
      console.log(`  Ligne achatId=${l.achatId} reglementId=${l.reglementId} montant=${l.montant}`);
    }
    for (const r of reglements) {
      console.log(`  Reglement id=${r.id} montant=${r.montant} mode=${r.modePaiement} statut=${r.statut}`);
    }
  }

  // 3. Clients : dette calculee (formule exacte des routes)
  console.log('\n=== CLIENTS (formule exacte des routes GET) ===');
  const clients = await prisma.client.findMany({ orderBy: { id: 'asc' } });
  for (const c of clients) {
    const ventesC = await prisma.vente.findMany({ where: { clientId: c.id } });
    const facturesGlobal = ventesC.reduce((s, v) => s + (v.montantTotal || 0), 0);
    const regs = await prisma.reglementVente.findMany({ where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } } });
    const paiementsGlobal = regs.reduce((s, r) => s + (r.montant || 0), 0);
    // Also count reglements libres (sans venteId mais pour ce client)
    const regsLibres = await prisma.reglementVente.findMany({ 
      where: { clientId: c.id, venteId: null, statut: { in: ['VALIDE', 'VALIDEE'] } } 
    });
    const montantLibres = regsLibres.reduce((s, r) => s + (r.montant || 0), 0);
    // Lignes too
    const lignesC = await prisma.reglementVenteLigne.findMany({ where: { vente: { clientId: c.id } } });
    const totalViaLignes = lignesC.reduce((s, l) => s + (l.montant || 0), 0);
    const soldeCalc = facturesGlobal - paiementsGlobal + (c.soldeInitial || 0) - (c.avoirInitial || 0);
    const soldeViaLignes = facturesGlobal - totalViaLignes + (c.soldeInitial || 0) - (c.avoirInitial || 0);
    console.log(`Client ${c.id}: ${c.nom} | soldeInitial=${c.soldeInitial || 0} | avoirInitial=${c.avoirInitial || 0} | facturesTotal=${facturesGlobal} | paiementsViaReglement=${paiementsGlobal} | paiementsViaLignes=${totalViaLignes} | reglementsLibres=${montantLibres} | soldeViaReglement=${soldeCalc} | soldeViaLignes=${soldeViaLignes}`);
  }

  // 4. Fournisseurs
  console.log('\n=== FOURNISSEURS (formule exacte des routes GET) ===');
  const fournisseurs = await prisma.fournisseur.findMany({ orderBy: { id: 'asc' } });
  for (const f of fournisseurs) {
    const achatsF = await prisma.achat.findMany({ where: { fournisseurId: f.id } });
    const achatsTotal = achatsF.reduce((s, a) => s + (a.montantTotal || 0), 0);
    const regs = await prisma.reglementAchat.findMany({ where: { fournisseurId: f.id, statut: { in: ['VALIDE', 'VALIDEE'] } } });
    const paiementsGlobal = regs.reduce((s, r) => s + (r.montant || 0), 0);
    const regsLibres = await prisma.reglementAchat.findMany({ 
      where: { fournisseurId: f.id, achatId: null, statut: { in: ['VALIDE', 'VALIDEE'] } } 
    });
    const montantLibres = regsLibres.reduce((s, r) => s + (r.montant || 0), 0);
    const lignesF = await prisma.reglementAchatLigne.findMany({ where: { achat: { fournisseurId: f.id } } });
    const totalViaLignes = lignesF.reduce((s, l) => s + (l.montant || 0), 0);
    const soldeCalc = achatsTotal - paiementsGlobal + (f.soldeInitial || 0) - (f.avoirInitial || 0);
    const soldeViaLignes = achatsTotal - totalViaLignes + (f.soldeInitial || 0) - (f.avoirInitial || 0);
    console.log(`Fournisseur ${f.id}: ${f.nom} | soldeInitial=${f.soldeInitial || 0} | avoirInitial=${f.avoirInitial || 0} | achatsTotal=${achatsTotal} | paiementsViaReglement=${paiementsGlobal} | paiementsViaLignes=${totalViaLignes} | reglementsLibres=${montantLibres} | soldeViaReglement=${soldeCalc} | soldeViaLignes=${soldeViaLignes}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });