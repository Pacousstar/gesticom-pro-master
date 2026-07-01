import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });

function detail(nom) {
  console.log(`\n========== ${nom} ==========`);
  const p = c.prepare("SELECT id FROM Produit WHERE designation LIKE ?").get('%' + nom + '%');
  if (!p) {
    // search more broadly
    const all = c.prepare("SELECT id, designation FROM Produit WHERE designation LIKE '%" + nom.replace(/'/g,"''") + "%'").all();
    if (all.length === 0) { console.log('NOT FOUND'); return; }
    console.log('Found:', all.map(x => x.designation).join(', '));
    for (const prod of all) {
      detailOne(prod.id, prod.designation);
    }
    return;
  }
  detailOne(p.id);
}

function detailOne(id, label) {
  // Find actual product name
  const prod = c.prepare("SELECT designation FROM Produit WHERE id = ?").get(id);
  const nom = label || prod.designation;
  
  console.log(`\nProduit: ${nom} (id=${id})`);

  console.log('\nACHATS:');
  const achats = c.prepare(`
    SELECT a.numero, a.date, a.createdAt, al.quantite, al.prixUnitaire
    FROM AchatLigne al
    JOIN Achat a ON a.id = al.achatId
    WHERE al.produitId = ?
    ORDER BY a.date
  `).all(id);
  for (const a of achats) {
    console.log(`  ${a.numero} | saisie: ${new Date(a.date).toLocaleDateString('fr-FR')} ${new Date(a.date).toLocaleTimeString('fr-FR')} | créée: ${new Date(a.createdAt).toLocaleDateString('fr-FR')} ${new Date(a.createdAt).toLocaleTimeString('fr-FR')} | ${a.quantite} x ${a.prixUnitaire} F`);
  }
  const ta = achats.reduce((s, a) => s + a.quantite, 0);

  console.log('\nVENTES:');
  const ventes = c.prepare(`
    SELECT v.numero, v.date, v.createdAt, vl.quantite, vl.prixUnitaire
    FROM VenteLigne vl
    JOIN Vente v ON v.id = vl.venteId
    WHERE vl.produitId = ?
    ORDER BY v.date
  `).all(id);
  for (const v of ventes) {
    const ds = new Date(v.date).toLocaleDateString('fr-FR') + ' ' + new Date(v.date).toLocaleTimeString('fr-FR');
    const dc = new Date(v.createdAt).toLocaleDateString('fr-FR') + ' ' + new Date(v.createdAt).toLocaleTimeString('fr-FR');
    console.log(`  ${v.numero} | saisie: ${ds} | créée: ${dc} | ${v.quantite} x ${v.prixUnitaire} F`);
  }
  const tv = ventes.reduce((s, v) => s + v.quantite, 0);

  // Retours and retraits
  const retours = c.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetourLigne WHERE produitId = ?").get(id);
  const retraits = c.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetraitPartielLigne WHERE produitId = ?").get(id);
  const rt = Object.values(retours)[0];
  const rp = Object.values(retraits)[0];
  
  // Stock table
  const st = c.prepare("SELECT quantite, quantiteInitiale FROM Stock WHERE produitId = ?").get(id);
  
  // Mouvements
  const mvts = c.prepare("SELECT SUM(CASE WHEN type='ENTREE' THEN quantite ELSE -quantite END) as total FROM Mouvement WHERE produitId = ?").get(id);
  const mvtSum = mvts.total || 0;

  console.log(`\nRÉSUMÉ:`);
  console.log(`  Achats: ${ta}`);
  console.log(`  Ventes: ${tv}`);
  console.log(`  Retours: ${rt}`);
  console.log(`  Retraits: ${rp}`);
  console.log(`  Stock calculé (achats-ventes+retours-retraits): ${ta - tv + rt - rp}`);
  console.log(`  Stock table: ${st.quantite} (init=${st.quantiteInitiale})`);
  console.log(`  Mouvements sum: ${mvtSum}`);
  console.log(`  Écart Stock vs Mouvements: ${st.quantite - mvtSum}`);

  // Check for Modif Vente mouvements
  console.log('\nMouvements type Modif Vente:');
  const modifs = c.prepare(`
    SELECT date, type, quantite, observation
    FROM Mouvement
    WHERE produitId = ? AND observation LIKE 'Modif Vente%'
    ORDER BY date
  `).all(id);
  for (const m of modifs) {
    console.log(`  ${new Date(m.date).toISOString().slice(0,19)} | ${m.type} | ${m.quantite} | ${m.observation}`);
  }

  // Check original vente mouvements for each modified vente
  for (const m of modifs) {
    const ref = m.observation.replace('Modif Vente ', '');
    const orig = c.prepare(`
      SELECT date, type, quantite, observation
      FROM Mouvement
      WHERE observation = ? AND produitId = ?
    `).all('Vente ' + ref, id);
    if (orig.length > 0) {
      console.log(`  → Mouvement Vente original correspondant:`);
      for (const o of orig) {
        console.log(`     ${new Date(o.date).toISOString().slice(0,19)} | ${o.type} | ${o.quantite} | ${o.observation}`);
      }
    } else {
      console.log(`  → Aucun mouvement 'Vente ${ref}' trouvé pour ce produit (a été supprimé ?)`);
    }
  }
}

// Search for CIM products
console.log('=== Recherche des produits CIM ===');
const cims = c.prepare("SELECT id, designation FROM Produit WHERE designation LIKE '%CIM%'").all();
for (const p of cims) {
  console.log(`  id=${p.id}: ${p.designation}`);
}

// Now detail CIMAF and CIM IVOIRE
detail('CIMAF');
detail('CIM IVOIRE');

c.close();
