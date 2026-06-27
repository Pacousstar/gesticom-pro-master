import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const codes = ['ETB-00152', 'ETB-00264', 'VERN-218'];
const debut13 = new Date('2026-06-13T00:00:00');
const fin25 = new Date('2026-06-25T23:59:59');

function classer(obs) {
  if (!obs) return 'Autre';
  if (obs.startsWith('Vente V')) return 'Vente';
  if (obs.startsWith('Modif Vente V')) return 'Modif Vente (BUG)';
  if (obs.startsWith('Livraison commande V')) return 'Livraison commande';
  if (obs.startsWith('Retrait vente V')) return 'Retrait vente';
  if (obs.startsWith('Achat A')) return 'Achat';
  if (obs.startsWith('Retour client')) return 'Retour client';
  if (obs.startsWith('Ajustement')) return 'Ajustement manuel';
  if (obs.startsWith('Modif Achat A')) return 'Modif Achat';
  if (obs.startsWith('Suppression vente')) return 'Suppression vente';
  return 'Autre: ' + obs.substring(0, 40);
}

for (const code of codes) {
  const pBu = bu.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code);
  const pCur = await prisma.produit.findFirst({ where: { code } });
  const pid = pBu?.id || pCur?.id;
  const design = (pBu?.designation || pCur?.designation || '').trim();
  if (!pid) { console.log(`\n${code} ${design} : introuvable\n`); continue; }

  // Stock backup
  const sb = bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pid);
  const stockBackup = sb?.quantite ?? 0;

  // Mouvements 12/06 02H→23:59
  const mvt12 = await prisma.mouvement.findMany({
    where: {
      produitId: pid, magasinId: 1, entiteId: 1,
      date: { gte: new Date('2026-06-12T02:00:00'), lt: debut13 }
    },
    orderBy: { date: 'asc' }
  });
  let e12 = 0, s12 = 0;
  for (const m of mvt12) { if (m.type === 'ENTREE') e12 += m.quantite; else s12 += m.quantite; }
  const stockStart13 = stockBackup + e12 - s12;

  // Mouvements 13→25
  const mvts = await prisma.mouvement.findMany({
    where: {
      produitId: pid, magasinId: 1, entiteId: 1,
      date: { gte: debut13, lte: fin25 }
    },
    orderBy: { date: 'asc' }
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${code}  ${design}`);
  console.log(`STOCK BACKUP 12/06 (02H) = ${stockBackup}`);
  console.log('='.repeat(80));

  // 12/06
  if (mvt12.length > 0) {
    console.log(`\n--- 12/06 (02H→23:59) ---`);
    for (const m of mvt12) {
      const h = m.date.toISOString().slice(11, 16);
      const signe = m.type === 'ENTREE' ? '+' : '-';
      console.log(`  ${h}  ${signe}${String(m.quantite).padStart(6)}  ${(m.observation || '').padEnd(45)}`);
    }
    console.log(`  Sous-totaux 12/06 : ENTREE +${e12}  SORTIE -${s12}`);
  } else {
    console.log(`\n--- 12/06 (02H→23:59) : aucun mouvement ---`);
  }
  console.log(`  Stock au 13/06 00:00 = ${stockStart13}`);

  // Jour par jour 13→25
  const jourMap = {};
  for (const m of mvts) {
    const j = m.date.toISOString().slice(0, 10);
    if (!jourMap[j]) jourMap[j] = [];
    jourMap[j].push(m);
  }
  const jours = Object.keys(jourMap).sort();

  let totalE = 0, totalS = 0;
  for (const j of jours) {
    console.log(`\n--- ${j} ---`);
    let je = 0, js = 0;
    for (const m of jourMap[j]) {
      const h = m.date.toISOString().slice(11, 16);
      const cat = classer(m.observation || '');
      const signe = m.type === 'ENTREE' ? '+' : '-';
      console.log(`  ${h}  ${signe}${String(m.quantite).padStart(6)}  ${cat.padEnd(22)}  ${(m.observation||'').padEnd(45)}`);
      if (m.type === 'ENTREE') je += m.quantite; else js += m.quantite;
    }
    console.log(`  ──> ENTREE +${je}  SORTIE -${js}`);
    totalE += je; totalS += js;
  }

  // Totaux
  console.log(`\n${'-'.repeat(70)}`);
  console.log(`TOTAUX 13→25`);
  console.log(`  ENTREE total : +${totalE}`);
  console.log(`  SORTIE total : -${totalS}`);
  console.log(`  Stock 12/06 backup : ${stockBackup}`);
  console.log(`  Stock 12/06 (02H→23:59) : +${e12} -${s12} = ${stockBackup + e12 - s12}`);
  console.log(`  Calcul final : ${stockStart13} + ${totalE} - ${totalS} = ${stockStart13 + totalE - totalS}`);

  // Verification DB actuelle
  const stockActuel = pCur ? (await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: pCur.id, magasinId: 1, entiteId: 1 } } }))?.quantite : '?';
  console.log(`  Stock DB actuelle : ${stockActuel}`);
  console.log('');
}

await prisma.$disconnect();
bu.close();
