import Database from 'better-sqlite3';

const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });
const courante = new Database("F:/gesticom/gesticom.db", { readonly: true });

const debut = new Date('2026-06-11').getTime();
const fin = new Date('2026-06-28').getTime();

// 1. Stock initial depuis la base saine
const stockSaine = {};
for (const r of saine.prepare("SELECT produitId, quantite FROM stock WHERE entiteId = 1").all()) {
  stockSaine[r.produitId] = r.quantite || 0;
}

// 2. Ventes du 11/06 à aujourd'hui
const ventes = {};
for (const r of courante.prepare(`
  SELECT vl.produitId, SUM(vl.quantite) as total
  FROM venteLigne vl JOIN vente v ON v.id = vl.venteId
  WHERE v.date >= ? AND v.date < ? AND v.statut != 'ANNULEE'
  GROUP BY vl.produitId
`).all(debut, fin)) {
  ventes[r.produitId] = r.total || 0;
}

// 3. Achats du 11/06 à aujourd'hui
const achats = {};
for (const r of courante.prepare(`
  SELECT al.produitId, SUM(al.quantite) as total
  FROM achatLigne al JOIN achat a ON a.id = al.achatId
  WHERE a.date >= ? AND a.date < ?
  GROUP BY al.produitId
`).all(debut, fin)) {
  achats[r.produitId] = r.total || 0;
}

// 4. Liste des produits
const produits = {};
for (const r of courante.prepare("SELECT id, code, designation FROM produit").all()) {
  produits[r.id] = r;
}

// 5. Stock actuel dans la table Stock
const stockActuel = {};
for (const r of courante.prepare("SELECT produitId, quantite FROM stock WHERE entiteId = 1").all()) {
  stockActuel[r.produitId] = r.quantite || 0;
}

// 6. Calcul du stock corrigé
console.log('=== RECONSTRUCTION STOCK ===');
console.log('Méthode: stock_corrigé = stock_saine(11/06) + achats(11→27/06) - ventes(11→27/06)');
console.log('');

const resultats = [];
const allIds = new Set([...Object.keys(stockSaine), ...Object.keys(ventes), ...Object.keys(achats)]);

for (const pid of allIds) {
  const id = parseInt(pid);
  const sSaine = stockSaine[id] || 0;
  const sActuel = stockActuel[id] || 0;
  const v = ventes[id] || 0;
  const a = achats[id] || 0;
  
  const stockCorrige = sSaine + a - v;
  
  if (sActuel !== stockCorrige) {
    resultats.push({ id, code: produits[id]?.code || '?', designation: produits[id]?.designation || '?', sSaine, sActuel, a, v, stockCorrige, ecart: stockCorrige - sActuel });
  }
}

resultats.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart));

console.log('Produits où le stock actuel diffère du stock corrigé: ' + resultats.length);
console.log('');
console.log('CODE           DESIGNATION                     StockSaine  StockActuel  Achats  Ventes  StockCorrigé  Écart');
for (const r of resultats.slice(0, 50)) {
  const ecr = r.ecart > 0 ? '+' : '';
  console.log(
    r.code.padEnd(14) +
    (r.designation || '').trim().padEnd(35) +
    String(r.sSaine).padStart(8) +
    String(r.sActuel).padStart(12) +
    String(r.a).padStart(8) +
    String(r.v).padStart(8) +
    String(r.stockCorrige).padStart(12) +
    ecr + String(r.ecart).padStart(7)
  );
}

console.log('');
console.log('RÉSUMÉ:');
const totalSaine = Object.values(stockSaine).reduce((a, b) => a + b, 0);
const totalActuel = Object.values(stockActuel).reduce((a, b) => a + b, 0);
const totalCorrige = resultats.reduce((sum, r) => sum + r.stockCorrige, 0) + 
  Object.keys(stockActuel).filter(k => !resultats.find(r => r.id === parseInt(k))).reduce((sum, k) => sum + stockActuel[k], 0);
console.log('Total stock saine (11/06): ' + totalSaine);
console.log('Total stock actuel: ' + totalActuel);
console.log('Total stock corrigé: ' + totalCorrige);

saine.close();
courante.close();
