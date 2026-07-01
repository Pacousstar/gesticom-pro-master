import Database from 'better-sqlite3';

for (const [label, path] of [['SAINE 11/06', 'C:/gesticom - BILAL1106/gesticom.db'], ['DEV', 'C:/gesticom/gesticom.db']]) {
  console.log(`=== ${label} ===`);
  const db = new Database(path, { readonly: true });
  const cols = db.prepare("PRAGMA table_info('Stock')").all();
  const hasInit = cols.some(c => c.name === 'quantiteInitiale');
  console.log(`quantiteInitiale column: ${hasInit}`);

  for (const nom of ['VERNIS A EAU 1L', 'GLOBE ETANCHE']) {
    const p = db.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
    if (!p) { console.log(`${nom}: NOT FOUND`); continue; }
    const st = db.prepare("SELECT quantite, quantiteInitiale FROM Stock WHERE produitId = ?").get(p.id);
    const achats = Object.values(db.prepare("SELECT COALESCE(SUM(quantite), 0) FROM AchatLigne WHERE produitId = ?").get(p.id))[0];
    const ventes = Object.values(db.prepare("SELECT COALESCE(SUM(quantite), 0) FROM VenteLigne WHERE produitId = ?").get(p.id))[0];
    console.log(`  ${nom}: stock=${st.quantite}, init=${st.quantiteInitiale}, achats=${achats}, ventes=${ventes}, calc=${achats-ventes}`);
  }
  db.close();
}
