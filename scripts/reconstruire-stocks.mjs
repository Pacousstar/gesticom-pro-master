import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const BU_PATH = 'C:/gesticom1206/gesticom.db';

// ============================================================
// ETAPE 1 : Lire le backup (stock de base)
// ============================================================
const bu = new Database(BU_PATH);
const stocksBackup = bu.prepare('SELECT produitId, quantite FROM Stock WHERE magasinId = 1 AND entiteId = 1').all();
const produitsBackup = bu.prepare('SELECT id, code, designation FROM Produit').all();
const maxVenteId = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get().maxId;      // 2512
const maxAchatId = bu.prepare('SELECT MAX(id) as maxId FROM Achat').get().maxId;
const maxMvtId   = bu.prepare('SELECT MAX(id) as maxId FROM Mouvement').get().maxId;   // 5249

const buStockMap = {}; for (const s of stocksBackup) buStockMap[s.produitId] = s.quantite;
const buProduitMap = {}; for (const p of produitsBackup) buProduitMap[p.id] = { code: p.code, designation: p.designation };

console.log('=== BACKUP 12/06 ===');
console.log('Max vente ID:', maxVenteId);
console.log('Max achat ID:', maxAchatId);
console.log('Max mouvement ID:', maxMvtId);

// ============================================================
// ETAPE 2 : Lire les ventes post-backup depuis la DB courante
// ============================================================
const prisma = new PrismaClient();

// 2a. VenteLigne pour toutes les LIVRAISON_IMMEDIATE non-retrait crées après le backup
const ventesPostBackup = await prisma.vente.findMany({
  where: { id: { gt: maxVenteId } },
  include: {
    lignes: {
      include: { produit: { select: { code: true, designation: true } } }
    }
  }
});

// Total des quantités vendues par produit (déduction légitime)
const ventesParProduit = {};
for (const v of ventesPostBackup) {
  // Ne déduire le stock que si c'est une LIVRAISON_IMMEDIATE
  if (v.typeVente === 'COMMANDE' || v.retraitDiffere) continue;
  for (const l of v.lignes) {
    const code = l.produit.code;
    ventesParProduit[code] = (ventesParProduit[code] || 0) + l.quantite;
  }
}

console.log('\n=== VENTES POST-BACKUP (LIVRAISON_IMMEDIATE) ===');
console.log('Produits distincts:', Object.keys(ventesParProduit).length);

// 2b. Achats post-backup
const achatsPostBackup = await prisma.achat.findMany({
  where: { id: { gt: maxAchatId } },
  include: {
    lignes: {
      include: { produit: { select: { code: true, designation: true } } }
    }
  }
});

const achatsParProduit = {};
for (const a of achatsPostBackup) {
  for (const l of a.lignes) {
    const code = l.produit.code;
    achatsParProduit[code] = (achatsParProduit[code] || 0) + l.quantite;
  }
}

console.log('\n=== ACHATS POST-BACKUP ===');
console.log('Produits distincts:', Object.keys(achatsParProduit).length);

// 2c. Mouvements ENTREE post-backup (ajustements, retours, suppressions de ventes pré-backup)
// Exclure nos corrections (observation contenant "Correction")
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
  include: { produit: { select: { code: true, designation: true } } }
});

const entreesParProduit = {};
const suppressionsPostBackupParProduit = {};

for (const m of entreesPostBackup) {
  const code = m.produit.code;
  const obs = m.observation || '';

  if (obs.startsWith('Suppression vente')) {
    // Distinguer pré-backup vs post-backup
    // Si le numéro de vente commence par V1782 -> post-backup
    const numMatch = obs.match(/V\d+/);
    const numVente = numMatch ? numMatch[0] : '';
    const estPostBackup = numVente.startsWith('V1782');

    if (estPostBackup) {
      // Post-backup: cette vente a été créée puis supprimée
      // Son VenteLigne n'existe plus (vente supprimée)
      // On traite cette ENTREE comme une déduction (elle annule la création)
      suppressionsPostBackupParProduit[code] = (suppressionsPostBackupParProduit[code] || 0) + m.quantite;
    } else {
      // Pré-backup: cette vente existait dans le backup, le stock est restitué
      entreesParProduit[code] = (entreesParProduit[code] || 0) + m.quantite;
    }
  } else {
    // Ajustements, retours, etc.
    entreesParProduit[code] = (entreesParProduit[code] || 0) + m.quantite;
  }
}

console.log('\n=== ENTREES POST-BACKUP (ajustements, retours, suppressions) ===');
console.log('Produits distincts:', Object.keys(entreesParProduit).length);

