import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const code = 'ETB-00264';
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxMvtId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;

const pCur = await prisma.produit.findFirst({ where: { code } });
const pBu = bu.prepare('SELECT id FROM Produit WHERE code = ?').get(code);
const stockBu = bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pBu.id);

console.log('=== CIMAF - ANALYSE ÉCART ===');
console.log('Stock backup 12/06 =', stockBu.quantite);

// 1. Achats AchatLigne
const achats = await prisma.achat.findMany({
  where: { id: { gt: maxAchatId } },
  include: { lignes: { where: { produitId: pCur.id } } }
});
let totalAchats = 0;
for (const a of achats) for (const l of a.lignes) totalAchats += l.quantite;
console.log('Achats (AchatLigne) post-backup = +' + totalAchats);

// 2. ENTREE (ajustements, retours)
const entrees = await prisma.mouvement.findMany({
  where: { id: { gt: maxMvtId }, type: 'ENTREE', produitId: pCur.id, magasinId: 1,
    OR: [{ observation: { contains: 'Ajustement' } }, { observation: { startsWith: 'Retour' } }] }
});
let totalEntrees = 0;
for (const m of entrees) {
  console.log('  ENTREE post-backup: +' + m.quantite + '  ' + (m.observation || ''));
  totalEntrees += m.quantite;
}
console.log('Total ENTREE (hors achats) = +' + totalEntrees);

// 3. VenteLigne LIVRAISON_IMMEDIATE post-backup
const ventes = await prisma.vente.findMany({
  where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
  include: { lignes: { where: { produitId: pCur.id } } }
});
let totalVL = 0, nbVentes = 0;
for (const v of ventes) {
  for (const l of v.lignes) { totalVL += l.quantite; nbVentes++; }
}
console.log('Ventes LIVRAISON_IMMEDIATE (VenteLigne) = -' + totalVL + ' (' + nbVentes + ' lignes)');
console.log('Reconstruction: ' + stockBu.quantite + ' + ' + totalAchats + ' + ' + totalEntrees + ' - ' + totalVL + ' = ' + (stockBu.quantite + totalAchats + totalEntrees - totalVL));

// 4. SORTIES Mouvement 13→25 par catégorie
const mvts = await prisma.mouvement.findMany({
  where: { 
    produitId: pCur.id, magasinId: 1, entiteId: 1,
    date: { gte: new Date('2026-06-13T00:00:00'), lte: new Date('2026-06-25T23:59:59') },
    type: 'SORTIE'
  }
});
let cat = { Vente: 0, Modif: 0, Livraison: 0, Retrait: 0, Autre: 0 };
for (const m of mvts) {
  const obs = m.observation || '';
  if (obs.startsWith('Vente V')) cat.Vente += m.quantite;
  else if (obs.startsWith('Modif Vente')) cat.Modif += m.quantite;
  else if (obs.startsWith('Livraison commande')) cat.Livraison += m.quantite;
  else if (obs.startsWith('Retrait vente')) cat.Retrait += m.quantite;
  else cat.Autre += m.quantite;
}
console.log('\nSORTIES Mouvement 13→25 :');
console.log('  Vente:          -' + cat.Vente);
console.log('  Modif Vente:    -' + cat.Modif + ' (BUG)');
console.log('  Livraison cmd:  -' + cat.Livraison);
console.log('  Retrait vente:  -' + cat.Retrait);
console.log('  Total:          -' + (cat.Vente+cat.Modif+cat.Livraison+cat.Retrait));
console.log('\nExplication ecart:');
const totalMvt = cat.Vente + cat.Modif + cat.Livraison + cat.Retrait;
const stock13 = stockBu.quantite + 5 - 164; // mvmts 12/06
console.log('  Stock 13/06 = ' + stockBu.quantite + ' + 5 - 164 = ' + stock13);
console.log('  Mon calcul: ' + stock13 + ' + ' + (totalAchats+totalEntrees) + ' - ' + totalMvt + ' = ' + (stock13+totalAchats+totalEntrees-totalMvt));
console.log('  Retirer retrait vente (' + cat.Retrait + ') non present dans VenteLigne:');
console.log('  ' + stock13 + ' + ' + (totalAchats+totalEntrees) + ' - (' + totalMvt + ' - ' + cat.Retrait + ') = ' + (stock13+totalAchats+totalEntrees-(totalMvt-cat.Retrait)));

await prisma.$disconnect();
bu.close();
