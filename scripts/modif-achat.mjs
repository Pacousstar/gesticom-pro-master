import Database from 'better-sqlite3';
const dev = new Database("C:/gesticom/gesticom.db", { readonly: true });

console.log('=== Modif Achat dans Mouvement ===');
const maCount = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE observation LIKE 'Modif Achat%'").get().c;
console.log('Total Modif Achat:', maCount);

const firstMA = dev.prepare("SELECT MIN(date) as d FROM Mouvement WHERE observation LIKE 'Modif Achat%'").get();
console.log('Premier Modif Achat:', firstMA.d ? new Date(firstMA.d).toISOString().slice(0,19) : 'N/A');

// Check if Modif Achat original mouvements are also deleted
const samples = dev.prepare(`
  SELECT DISTINCT observation, date, type, quantite, produitId
  FROM Mouvement 
  WHERE observation LIKE 'Modif Achat%'
  ORDER BY date
  LIMIT 20
`).all();

for (const m of samples) {
  const ref = m.observation.replace('Modif Achat ', '');
  const orig = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE observation = ? AND produitId = ?").get('Achat ' + ref, m.produitId);
  console.log(`  ${m.observation} | ${m.type} | ${m.quantite} | original 'Achat ${ref}' existe? ${orig.c > 0 ? 'OUI' : 'NON'}`);
}

console.log('\n=== Produits avec Modif Achat et écart Stock ===');
const prods = dev.prepare(`
  SELECT p.id, p.designation, s.quantite, s.quantiteInitiale
  FROM Produit p
  JOIN Stock s ON s.produitId = p.id
  WHERE p.id IN (
    SELECT DISTINCT produitId FROM Mouvement WHERE observation LIKE 'Modif Achat%'
  )
  ORDER BY p.designation
`).all();

for (const p of prods) {
  const modifsA = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE produitId = ? AND observation LIKE 'Modif Achat%'").get(p.id).c;
  const modifsV = dev.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE produitId = ? AND observation LIKE 'Modif Vente%'").get(p.id).c;
  const achats = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM AchatLigne WHERE produitId = ?").get(p.id))[0];
  const ventes = Object.values(dev.prepare("SELECT COALESCE(SUM(quantite),0) FROM VenteLigne WHERE produitId = ?").get(p.id))[0];
  const flux = achats - ventes;
  const attendu = p.quantiteInitiale + flux;
  const ecart = p.quantite - attendu;
  console.log(`  ${p.designation.slice(0,35).padEnd(36)} | stock=${p.quantite} | init=${p.quantiteInitiale} | flux=${flux} | attendu=${attendu} | ecart=${ecart} | ModifA=${modifsA} | ModifV=${modifsV}`);
}

dev.close();
