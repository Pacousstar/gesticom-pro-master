import Database from 'better-sqlite3';

function analyze(db, label) {
  for (const [nom, id] of [['CIMENT ORDINAIRE  CIMAF', 968], ['CIMENT ORDINAIRE  CIM IVOIRE', 856]]) {
    const p = db.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
    if (!p) { console.log(`${label}: ${nom} NOT FOUND`); continue; }
    const st = db.prepare("SELECT * FROM Stock WHERE produitId = ?").get(p.id);
    const achats = Object.values(db.prepare("SELECT COALESCE(SUM(quantite),0) FROM AchatLigne WHERE produitId = ?").get(p.id))[0];
    const ventes = Object.values(db.prepare("SELECT COALESCE(SUM(quantite),0) FROM VenteLigne WHERE produitId = ?").get(p.id))[0];
    const retours = Object.values(db.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetourLigne WHERE produitId = ?").get(p.id))[0];
    let retraits = 0;
    try { retraits = Object.values(db.prepare("SELECT COALESCE(SUM(quantite),0) FROM RetraitPartielLigne WHERE produitId = ?").get(p.id))[0]; } catch(e) {}
    const mvt = Object.values(db.prepare("SELECT SUM(CASE WHEN type='ENTREE' THEN quantite ELSE -quantite END) FROM Mouvement WHERE produitId = ?").get(p.id))[0];
    const modifs = db.prepare("SELECT COUNT(*) as c FROM Mouvement WHERE produitId = ? AND observation LIKE 'Modif Vente%'").get(p.id).c;
    console.log(`${label} | ${nom}`);
    console.log(`  Stock: ${st.quantite}, init: ${st.quantiteInitiale}`);
    console.log(`  Achats: ${achats}, Ventes: ${ventes}, Retours: ${retours}, Retraits: ${retraits}`);
    console.log(`  Stock calc (flux): ${achats - ventes + retours - retraits}`);
    console.log(`  Mouvements sum: ${mvt}, Stock-vs-Mvt: ${st.quantite - (mvt||0)}`);
    console.log(`  Modif Vente count: ${modifs}`);
    console.log('');
  }
}

const dev = new Database("C:/gesticom/gesticom.db", { readonly: true });
const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });

analyze(dev, 'DEV');
analyze(saine, 'SAINE');

dev.close();
saine.close();
