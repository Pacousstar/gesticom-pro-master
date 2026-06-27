import Database from 'better-sqlite3';
const bu = new Database('C:/gesticom1206/gesticom.db');
const debut = '2026-06-12T02:00:00';
const fin = '2026-06-12T08:00:00';

// Mouvements backup CIM IVOIRE (produitId=?)
const p1 = bu.prepare('SELECT id FROM Produit WHERE code = ?').get('ETB-00152');
const p2 = bu.prepare('SELECT id FROM Produit WHERE code = ?').get('ETB-00264');

for (const p of [p1, p2]) {
  const mvts = bu.prepare('SELECT * FROM Mouvement WHERE produitId = ? AND date >= ? AND date < ? AND magasinId = 1').all(p.id, debut, fin);
  console.log(`Produit ${p.id} — ${mvts.length} mouvements entre 02H-08H:`);
  for (const m of mvts) {
    console.log(`  ${m.date} | ${m.type} | ${m.quantite} | ${m.observation || ''}`);
  }
}

// Ventes backup max id
const maxV = bu.prepare('SELECT MAX(id) as maxId FROM Vente').get();
console.log('\nMax vente ID backup:', maxV.maxId);

// Produits backup avec ecart 0
const stocks = bu.prepare('SELECT produitId, quantite FROM Stock WHERE magasinId = 1 AND entiteId = 1').all();
console.log('Total stocks dans backup:', stocks.length);

bu.close();
