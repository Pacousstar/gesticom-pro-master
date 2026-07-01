import Database from 'better-sqlite3';
const dev = new Database("C:/gesticom/gesticom.db", { readonly: true });

// Find first Modif Vente ever
const first = dev.prepare("SELECT MIN(date) as firstDate FROM Mouvement WHERE observation LIKE 'Modif Vente%'").get();
console.log('Premier Modif Vente:', new Date(first.firstDate).toISOString().slice(0,19));
console.log('');

// For every product: compare stock table vs transactions
const prods = dev.prepare(`
  SELECT p.id, p.designation, s.quantite as stockQte, s.quantiteInitiale
  FROM Produit p
  JOIN Stock s ON s.produitId = p.id
  ORDER BY p.designation
`).all();

console.log('Produits avec Modif Vente et écart Stock vs Transactions:\n');
console.log('  Désignation | Stock | Init | Achats | Ventes | Flux | Attendu | Écart | ModifV | Depuis');
console.log('  ' + '-'.repeat(130));

let totalEcart = 0;
let countImpacted = 0;
let totalModifs = 0;

for (const p of prods) {
  const achats = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM AchatLigne WHERE produitId = ?").get(p.id))[0];
  const ventes = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM VenteLigne WHERE produitId = ?").get(p.id))[0];
  const retours = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetourLigne WHERE produitId = ?").get(p.id))[0];
  let retraits = 0;
  try { retraits = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetraitPartielLigne WHERE produitId = ?").get(p.id))[0]; } catch(e) {}

  const flux = achats - ventes + retours - retraits;
  const attendu = p.quantiteInitiale + flux;
  const ecart = p.stockQte - attendu;

  const modifs = dev.prepare("SELECT COUNT(*) as c, MIN(date) as d FROM Mouvement WHERE produitId = ? AND observation LIKE 'Modif Vente%'").get(p.id);

  if (modifs.c > 0 && ecart !== 0) {
    const depuis = modifs.d ? new Date(modifs.d).toISOString().slice(0,10) : '??';
    console.log(`  ${p.designation.slice(0,35).padEnd(36)} | ${String(p.stockQte).padStart(5)} | ${String(p.quantiteInitiale).padStart(4)} | ${String(achats).padStart(6)} | ${String(ventes).padStart(6)} | ${String(flux).padStart(5)} | ${String(attendu).padStart(6)} | ${String(ecart).padStart(5)} | ${String(modifs.c).padStart(3)} | ${depuis}`);
    totalEcart += Math.abs(ecart);
    countImpacted++;
    totalModifs += modifs.c;
  }
}

// Also show products with NO Modif Vente but still have a discrepancy
console.log('\n\nProduits SANS Modif Vente mais avec écart Stock vs Transactions:');
console.log('  Désignation | Stock | Init | Flux | Attendu | Écart');
console.log('  ' + '-'.repeat(85));
let countOther = 0;
for (const p of prods) {
  const achats = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM AchatLigne WHERE produitId = ?").get(p.id))[0];
  const ventes = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM VenteLigne WHERE produitId = ?").get(p.id))[0];
  const retours = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetourLigne WHERE produitId = ?").get(p.id))[0];
  let retraits = 0;
  try { retraits = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetraitPartielLigne WHERE produitId = ?").get(p.id))[0]; } catch(e) {}
  const flux = achats - ventes + retours - retraits;
  const attendu = p.quantiteInitiale + flux;
  const ecart = p.stockQte - attendu;
  const modifs = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE produitId = ? AND observation LIKE 'Modif Vente%'").get(p.id).c;

  if (modifs === 0 && ecart !== 0) {
    console.log(`  ${p.designation.slice(0,35).padEnd(36)} | ${String(p.stockQte).padStart(5)} | ${String(p.quantiteInitiale).padStart(4)} | ${String(flux).padStart(5)} | ${String(attendu).padStart(6)} | ${String(ecart).padStart(5)}`);
    countOther++;
  }
}

console.log(`\n\n=== RÉSUMÉ ===`);
console.log(`Produits avec Modif Vente + écart: ${countImpacted}`);
console.log(`Produits avec écart sans Modif Vente: ${countOther}`);
console.log(`Total Modif Vente (produits impactés): ${totalModifs}`);
console.log(`Somme des écarts absolus: ${totalEcart}`);

// Also get total Modif Vente in the whole DB
const totalAllModifs = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE observation LIKE 'Modif Vente%'").get().c;
console.log(`Total Modif Vente dans toute la DB: ${totalAllModifs}`);

dev.close();
