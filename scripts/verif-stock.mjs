import Database from 'better-sqlite3';

const f = new Database("F:/gesticom/gesticom.db", { readonly: true });
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });
const debut = new Date("2026-06-11").getTime();

function check(db, label) {
  const codes = ["ETB-00152", "ETB-00264"];
  for (const code of codes) {
    const p = db.prepare("SELECT id, designation FROM produit WHERE code = ?").get(code);
    const s = db.prepare("SELECT quantite FROM stock WHERE produitId = ? AND magasinId = 1 AND entiteId = 1").get(p.id);
    const ventes = db.prepare("SELECT COALESCE(SUM(vl.quantite),0) as total FROM venteLigne vl JOIN vente v ON v.id=vl.venteId WHERE vl.produitId=? AND v.date>=? AND v.statut!='ANNULEE'").get(p.id, debut);
    const nbV = db.prepare("SELECT COUNT(*) as n FROM venteLigne vl JOIN vente v ON v.id=vl.venteId WHERE vl.produitId=? AND v.date>=? AND v.statut!='ANNULEE'").get(p.id, debut);
    const achats = db.prepare("SELECT COALESCE(SUM(al.quantite),0) as total FROM achatLigne al JOIN achat a ON a.id=al.achatId WHERE al.produitId=? AND a.date>=?").get(p.id, debut);
    console.log(label + " | " + code + " | Stock=" + s.quantite + " | Ventes=" + ventes.total + " (" + nbV.n + " lignes) | Achats=" + achats.total);
  }
}

check(f, "F:");
check(c, "C:");

// Also check if the databases have the same nb of ventes
console.log("\nNb ventes total depuis 11/06:");
console.log("F: " + f.prepare("SELECT COUNT(*) as n FROM vente WHERE date>=?").get(debut).n);
console.log("C: " + c.prepare("SELECT COUNT(*) as n FROM vente WHERE date>=?").get(debut).n);

f.close();
c.close();
