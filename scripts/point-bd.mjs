import Database from 'better-sqlite3';
const db = new Database("F:/gesticom/gesticom.db", { readonly: true });

// 1. Basic stats
console.log('=== STATISTIQUES GÉNÉRALES ===');
const nbProd = db.prepare("SELECT COUNT(*) as n FROM produit").get();
const nbProdActif = db.prepare("SELECT COUNT(*) as n FROM produit WHERE actif = 1").get();
const stockTotal = db.prepare("SELECT SUM(quantite) as total FROM stock WHERE entiteId = 1").get();
const nbNegatifs = db.prepare("SELECT COUNT(*) as n FROM stock WHERE quantite < 0 AND entiteId = 1").get();
const nbVentes = db.prepare("SELECT COUNT(*) as n FROM vente WHERE date >= ? AND date < ?").get(
  new Date('2026-06-11').getTime(), new Date('2026-06-28').getTime()
);
const nbAchats = db.prepare("SELECT COUNT(*) as n FROM achat WHERE date >= ? AND date < ?").get(
  new Date('2026-06-11').getTime(), new Date('2026-06-28').getTime()
);

console.log('Produits: ' + nbProd.n + ' (actifs: ' + nbProdActif.n + ')');
console.log('Stock total (tous produits): ' + stockTotal.total);
console.log('Produits en stock négatif: ' + nbNegatifs.n);
console.log('Ventes 11/06-27/06: ' + nbVentes.n);
console.log('Achats 11/06-27/06: ' + nbAchats.n);
console.log('');

// 2. Negative stocks detail
console.log('=== PRODUITS EN STOCK NÉGATIF ===');
const negs = db.prepare(`
  SELECT s.quantite, p.code, p.designation 
  FROM stock s JOIN produit p ON p.id = s.produitId 
  WHERE s.quantite < 0 AND s.entiteId = 1 
  ORDER BY s.quantite ASC
`).all();
for (const n of negs) {
  console.log('  ' + n.code.padEnd(14) + ' ' + n.designation.trim().padEnd(35) + ' stock=' + n.quantite);
}
console.log('');

// 3. Top 20 highest value products
console.log('=== TOP 20 PRODUITS PAR VALEUR STOCK ===');
const top = db.prepare(`
  SELECT s.quantite, p.code, p.designation, p.prixVente, (s.quantite * p.prixVente) as valeur
  FROM stock s JOIN produit p ON p.id = s.produitId
  WHERE s.entiteId = 1 AND s.quantite > 0
  ORDER BY valeur DESC LIMIT 20
`).all();
for (const t of top) {
  console.log('  ' + t.code.padEnd(14) + ' ' + t.designation.trim().padEnd(35) + ' qté=' + String(t.quantite).padStart(6) + ' valeur=' + (t.valeur || 0).toLocaleString() + ' FCFA');
}
console.log('');

// 4. Products with zero stock
const zeros = db.prepare(`
  SELECT COUNT(*) as n FROM stock WHERE quantite = 0 AND entiteId = 1
`).get();
console.log('Produits à stock nul: ' + zeros.n);
console.log('');

// 5. Total value of stock on hand
const valeurTotale = db.prepare(`
  SELECT SUM(s.quantite * p.prixVente) as total
  FROM stock s JOIN produit p ON p.id = s.produitId
  WHERE s.entiteId = 1 AND s.quantite > 0
`).get();
const valeurNegative = db.prepare(`
  SELECT SUM(s.quantite * p.prixVente) as total
  FROM stock s JOIN produit p ON p.id = s.produitId
  WHERE s.entiteId = 1 AND s.quantite < 0
`).get();
console.log('Valeur stock positif: ' + (valeurTotale.total || 0).toLocaleString() + ' FCFA');
console.log('Valeur stock négatif: ' + (valeurNegative.total || 0).toLocaleString() + ' FCFA');

// 6. Compute stock by sum of all movements
console.log('\n=== COMPARAISON STOCK TABLE VS MOUVEMENTS ===');
const diffs = db.prepare(`
  SELECT p.code, p.designation, 
    COALESCE(s.quantite, 0) as stockTable,
    COALESCE(e.totalEntree, 0) - COALESCE(sr.totalSortie, 0) as stockMouvements
  FROM produit p
  LEFT JOIN stock s ON s.produitId = p.id AND s.magasinId = 1 AND s.entiteId = 1
  LEFT JOIN (SELECT produitId, SUM(quantite) as totalEntree FROM mouvement WHERE type='ENTREE' AND entiteId=1 GROUP BY produitId) e ON e.produitId = p.id
  LEFT JOIN (SELECT produitId, SUM(quantite) as totalSortie FROM mouvement WHERE type='SORTIE' AND entiteId=1 GROUP BY produitId) sr ON sr.produitId = p.id
  WHERE p.actif = 1 AND ABS(COALESCE(s.quantite, 0) - (COALESCE(e.totalEntree, 0) - COALESCE(sr.totalSortie, 0))) > 5
  ORDER BY ABS(COALESCE(s.quantite, 0) - (COALESCE(e.totalEntree, 0) - COALESCE(sr.totalSortie, 0))) DESC
  LIMIT 30
`).all();

console.log('Produits avec écart >5 entre table Stock et mouvements:');
console.log('CODE           DESIGNATION                     StockTable  StockMvts  Écart');
for (const d of diffs) {
  const ecart = d.stockTable - d.stockMouvements;
  console.log(
    d.code.padEnd(14) + 
    d.designation.trim().padEnd(35) + 
    String(d.stockTable).padStart(8) + 
    String(d.stockMouvements).padStart(10) + 
    (ecart > 0 ? '+' : '') + String(ecart).padStart(8)
  );
}

db.close();
