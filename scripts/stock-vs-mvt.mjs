import Database from 'better-sqlite3';

const dev = new Database("C:/gesticom/gesticom.db", { readonly: true });
const saine = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });

console.log('Stock table - SAINE vs DEV vs Mouvements (DEV):');

for (const nom of ['VERNIS A EAU 1L', 'GLOBE ETANCHE', 'CIM IVOIRE', 'CIMAF']) {
  console.log(`\n--- ${nom} ---`);
  for (const [label, db] of [['SAINE', saine], ['DEV', dev]]) {
    const p = db.prepare("SELECT id FROM Produit WHERE designation = ?").get(nom);
    if (!p) { console.log(`${label}: NOT FOUND`); continue; }
    const st = db.prepare("SELECT * FROM Stock WHERE produitId = ?").get(p.id);
    if (st) {
      const mvts = db.prepare(`
        SELECT SUM(CASE WHEN type='ENTREE' THEN quantite ELSE -quantite END) as total
        FROM Mouvement WHERE produitId = ?
      `).get(p.id);
      const ca = typeof st.createdAt === 'number' ? new Date(st.createdAt).toISOString().slice(0,19) : st.createdAt?.toString().slice(0,19)||'';
      const ua = typeof st.updatedAt === 'number' ? new Date(st.updatedAt).toISOString().slice(0,19) : st.updatedAt?.toString().slice(0,19)||'';
      console.log(`${label}: Stock=${st.quantite}, init=${st.quantiteInitiale}, createdAt=${ca}, updatedAt=${ua}`);
      console.log(`  Mouvements sum: ${mvts.total}, Difference Stock-Mvt: ${st.quantite - (mvts.total||0)}`);
    }
  }
}

dev.close();
saine.close();
