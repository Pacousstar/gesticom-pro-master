import Database from 'better-sqlite3';
const f = new Database("F:/gesticom/gesticom.db", { readonly: true });
const tables = f.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

for (const t of tables) {
  if (t.name.toLowerCase().includes('retour') || t.name.toLowerCase().includes('retrait') || t.name.toLowerCase().includes('livr')) {
    const cols = f.prepare("PRAGMA table_info(" + t.name + ")").all();
    console.log(t.name + ': ' + cols.map(c => c.name).join(', '));
  }
}

// Also check the retour table content for our products
console.log('\n=== RETOURS ===');
const retours = f.prepare(`
  SELECT r.id, r.date, r.quantite, r.observation, rl.produitId, rl.quantite as qteLigne, rl.montant
  FROM retour r
  JOIN retourLigne rl ON rl.retourId = r.id
  WHERE rl.produitId IN (SELECT id FROM produit WHERE code IN ('ETB-00152','ETB-00264'))
  AND r.date >= ?
`).all(new Date("2026-06-11").getTime());
for (const r of retours) {
  console.log('  id=' + r.id + ' date=' + new Date(r.date).toISOString().slice(0,10) + ' qte=' + r.qteLigne + ' obs=' + (r.observation||'').substring(0,40));
}

console.log('\n=== RETRAITS ===');
const retraits = f.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%retrait%'").all();
for (const rt of retraits) {
  const cols = f.prepare("PRAGMA table_info(" + rt.name + ")").all();
  console.log(rt.name + ': ' + cols.map(c => c.name).join(', '));
  const data = f.prepare(`
    SELECT r.id, r.date, r.quantite, r.observation, rl.produitId
    FROM retraitPartiel r
    JOIN retraitPartielLigne rl ON rl.retraitPartielId = r.id
    WHERE rl.produitId IN (SELECT id FROM produit WHERE code IN ('ETB-00152','ETB-00264'))
    AND r.date >= ?
  `).all(new Date("2026-06-11").getTime());
  for (const d of data) {
    console.log('  id=' + d.id + ' date=' + new Date(d.date).toISOString().slice(0,10) + ' qte=' + d.quantite);
  }
}

// Check if VenteLigne already includes livraisons and retraits
console.log('\n=== VENTES PAR TYPE ===');
const types = f.prepare("SELECT typeVente, COUNT(*) as n FROM vente WHERE date >= ? GROUP BY typeVente").all(new Date("2026-06-11").getTime());
for (const t of types) {
  console.log('  ' + t.typeVente + ': ' + t.n);
}

f.close();
