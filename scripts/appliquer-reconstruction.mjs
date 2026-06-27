import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const BU_PATH = 'C:/gesticom1206/gesticom.db';

// ============================================================
// ETAPE 1 : Stock de base du backup (12/06)
// ============================================================
const bu = new Database(BU_PATH);
const stocksBackup = bu.prepare('SELECT produitId, quantite FROM Stock WHERE magasinId = 1 AND entiteId = 1').all();
const produitsBackup = bu.prepare('SELECT id, code, designation FROM Produit').all();
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId   = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;

const buStockMap = {}; for (const s of stocksBackup) buStockMap[s.produitId] = s.quantite;
const buProduitMap = {}; for (const p of produitsBackup) buProduitMap[p.id] = p.code;

// ============================================================
// ETAPE 2 : Ventes, achats, entrees post-backup depuis la DB courante
// ============================================================
const prisma = new PrismaClient();

// 2a. VenteLigne LIVRAISON_IMMEDIATE post-backup
const ventesPostBackup = await prisma.vente.findMany({
  where: { id: { gt: maxVenteId } },
  include: { lignes: { include: { produit: { select: { code: true } } } } }
});

const ventesParProduit = {};
for (const v of ventesPostBackup) {
  if (v.typeVente === 'COMMANDE' || v.retraitDiffere) continue;
  for (const l of v.lignes) {
    const code = l.produit.code;
    ventesParProduit[code] = (ventesParProduit[code] || 0) + l.quantite;
  }
}

// 2b. Achats post-backup
const achatsPostBackup = await prisma.achat.findMany({
  where: { id: { gt: maxAchatId } },
  include: { lignes: { include: { produit: { select: { code: true } } } } }
});

const achatsParProduit = {};
for (const a of achatsPostBackup) {
  for (const l of a.lignes) {
    const code = l.produit.code;
    achatsParProduit[code] = (achatsParProduit[code] || 0) + l.quantite;
  }
}

// 2c. Mouvements ENTREE post-backup (hors achats, hors nos corrections)
const entreesPostBackup = await prisma.mouvement.findMany({
  where: {
    id: { gt: maxMvtId },
    type: 'ENTREE',
    OR: [
      { observation: { contains: 'Ajustement' } },
      { observation: { startsWith: 'Suppression vente' } },
      { observation: { startsWith: 'Retour' } }
    ]
  },
  include: { produit: { select: { code: true } } }
});

const entreesParProduit = {};
const supprPostParProduit = {};

for (const m of entreesPostBackup) {
  const code = m.produit.code;
  const obs = m.observation || '';
  if (obs.startsWith('Suppression vente')) {
    const numVente = (obs.match(/V\d+/) || [''])[0];
    if (numVente.startsWith('V1782')) {
      // Vente creee APRES le backup, puis supprimee
      // On traite cette entree comme deduction (elle annule la creation)
      supprPostParProduit[code] = (supprPostParProduit[code] || 0) + m.quantite;
    } else {
      // Vente existait DANS le backup, stock restitue
      entreesParProduit[code] = (entreesParProduit[code] || 0) + m.quantite;
    }
  } else {
    entreesParProduit[code] = (entreesParProduit[code] || 0) + m.quantite;
  }
}

// ============================================================
// ETAPE 3 : Calcul du stock reconstitué
// ============================================================
const stockReconstitue = {};

// Produits dans le backup
for (const [pId, qteBackup] of Object.entries(buStockMap)) {
  const code = buProduitMap[parseInt(pId)];
  if (!code) continue;
  const ventes = ventesParProduit[code] || 0;
  const achats = achatsParProduit[code] || 0;
  const entrees = entreesParProduit[code] || 0;
  const supprPost = supprPostParProduit[code] || 0;
  stockReconstitue[code] = qteBackup + achats + entrees - ventes - supprPost;
}

// Produits crees apres le backup
for (const code of Object.keys(ventesParProduit)) {
  if (stockReconstitue[code] !== undefined) continue;
  const achats = achatsParProduit[code] || 0;
  const entrees = entreesParProduit[code] || 0;
  const supprPost = supprPostParProduit[code] || 0;
  const ventes = ventesParProduit[code] || 0;
  stockReconstitue[code] = achats + entrees - ventes - supprPost;
}

// ============================================================
// ETAPE 4 : Appliquer les corrections dans la DB
// ============================================================
const produits = await prisma.produit.findMany();
const produitMap = {}; for (const p of produits) produitMap[p.code] = p;

const corrections = [];
const stocksCurrent = await prisma.stock.findMany({ where: { magasinId: 1, entiteId: 1 } });
const curStockMap = {};
for (const s of stocksCurrent) {
  const p = produitMap[Object.keys(produitMap).find(k => produitMap[k]?.id === s.produitId)];
  if (p) curStockMap[p.code] = s;
}

for (const [code, nouveauStock] of Object.entries(stockReconstitue)) {
  const current = curStockMap[code];
  if (!current) continue;
  const delta = Math.round((nouveauStock - current.quantite) * 100) / 100;
  if (delta === 0) continue;
  corrections.push({ code, produitId: current.produitId, stockActuel: current.quantite, nouveauStock, delta });
}

console.log('=== PRODUITS A CORRIGER ===');
console.log('Code\\tDesignation\\tActuel\\tNouveau\\tDelta');
const produitsNoms = {}; for (const p of produits) produitsNoms[p.id] = p.designation;
for (const c of corrections) {
  console.log(c.code + '\\t' + (produitsNoms[c.produitId] || '').substring(0,25) + '\\t' + c.stockActuel + '\\t' + c.nouveauStock + '\\t' + (c.delta > 0 ? '+' : '') + c.delta);
}
console.log('\\nTotal produits a corriger:', corrections.length);

// Confirmation
console.log('\\nPour appliquer, reexecuter avec: node scripts/appliquer-reconstruction.mjs APPLY');

if (process.argv.includes('APPLY')) {
  console.log('\\n=== APPLICATION DES CORRECTIONS ===');
  let applique = 0;
  for (const c of corrections) {
    await prisma.$transaction(async (tx) => {
      // Mouvement d'ajustement
      const type = c.delta > 0 ? 'ENTREE' : 'SORTIE';
      await tx.mouvement.create({
        data: {
          type,
          quantite: Math.abs(c.delta),
          produitId: c.produitId,
          magasinId: 1,
          entiteId: 1,
          utilisateurId: 1,
          observation: 'Correction reconstruction stocks (backup 12/06 -> 25/06)',
          dateOperation: new Date()
        }
      });
      // Mise a jour stock
      await tx.stock.updateMany({
        where: { produitId: c.produitId, magasinId: 1, entiteId: 1 },
        data: { quantite: c.nouveauStock }
      });
    });
    applique++;
    if (applique % 50 === 0) console.log(applique + ' produits traites...');
  }
  console.log('Correction terminee:', applique, 'produits mis a jour');
} else {
  console.log('\\nMode simulation seulement. Ajoutez APPLY en argument pour executer.');
}

await prisma.$disconnect();
bu.close();
