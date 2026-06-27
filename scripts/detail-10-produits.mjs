import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;

const codes = ['ETB-00044','TOLE-072','ETB-00069','ETB-00064','TOLE-066','ETB-00152','ETB-00022','ETB-00264','ETB-00157','ETB-00156'];

for (const code of codes) {
  const pBu = bu.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code);
  const pCur = await prisma.produit.findFirst({ where: { code } });
  const pid = pBu?.id || pCur?.id;
  const design = (pBu?.designation || pCur?.designation || '').trim();
  if (!pid) { console.log(`\n${code} ${design} : introuvable\n`); continue; }

  const sb = pBu ? bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pBu.id) : null;
  const stockBackup = sb?.quantite ?? '?';

  // VenteLigne reconstruction
  const ventesVL = await prisma.vente.findMany({
    where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
    include: { lignes: { where: { produitId: pid } } }
  });
  let totalVL = 0, nbVL = 0;
  for (const v of ventesVL) for (const l of v.lignes) { totalVL += l.quantite; nbVL++; }

  // Achats AchatLigne
  const achats = await prisma.achat.findMany({
    where: { id: { gt: maxAchatId } },
    include: { lignes: { where: { produitId: pid } } }
  });
  let totalAchats = 0;
  for (const a of achats) for (const l of a.lignes) totalAchats += l.quantite;

  // ENTREE (ajustements, retours, suppressions)
  const entrees = await prisma.mouvement.findMany({
    where: { id: { gt: maxMvtId }, type: 'ENTREE', produitId: pid, magasinId: 1,
      OR: [{ observation: { contains: 'Ajustement' } }, { observation: { startsWith: 'Retour' } }] }
  });
  let totalEntrees = 0;
  for (const m of entrees) totalEntrees += m.quantite;

  // Livraison commande + Retrait vente
  const speciaux = await prisma.mouvement.findMany({
    where: { id: { gt: maxMvtId }, type: 'SORTIE', produitId: pid, magasinId: 1,
      OR: [{ observation: { startsWith: 'Livraison commande' } }, { observation: { startsWith: 'Retrait vente' } }] }
  });
  let totalLivraison = 0, totalRetrait = 0;
  for (const m of speciaux) {
    if (m.observation.startsWith('Livraison commande')) totalLivraison += m.quantite;
    else totalRetrait += m.quantite;
  }

  // Stock actuel
  const stockActuel = pCur ? (await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: pCur.id, magasinId: 1, entiteId: 1 } } }))?.quantite : '?';

  // Reconstruction base
  const reconst = stockBackup === '?' ? '?' : Number(stockBackup) + totalAchats + totalEntrees - totalVL;
  const corrige = reconst === '?' ? '?' : Number(reconst) - totalLivraison - totalRetrait;

  console.log(`=== ${code}  ${design} ===`);
  console.log(`  Stock backup 12/06     : ${stockBackup}`);
  console.log(`  + Achats (AchatLigne)  : +${totalAchats} (${achats.length} achats)`);
  console.log(`  + Ajust/Retours        : +${totalEntrees} (${entrees.length} mouvements)`);
  console.log(`  - Ventes LIVRAISON_IMMEDIATE : -${totalVL} (${nbVL} lignes)`);
  console.log(`  = Reconstruction       : ${reconst}`);
  console.log(`  - Livraison commande   : -${totalLivraison}`);
  console.log(`  - Retrait vente        : -${totalRetrait}`);
  console.log(`  = Stock réel           : ${corrige}`);
  console.log(`  Stock actuel DB        : ${stockActuel}`);
  if (corrige !== '?' && stockActuel !== '?') {
    const diff = Math.round((Number(corrige) - Number(stockActuel)) * 100) / 100;
    console.log(`  Delta (corrigé - DB)   : ${diff > 0 ? '+' : ''}${diff}`);
  }

  // Details Livraison/Retrait
  if (speciaux.length > 0) {
    console.log(`  Détail mouvements spéciaux :`);
    for (const m of speciaux) {
      const type = m.observation.startsWith('Livraison commande') ? 'Livraison' : 'Retrait';
      const d = m.date.toISOString().slice(0,10);
      console.log(`    ${d}  ${type}  -${m.quantite}  ${m.observation}`);
    }
  }
  console.log('');
}

await prisma.$disconnect();
bu.close();
