import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;

const codes = ['ETB-00044','TOLE-072','ETB-00069','ETB-00064','TOLE-066','ETB-00152','ETB-00022','ETB-00264','ETB-00157','ETB-00156'];

for (const code of codes) {
  const pBu = bu.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code);
  const pCur = await prisma.produit.findFirst({ where: { code } });
  const pid = pBu?.id || pCur?.id;
  const design = (pBu?.designation || pCur?.designation || '').trim();
  if (!pid) continue;

  const sb = pBu ? bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pBu.id) : null;
  const stockBackup = sb?.quantite ?? '?';

  const ventesVL = await prisma.vente.findMany({
    where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
    include: { lignes: { where: { produitId: pid } } }
  });
  let totalVL = 0;
  for (const v of ventesVL) for (const l of v.lignes) totalVL += l.quantite;

  const achats = await prisma.achat.findMany({
    where: { id: { gt: bu.prepare('SELECT MAX(id) as m FROM Achat').get().m } },
    include: { lignes: { where: { produitId: pid } } }
  });
  let totalAchats = 0;
  for (const a of achats) for (const l of a.lignes) totalAchats += l.quantite;

  const maxMvt = bu.prepare('SELECT MAX(id) as m FROM Mouvement').get().m;
  const entrees = await prisma.mouvement.findMany({
    where: { id: { gt: maxMvt }, type: 'ENTREE', produitId: pid, magasinId: 1,
      OR: [{ observation: { contains: 'Ajustement' } }, { observation: { startsWith: 'Retour' } }] }
  });
  let totalEntrees = 0;
  for (const m of entrees) totalEntrees += m.quantite;

  const speciaux = await prisma.mouvement.findMany({
    where: { id: { gt: maxMvt }, type: 'SORTIE', produitId: pid, magasinId: 1,
      OR: [{ observation: { startsWith: 'Livraison commande' } }, { observation: { startsWith: 'Retrait vente' } }] }
  });
  let totalLivraison = 0, totalRetrait = 0;

  const stockActuel = pCur ? (await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: pCur.id, magasinId: 1, entiteId: 1 } } }))?.quantite : '?';

  const reconst = stockBackup === '?' ? '?' : Number(stockBackup) + totalAchats + totalEntrees - totalVL;
  const corrige = (reconst === '?' || reconst === '?') ? '?' : Number(reconst);

  // Tableau pour ce produit
  console.log(`\n${code}  ${design}`);
  console.log('─'.repeat(90));
  console.log(`  Stock backup 12/06 : ${stockBackup}`);
  console.log(`  Achats AchatLigne   : +${totalAchats}`);
  console.log(`  Ajustements/Retours : +${totalEntrees}`);
  console.log(`  Ventes LIVRAISON_IMMEDIATE (VenteLigne) : -${totalVL}`);
  console.log(`  = Reconstruction    : ${reconst}`);

  for (const m of speciaux) {
    const type = m.observation.startsWith('Livraison commande') ? 'Livraison commande' : 'Retrait vente';
    const numero = m.observation.replace(/^(Livraison commande|Retrait vente) /, '');
    const d = m.date.toISOString().slice(0,10);
    console.log(`  ${type.padEnd(20)} ${d}  -${String(m.quantite).padStart(5)}  ${numero}`);
    if (m.observation.startsWith('Livraison commande')) totalLivraison += m.quantite;
    else totalRetrait += m.quantite;
  }

  const correct = Number(reconst) - totalLivraison - totalRetrait;
  console.log(`  = Stock réel         : ${correct}`);
  console.log(`  Stock actuel DB      : ${stockActuel}`);
  console.log(`  Delta                : ${Number(stockActuel) - correct}`);
}

await prisma.$disconnect();
bu.close();
