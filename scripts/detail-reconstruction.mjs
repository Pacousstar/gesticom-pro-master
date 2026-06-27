import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const bu = new Database('C:/gesticom1206/gesticom.db');
const prisma = new PrismaClient();

const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId   = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;

const codes = ['ETB-00152', 'ETB-00264', 'ETB-00044', 'DIVE-018', 'NIVE-238', 'TOLE-068', 'ETB-00069', 'TOLE-066'];

for (const code of codes) {
  const pBu = bu.prepare('SELECT id, designation FROM Produit WHERE code = ?').get(code);
  const pCur = await prisma.produit.findFirst({ where: { code } });
  if (!pBu && !pCur) { console.log('\n' + code + ': introuvable'); continue; }

  const sb = pBu ? bu.prepare('SELECT quantite FROM Stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1').get(pBu.id) : null;
  const qteBackup = sb?.quantite ?? 0;

  const ventes = await prisma.vente.findMany({
    where: { id: { gt: maxVenteId }, typeVente: 'LIVRAISON_IMMEDIATE', retraitDiffere: false },
    include: { lignes: { where: { produitId: pCur?.id } } }
  });
  let totalVentes = 0;
  for (const v of ventes) for (const l of v.lignes) totalVentes += l.quantite;

  const achats = await prisma.achat.findMany({
    where: { id: { gt: maxAchatId } },
    include: { lignes: { where: { produitId: pCur?.id } } }
  });
  let totalAchats = 0;
  for (const a of achats) for (const l of a.lignes) totalAchats += l.quantite;

  const entrees = await prisma.mouvement.findMany({
    where: { id: { gt: maxMvtId }, type: 'ENTREE', produitId: pCur?.id, magasinId: 1, OR: [
      { observation: { contains: 'Ajustement' } },
      { observation: { startsWith: 'Retour' } },
      { observation: { startsWith: 'Suppression vente' } }
    ] }
  });
  let totalEntrees = 0, totalSupprPost = 0;
  for (const m of entrees) {
    const num = (m.observation||'').match(/V\d+/);
    const estPost = num && num[0].startsWith('V1782');
    if (m.observation && m.observation.startsWith('Suppression vente') && estPost) {
      totalSupprPost += m.quantite;
    } else {
      totalEntrees += m.quantite;
    }
  }

  const stockActuel = pCur ? (await prisma.stock.findUnique({ where: { produitId_magasinId_entiteId: { produitId: pCur.id, magasinId: 1, entiteId: 1 } } }))?.quantite : 0;
  const nouveau = Math.round((qteBackup + totalAchats + totalEntrees - totalVentes - totalSupprPost) * 100) / 100;

  console.log('\n=== ' + code + ' ' + ((pBu?.designation || pCur?.designation || '').trim()) + ' ===');
  console.log('  Stock backup 12/06:    ' + qteBackup);
  console.log('  + Achats (post 12/06): +' + totalAchats);
  console.log('  + Ajust/Retours:       +' + totalEntrees);
  console.log('  - Ventes (VenteLigne): ' + (-totalVentes));
  console.log('  - Suppr post-backup:   ' + (-totalSupprPost));
  console.log('  = NOUVEAU:             ' + nouveau);
  console.log('  Actuel:                ' + (stockActuel ?? '?'));
  console.log('  Delta:                 ' + Math.round((nouveau - (stockActuel ?? 0)) * 100) / 100);
}

await prisma.$disconnect();
bu.close();
