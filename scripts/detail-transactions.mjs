import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

function detail(nom) {
  console.log(`\n========== ${nom} ==========`);
  const p = c.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
  const id = p.id;

  console.log('\nACHATS:');
  const achats = c.prepare(`
    SELECT a.numero, a.date, al.quantite, al.prixUnitaire
    FROM AchatLigne al
    JOIN Achat a ON a.id = al.achatId
    WHERE al.produitId = ?
    ORDER BY a.date
  `).all(id);
  for (const a of achats) {
    console.log(`  ${a.numero} | ${new Date(a.date).toLocaleDateString('fr-FR')} (${new Date(a.date).toISOString().slice(0,10)}) | ${a.quantite} x ${a.prixUnitaire} F`);
  }
  const ta = achats.reduce((s, a) => s + a.quantite, 0);
  console.log(`  Total achats: ${ta}`);

  console.log('\nVENTES:');
  const ventes = c.prepare(`
    SELECT v.numero, v.date, v.createdAt, vl.quantite, vl.prixUnitaire
    FROM VenteLigne vl
    JOIN Vente v ON v.id = vl.venteId
    WHERE vl.produitId = ?
    ORDER BY v.date
  `).all(id);
  for (const v of ventes) {
    const dateOp = new Date(v.date).toLocaleDateString('fr-FR') + ' ' + new Date(v.date).toLocaleTimeString('fr-FR');
    const dateCr = new Date(v.createdAt).toLocaleDateString('fr-FR') + ' ' + new Date(v.createdAt).toLocaleTimeString('fr-FR');
    console.log(`  ${v.numero} | saisie: ${dateOp} | créée: ${dateCr} | ${v.quantite} x ${v.prixUnitaire} F`);
  }
  const tv = ventes.reduce((s, v) => s + v.quantite, 0);
  console.log(`  Total ventes: ${tv}`);

  console.log(`\nRÉSUMÉ: achats=${ta}, ventes=${tv}, stock_vrai=${ta - tv}`);
}

detail('VERNIS A EAU 1L');
detail('GLOBE ETANCHE');
c.close();
