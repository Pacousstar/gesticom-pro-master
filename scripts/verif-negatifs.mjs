import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

const stockCols = c.prepare("PRAGMA table_info('Stock')").all();
console.log('Stock columns:', stockCols.map(c => c.name).join(', '));

const neg = c.prepare(`
  SELECT p.designation, s.quantite, p.seuilMin
  FROM Stock s
  JOIN Produit p ON p.id = s.produitId
  WHERE s.quantite < 0
  ORDER BY s.quantite ASC
`).all();

console.log(`\nProduits avec stock negatif (${neg.length}):\n`);
for (const p of neg) {
  console.log(`${p.designation}: stock=${p.quantite}, seuilMin=${p.seuilMin}`);
}

const stats = c.prepare(`
  SELECT 
    SUM(CASE WHEN s.quantite < 0 THEN 1 ELSE 0 END) as neg_count,
    SUM(CASE WHEN s.quantite = 0 THEN 1 ELSE 0 END) as zero_count,
    SUM(CASE WHEN s.quantite > 0 THEN 1 ELSE 0 END) as pos_count,
    COALESCE(SUM(CASE WHEN s.quantite < 0 THEN s.quantite ELSE 0 END), 0) as neg_total
  FROM Stock s
`).get();
console.log(`\nStats stocks: neg=${stats.neg_count}, zero=${stats.zero_count}, pos=${stats.pos_count}`);
console.log(`Total quantite negative: ${stats.neg_total}`);

c.close();
