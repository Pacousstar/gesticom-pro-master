import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

const produits = ['VERNIS A EAU 1L', 'GLOBE ETANCHE'];

for (const nom of produits) {
  console.log(`=== ${nom} ===`);
  const p = c.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
  if (!p) continue;
  const id = p.id;

  const st = c.prepare("SELECT quantite, quantiteInitiale FROM Stock WHERE produitId = ?").get(id);
  console.log(`Stock table: ${st.quantite}, Init: ${st.quantiteInitiale}`);

  const achats = c.prepare("SELECT COALESCE(SUM(quantite), 0) FROM AchatLigne WHERE produitId = ?").get(id);
  console.log(`Total achats: ${Object.values(achats)[0]}`);

  const ventes = c.prepare("SELECT COALESCE(SUM(quantite), 0) FROM VenteLigne WHERE produitId = ?").get(id);
  console.log(`Total ventes: ${Object.values(ventes)[0]}`);

  const retours = c.prepare("SELECT COALESCE(SUM(quantite), 0) FROM RetourLigne WHERE produitId = ?").get(id);
  console.log(`Total retours: ${Object.values(retours)[0]}`);

  const retraits = c.prepare("SELECT COALESCE(SUM(quantite), 0) FROM RetraitPartielLigne WHERE produitId = ?").get(id);
  console.log(`Total retraits: ${Object.values(retraits)[0]}`);

  console.log('\nDernieres ventes:');
  const dVentes = c.prepare(`
    SELECT v.numero, v.date, vl.quantite
    FROM VenteLigne vl
    JOIN Vente v ON v.id = vl.venteId
    WHERE vl.produitId = ?
    ORDER BY v.date DESC LIMIT 5
  `).all(id);
  for (const l of dVentes) {
    console.log(`  ${l.numero} | ${new Date(l.date).toISOString().slice(0,10)} | qté=${l.quantite}`);
  }

  console.log('\nDerniers achats:');
  const dAchats = c.prepare(`
    SELECT a.numero, a.date, al.quantite
    FROM AchatLigne al
    JOIN Achat a ON a.id = al.achatId
    WHERE al.produitId = ?
    ORDER BY a.date DESC LIMIT 5
  `).all(id);
  for (const l of dAchats) {
    console.log(`  ${l.numero} | ${new Date(l.date).toISOString().slice(0,10)} | qté=${l.quantite}`);
  }

  console.log('\nMouvements:');
  const mvts = c.prepare(`
    SELECT date, type, quantite, observation
    FROM Mouvement
    WHERE produitId = ?
    ORDER BY date DESC LIMIT 10
  `).all(id);
  for (const m of mvts) {
    console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type} | ${m.quantite} | ${m.observation?.slice(0,40)}`);
  }
  console.log('');
}
c.close();
