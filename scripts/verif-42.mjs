import Database from 'better-sqlite3';
const f = new Database("F:/gesticom/gesticom.db", { readonly: true });

const refs = ['V1778777521291', 'V1780310465018'];

for (const ref of refs) {
  const v = f.prepare("SELECT id FROM vente WHERE numero = ?").get(ref);
  if (v) {
    const lignes = f.prepare("SELECT COUNT(*) as n, SUM(quantite) as total FROM venteLigne WHERE venteId = ?").get(v.id);
    console.log(ref + ' -> EXISTE dans F: venteId=' + v.id + ' lignes=' + lignes.n + ' total=' + lignes.total);
  } else {
    console.log(ref + ' -> N\'EXISTE PAS dans F: (ni vente, ni lignes)');
  }
}

f.close();