// ============================================================
// ETAPE 3 : Calcul du stock reconstitué pour chaque produit
// ============================================================
const resultats = [];

// Produits dans le backup
for (const [pId, qteBackup] of Object.entries(buStockMap)) {
  const p = buProduitMap[parseInt(pId)];
  if (!p) continue;
  const code = p.code;

  const ventes = ventesParProduit[code] || 0;
  const achats = achatsParProduit[code] || 0;
  const entrees = entreesParProduit[code] || 0;
  const suppressionsPost = suppressionsPostBackupParProduit[code] || 0;

  const stockReconstitue = qteBackup + achats + entrees - ventes - suppressionsPost;

  resultats.push({
    code,
    designation: (p.designation || '').trim(),
    stockBackup: qteBackup,
    ventes,
    achats,
    entrees,
    suppressionsPost,
    stockReconstitue
  });
}

// Produits CRÉÉS après le backup (pas dans le backup)
const codesDejaVus = new Set(resultats.map(r => r.code));
for (const [code, ventes] of Object.entries(ventesParProduit)) {
  if (codesDejaVus.has(code)) continue;
  const achats = achatsParProduit[code] || 0;
  const entrees = entreesParProduit[code] || 0;
  const suppressionsPost = suppressionsPostBackupParProduit[code] || 0;
  const stockReconstitue = 0 + achats + entrees - ventes - suppressionsPost;
  resultats.push({ code, designation: '(cree apres backup)', stockBackup: 0, ventes, achats, entrees, suppressionsPost, stockReconstitue });
}

// Trier par différence absolue
resultats.sort((a, b) => Math.abs(b.stockReconstitue - (b.stockBackup + b.achats + b.entrees - b.ventes - b.suppressionsPost)) - Math.abs(a.stockReconstitue - (a.stockBackup + a.achats + a.entrees - a.ventes - a.suppressionsPost)));

// ============================================================
// ETAPE 4 : Comparer avec le stock actuel
// ============================================================
const stocksCurrent = await prisma.stock.findMany({ where: { magasinId: 1, entiteId: 1 } });
const produitsCurrent = await prisma.produit.findMany();
const curStockMap = {};
const curProdMap = {};
for (const p of produitsCurrent) curProdMap[p.id] = p;
for (const s of stocksCurrent) curStockMap[curProdMap[s.produitId]?.code] = s.quantite;

console.log('\n\n==================================================================');
console.log('TABLEAU FINAL: Stock reconstitue vs Stock actuel');
console.log('==================================================================');
console.log('Code\tDesignation\t\tBackup12\t+Ventes\t-Achats\t+Entrees\t-SuppPost\t=Reconstitue\tActuel\tEcart');

let ecartTotal = 0;
for (const r of resultats) {
  const actuel = curStockMap[r.code];
  if (actuel === undefined) continue;
  const ecart = r.stockReconstitue - actuel;
  ecartTotal += ecart;
  console.log(
    r.code + '\t' +
    (r.designation).substring(0, 20).padEnd(20) + '\t' +
    r.stockBackup + '\t\t' +
    '-' + r.ventes + '\t' +
    '+' + r.achats + '\t' +
    '+' + r.entrees + '\t\t' +
    '-' + r.suppressionsPost + '\t\t' +
    '=' + r.stockReconstitue + '\t\t' +
    (actuel ?? '?') + '\t' +
    (ecart > 0 ? '+' : '') + ecart
  );
}
console.log('------------------------------------------------------------------');
console.log('Ecart total (reconstitue - actuel):', ecartTotal);

// Focus sur les produits clés
console.log('\n\n=== PRODUITS CLES ===');
for (const code of ['ETB-00152', 'ETB-00264', 'VERN-218', 'FER-060', 'DIVE-018']) {
  const r = resultats.find(x => x.code === code);
  const actuel = curStockMap[code];
  if (r) {
    console.log(code + ' ' + r.designation);
    console.log('  Backup 12/06: ' + r.stockBackup);
    console.log('  - Ventes: ' + (-r.ventes));
    console.log('  + Achats: ' + r.achats);
    console.log('  + Entrees: ' + r.entrees);
    console.log('  - Suppressions post: ' + (-r.suppressionsPost));
    console.log('  = Reconstitué: ' + r.stockReconstitue);
    console.log('  Actuel: ' + (actuel ?? '?'));
    console.log('  Ecart: ' + (r.stockReconstitue - (actuel ?? 0)));
  } else {
    console.log(code + ': pas dans le resultat');
  }
}

await prisma.$disconnect();
bu.close();
