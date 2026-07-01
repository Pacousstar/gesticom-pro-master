import Database from 'better-sqlite3';
const c = new Database("C:/gesticom/gesticom.db", { readonly: true });
const debut = new Date("2026-06-26").getTime();
const fin = new Date("2026-06-28").getTime();

const codes = ['ETB-00152', 'ETB-00264'];
const csvData = { 'ETB-00152': 261, 'ETB-00264': 331 };

for (const code of codes) {
  const p = c.prepare("SELECT id FROM produit WHERE code = ?").get(code);
  const stockActuel = c.prepare("SELECT quantite FROM stock WHERE produitId=? AND magasinId=1 AND entiteId=1").get(p.id);
  
  // Sum all movements from 26/06 to 27/06
  const mvts = c.prepare("SELECT type, quantite FROM mouvement WHERE produitId=? AND entiteId=1 AND date>=? AND date<?").all(p.id, debut, fin);
  let delta26 = 0;
  for (const m of mvts) {
    if (m.type === 'ENTREE') delta26 += m.quantite;
    else delta26 -= m.quantite;
  }
  
  const stock25 = stockActuel.quantite - delta26;
  
  console.log(code);
  console.log('  CSV client 25/06:         ' + csvData[code]);
  console.log('  Stock C: 27/06 (table):  ' + stockActuel.quantite);
  console.log('  Delta 26-27/06 (mvts):   ' + (delta26 > 0 ? '+' : '') + delta26);
  console.log('  Stock C: 25/06 (reconst) : ' + stock25);
  console.log('  Différence CSV vs C:      ' + (csvData[code] - stock25));
  console.log('');
}

c.close();
