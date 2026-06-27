import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom2406/gesticom.db');
const prisma = new PrismaClient();

const pId = (await prisma.produit.findFirst({ where: { code: 'ETB-00152' } })).id;

// 1. Quelles ventes V1782 sont dans le backup ?
const ventesBackup = bu.prepare("SELECT numero, date, id FROM Vente WHERE numero LIKE 'V1782%'").all();
const bkSet = new Set(ventesBackup.map(v => v.numero));
console.log('Ventes V1782 dans le backup:', ventesBackup.length);

// 2. Ventes dans current avec CIM IVOIRE
const ventesCurrent = await prisma.vente.findMany({
  where: { numero: { startsWith: 'V1782' } },
  include: { lignes: { where: { produitId: pId } } }
});
const ventesAvecCim = ventesCurrent.filter(v => v.lignes.length > 0);

// 3. Ventes ABSENTES du backup = créées après
const apresBackup = ventesAvecCim.filter(v => !bkSet.has(v.numero));
console.log('\n=== VENTES APRES BACKUP ===');
let totalVentesApres = 0;
for (const v of apresBackup.sort((a,b) => a.date.getTime() - b.date.getTime())) {
  for (const l of v.lignes) {
    console.log(v.date.toISOString().split('T')[0], v.numero, ': qte=' + l.quantite, '| CREATION apres backup');
    totalVentesApres += l.quantite;
  }
}
console.log('Total vendu apres backup:', totalVentesApres, 'U');

// 4. Modifications apres backup (par ID mouvement)
const maxMvtId = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;
console.log('\nMax mouvement ID dans backup:', maxMvtId);

// Tous les mouvements de modif dans current avec id > max backup
const modifsApres = await prisma.mouvement.findMany({
  where: { produitId: pId, magasinId: 1, observation: { startsWith: 'Modif Vente' }, id: { gt: maxMvtId } }
});
console.log('=== MODIFICATIONS APRES BACKUP ===');
let totalModif = 0;
for (const m of modifsApres) {
  console.log('#' + m.id, m.dateOperation.toISOString().split('T')[0], m.observation, ':', m.quantite, 'U');
  totalModif += m.quantite;
}
console.log('Total modif:', totalModif, 'U');

// 5. Achats apres backup
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
console.log('\nMax Achat ID dans backup:', maxAchatId);
const achatsApres = await prisma.achat.findMany({
  where: { id: { gt: maxAchatId } },
  include: { lignes: { where: { produitId: pId } } }
});
console.log('=== ACHATS APRES BACKUP ===');
let totalAchat = 0;
for (const a of achatsApres) {
  for (const l of a.lignes) {
    console.log(a.date.toISOString().split('T')[0], a.numero, ':', l.quantite, 'U');
    totalAchat += l.quantite;
  }
}
console.log('Total achat:', totalAchat, 'U');

// 6. Verification: mouvements ENTREE/SORTIE supplementaires dans current
const totalMouvsApres = await prisma.mouvement.findMany({
  where: { produitId: pId, magasinId: 1, id: { gt: maxMvtId } },
  orderBy: { id: 'asc' }
});
console.log('\n=== TOUS MOUVEMENTS APRES BACKUP ===');
let e = 0, s = 0;
for (const m of totalMouvsApres) {
  const obs = (m.observation || '').substring(0, 50);
  console.log('#' + m.id, m.type.padEnd(6), String(m.quantite).padStart(5), '|', obs);
  if (m.type === 'ENTREE') e += m.quantite; else s += m.quantite;
}
console.log('\nEntree:', e, '| Sortie:', s, '| Net:', e - s);

// 7. Bilan
console.log('\n=== BILAN CIM IVOIRE ===');
console.log('Stock backup 24/06: 944');
console.log('- Ventes apres backup:', -totalVentesApres);
console.log('+ Achats apres backup: +' + totalAchat);
console.log('- Modifs bug:', -totalModif);
const attendu = 944 - totalVentesApres + totalAchat - totalModif;
console.log('= Stock attendu:', attendu);
const stockCur = await prisma.stock.findUnique({
  where: { produitId_magasinId_entiteId: { produitId: pId, magasinId: 1, entiteId: 1 } }
});
console.log('Stock actuel DB:', stockCur.quantite);
console.log('ECART:', attendu - stockCur.quantite);

await prisma.$disconnect();
