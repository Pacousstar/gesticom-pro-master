import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

const p = c.prepare("SELECT id FROM produit WHERE code = 'ETB-00152'").get();
const debut25 = new Date("2026-06-25").getTime();
const fin25 = new Date("2026-06-26").getTime();

// All movements on 25/06 for CIM IVOIRE
const mvts = c.prepare(`
  SELECT m.date, m.type, m.quantite, m.observation, u.nom as userName
  FROM mouvement m
  LEFT JOIN utilisateur u ON u.id = m.utilisateurId
  WHERE m.produitId = ? AND m.entiteId = 1 AND m.date >= ? AND m.date < ?
  ORDER BY m.date ASC, m.id ASC
`).all(p.id, debut25, fin25);

console.log('Tous les mouvements du 25/06 pour CIM IVOIRE :');
let total = 0;
for (const m of mvts) {
  const d = new Date(m.date).toISOString().slice(0, 10) + ' ' + new Date(m.date).toISOString().slice(11, 16);
  const qte = m.type === 'ENTREE' ? m.quantite : -m.quantite;
  total += qte;
  console.log('  ' + d + ' | ' + m.type.padEnd(7) + ' | ' + (qte > 0 ? '+' : '') + qte + ' | ' + (m.observation || '').trim().substring(0, 55) + ' | ' + (m.userName || ''));
}
console.log('Total mouvements 25/06: ' + (total > 0 ? '+' : '') + total);

// Now check the VenteLigne totals for 25/06
const ventes = c.prepare(`
  SELECT COALESCE(SUM(vl.quantite),0) as total, COUNT(*) as nb
  FROM venteLigne vl
  JOIN vente v ON v.id = vl.venteId
  WHERE vl.produitId = ? AND v.date >= ? AND v.date < ? AND v.statut != 'ANNULEE'
`).get(p.id, debut25, fin25);
console.log('\nVenteLigne 25/06: ' + ventes.total + ' unités (' + ventes.nb + ' lignes)');

// Get the Stock table value as of 25/06 
// We need to check what the stock was at start of 25/06 and end of 25/06
// stock at 27/06 = 217, subtract all movements from 26/06 to get 25/06 end
const debut26 = new Date("2026-06-26").getTime();
const fin26 = new Date("2026-06-28").getTime();
const mvts26 = c.prepare("SELECT type, quantite FROM mouvement WHERE produitId=? AND entiteId=1 AND date>=? AND date<?").all(p.id, debut26, fin26);
let delta26 = 0;
for (const m of mvts26) {
  if (m.type === 'ENTREE') delta26 += m.quantite;
  else delta26 -= m.quantite;
}
console.log('Delta 26-27/06: ' + delta26);
console.log('Stock table C: 27/06: 217');
console.log('Stock table C: 25/06 (reconst): ' + (217 - delta26));

// Check if there's a difference between VenteLigne quantite and Mouvement quantite on 25/06
const venteRefs = c.prepare(`
  SELECT v.numero, SUM(vl.quantite) as qte
  FROM venteLigne vl
  JOIN vente v ON v.id = vl.venteId
  WHERE vl.produitId = ? AND v.date >= ? AND v.date < ? AND v.statut != 'ANNULEE'
  GROUP BY v.numero
`).all(p.id, debut25, fin25);
console.log('\nDétail VenteLigne par vente:');
for (const v of venteRefs) {
  console.log('  ' + v.numero + ' = ' + v.qte);
}

// Check if there's a Modif Vente that creates a difference
console.log('\nModif Vente sur le 25/06:');
const modifs = c.prepare(`
  SELECT m.date, m.quantite, m.observation
  FROM mouvement m
  WHERE m.produitId = ? AND m.date >= ? AND m.date < ?
  AND m.observation LIKE 'Modif Vente%'
`).all(p.id, debut25, fin25);
for (const m of modifs) {
  const d = new Date(m.date).toISOString().slice(0, 19);
  console.log('  ' + d + ' | -' + m.quantite + ' | ' + m.observation);
}

// Check if any Ajustements on 25/06
const ajusts = c.prepare(`
  SELECT m.date, m.quantite, m.observation
  FROM mouvement m
  WHERE m.produitId = ? AND m.date >= ? AND m.date < ?
  AND m.observation LIKE 'Ajustement%'
`).all(p.id, debut25, fin25);
console.log('\nAjustements 25/06: ' + ajusts.length);

c.close();
