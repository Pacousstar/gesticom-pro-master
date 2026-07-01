import Database from 'better-sqlite3';

const c = new Database("C:/gesticom/gesticom.db", { readonly: true });
const b = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });

const debut = new Date("2026-06-11").getTime();
const codes = ['ETB-00152', 'ETB-00264'];

for (const code of codes) {
  const pC = c.prepare("SELECT id FROM produit WHERE code = ?").get(code);
  const pB = b.prepare("SELECT id FROM produit WHERE code = ?").get(code);

  const stockSaine = b.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pB.id);
  const stockActuel = c.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(pC.id);

  const achat = c.prepare("SELECT COALESCE(SUM(al.quantite),0) as t FROM achatLigne al JOIN achat a ON a.id=al.achatId WHERE al.produitId=? AND a.date>=?").get(pC.id, debut);
  const vente = c.prepare("SELECT COALESCE(SUM(vl.quantite),0) as t FROM venteLigne vl JOIN vente v ON v.id=vl.venteId WHERE vl.produitId=? AND v.date>=? AND v.statut!='ANNULEE'").get(pC.id, debut);
  const retour = c.prepare("SELECT COALESCE(SUM(rl.quantite),0) as t FROM retourLigne rl JOIN retour r ON r.id=rl.retourId WHERE rl.produitId=? AND r.date>=?").get(pC.id, debut);
  const retrait = c.prepare("SELECT COALESCE(SUM(rl.quantite),0) as t FROM retraitPartielLigne rl JOIN retraitPartiel r ON r.id=rl.retraitPartielId WHERE rl.produitId=? AND r.date>=?").get(pC.id, debut);

  const stockCalcule = stockSaine.quantite + achat.t - vente.t + retour.t - retrait.t;

  console.log(code);
  console.log('  Stock saine 11/06:         ' + stockSaine.quantite);
  console.log('  + Achats (AchatLigne):     +' + achat.t);
  console.log('  - Ventes (VenteLigne):     -' + vente.t);
  console.log('  + Retours (RetourLigne):   +' + retour.t);
  console.log('  - Retraits (RetraitLigne): -' + retrait.t);
  console.log('  = Stock calculé:           ' + stockCalcule);
  console.log('  Stock réel C: (table):     ' + stockActuel.quantite);
  console.log('  Écart (table vs calcul):   ' + (stockActuel.quantite - stockCalcule));
  console.log('');
}

c.close();
b.close();
