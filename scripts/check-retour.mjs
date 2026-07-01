import Database from 'better-sqlite3';
const f = new Database("F:/gesticom/gesticom.db", { readonly: true });

const p = f.prepare("SELECT id FROM produit WHERE code = 'ETB-00264'").get();
const debut = new Date("2026-06-11").getTime();

// Check Retour table
const retours = f.prepare("SELECT r.id, r.date, r.venteId, r.montantTotal, r.observation FROM retour r JOIN retourLigne rl ON rl.retourId=r.id WHERE rl.produitId=? AND r.date>=?").all(p.id, debut);
console.log('Retours dans Retour/RetourLigne:');
for (const r of retours) {
  const lignes = f.prepare("SELECT quantite FROM retourLigne WHERE retourId=? AND produitId=?").all(r.id, p.id);
  console.log('  id=' + r.id + ' date=' + new Date(r.date).toISOString().slice(0,10) + ' venteId=' + r.venteId + ' total=' + r.montantTotal + ' lignes=' + JSON.stringify(lignes));
}

// Check the Retour from mouvement: "Retour client - Vente V1781254697182"
const vente = f.prepare("SELECT id FROM vente WHERE numero = ?").get('V1781254697182');
if (vente) {
  console.log('\nVente V1781254697182 trouvee id=' + vente.id);
  // Check Retour with this venteId
  const r = f.prepare("SELECT * FROM retour WHERE venteId = ?").all(vente.id);
  console.log('Retour avec cette venteId: ' + r.length);
  
  // Check VenteLigne with negative qty
  const vl = f.prepare("SELECT quantite FROM venteLigne WHERE venteId=? AND produitId=?").all(vente.id, p.id);
  console.log('VenteLigne: ' + JSON.stringify(vl));
}

// Also check if there's any vente with negative quantities
const negVentes = f.prepare(`
  SELECT vl.quantite, vl.produitId, v.numero, v.date
  FROM venteLigne vl JOIN vente v ON v.id=vl.venteId
  WHERE vl.produitId=? AND v.date>=? AND vl.quantite < 0
`).all(p.id, debut);
console.log('\nVenteLigne quantite negative: ' + negVentes.length);

f.close();
