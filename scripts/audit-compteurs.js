const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TYPES_ENTREE = ['DEPOT','VIREMENT_ENTRANT','INTERETS','REGLEMENT_CLIENT','VENTE','ENTREE','REVENU'];

async function main() {
  // 1. Banques
  console.log('=== BANQUES ===');
  const banques = await prisma.banque.findMany({ orderBy: { id: 'asc' } });
  for (const b of banques) {
    const ops = await prisma.operationBancaire.findMany({ where: { banqueId: b.id } });
    const entrees = ops.filter(o => TYPES_ENTREE.includes(o.type.toUpperCase())).reduce((s,o) => s + o.montant, 0);
    const sorties = ops.filter(o => !TYPES_ENTREE.includes(o.type.toUpperCase())).reduce((s,o) => s + o.montant, 0);
    const calcule = entrees - sorties;
    console.log(`Banque ${b.id}: ${b.nomBanque} | soldeActuel=${b.soldeActuel} | soldeinitial=${b.soldeInitial || 0} | calcule(SoldeInit+E-S)=${(b.soldeInitial || 0) + calcule} | ECART=${b.soldeActuel - ((b.soldeInitial || 0) + calcule)} | nbOps=${ops.length}`);
    for (const o of ops.sort((a,b) => a.id - b.id)) {
      const dir = TYPES_ENTREE.includes(o.type.toUpperCase()) ? 'E' : 'S';
      console.log(`  Op#${o.id} ${o.date.toISOString().slice(0,10)} ${dir} ${o.type} montant=${o.montant} soldeAvant=${o.soldeAvant} soldeApres=${o.soldeApres} ref=${o.reference||'-'} benef=${o.beneficiaire||'-'}`);
    }
  }

  // 2. Caisses
  console.log('\n=== CAISSES ===');
  const magasins = await prisma.magasin.findMany({ orderBy: { id: 'asc' } });
  for (const m of magasins) {
    const ops = await prisma.caisse.findMany({ where: { magasinId: m.id } });
    const entrees = ops.filter(o => o.type === 'ENTREE').reduce((s,o) => s + o.montant, 0);
    const sorties = ops.filter(o => o.type === 'SORTIE').reduce((s,o) => s + o.montant, 0);
    const calcule = entrees - sorties;
    const solde = m.soldeCaisse || 0;
    console.log(`Magasin ${m.id}: ${m.nom} | soldeCaisse=${solde} | calcule(E-S)=${calcule} | ECART=${solde - calcule} | nbOps=${ops.length}`);
    for (const o of ops.sort((a,b) => a.id - b.id)) {
      console.log(`  Op#${o.id} ${o.date.toISOString().slice(0,10)} ${o.type} montant=${o.montant} motif=${o.motif}`);
    }
  }

  // 3. Clients
  console.log('\n=== CLIENTS ===');
  const clients = await prisma.client.findMany({ orderBy: { id: 'asc' } });
  for (const c of clients) {
    const ventes = await prisma.vente.findMany({ where: { clientId: c.id } });
    const totalVentes = ventes.reduce((s,v) => s + (v.montantTotal || 0), 0);
    const reglLignes = await prisma.reglementVenteLigne.findMany({ where: { vente: { clientId: c.id } } });
    const totalPaye = reglLignes.reduce((s,l) => s + (l.montant || 0), 0);
    const dette = (c.soldeInitial || 0) + totalVentes - totalPaye - (c.avoirInitial || 0);
    console.log(`Client ${c.id}: ${c.nom} | soldeDeclare=${c.solde || 0} | detteCalc=${dette} | ECART=${(c.solde || 0) - dette}`);
  }

  // 4. Fournisseurs
  console.log('\n=== FOURNISSEURS ===');
  const fournisseurs = await prisma.fournisseur.findMany({ orderBy: { id: 'asc' } });
  for (const f of fournisseurs) {
    const achats = await prisma.achat.findMany({ where: { fournisseurId: f.id } });
    const totalAchats = achats.reduce((s,a) => s + (a.montantTotal || 0), 0);
    const reglLignes = await prisma.reglementAchatLigne.findMany({ where: { achat: { fournisseurId: f.id } } });
    const totalPaye = reglLignes.reduce((s,l) => s + (l.montant || 0), 0);
    const dette = (f.soldeInitial || 0) + totalAchats - totalPaye;
    console.log(`Fournisseur ${f.id}: ${f.nom} | soldeDeclare=${f.solde || 0} | detteCalc=${dette} | ECART=${(f.solde || 0) - dette}`);
  }

  // 5. Ventes montantPaye
  console.log('\n=== VENTES montantPaye ===');
  const ventes = await prisma.vente.findMany({ orderBy: { id: 'asc' } });
  for (const v of ventes) {
    const lignes = await prisma.reglementVenteLigne.findMany({ where: { venteId: v.id } });
    const totalLignes = lignes.reduce((s,l) => s + (l.montant || 0), 0);
    const ecart = (v.montantPaye || 0) - totalLignes;
    if (ecart !== 0) console.log(`Vente#${v.id} ${v.numero || ''} | total=${v.montantTotal || 0} | montantPayeDeclare=${v.montantPaye || 0} | montantPayeLignes=${totalLignes} | ECART=${ecart}`);
    else console.log(`Vente#${v.id} ${v.numero || ''} | total=${v.montantTotal || 0} | montantPayeDeclare=${v.montantPaye || 0} | montantPayeLignes=${totalLignes} | OK`);
  }

  // 6. Achats montantPaye
  console.log('\n=== ACHATS montantPaye ===');
  const achats = await prisma.achat.findMany({ orderBy: { id: 'asc' } });
  for (const a of achats) {
    const lignes = await prisma.reglementAchatLigne.findMany({ where: { achatId: a.id } });
    const totalLignes = lignes.reduce((s,l) => s + (l.montant || 0), 0);
    const ecart = (a.montantPaye || 0) - totalLignes;
    if (ecart !== 0) console.log(`Achat#${a.id} ${a.numero || ''} | total=${a.montantTotal || 0} | montantPayeDeclare=${a.montantPaye || 0} | montantPayeLignes=${totalLignes} | ECART=${ecart}`);
    else console.log(`Achat#${a.id} ${a.numero || ''} | total=${a.montantTotal || 0} | montantPayeDeclare=${a.montantPaye || 0} | montantPayeLignes=${totalLignes} | OK`);
  }

  // 7. Stats
  console.log('\n=== STATS ===');
  console.log(`OpsBancaire: ${await prisma.operationBancaire.count()}`);
  console.log(`OperationsCaisse: ${await prisma.caisse.count()}`);
  console.log(`Ventes: ${await prisma.vente.count()}`);
  console.log(`Achats: ${await prisma.achat.count()}`);
  console.log(`Charges: ${await prisma.charge.count()}`);
  console.log(`Depenses: ${await prisma.depense.count()}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });