const Database = require('better-sqlite3');
const db = new Database('C:/gesticom/gesticom.db');

console.log('=== NETTOYAGE DES DOUBLONS CAISSE ===\n');

// Trouver les doublons : même motif + montant + magasinId + date à la seconde près
const all = db.prepare('SELECT * FROM Caisse ORDER BY motif, montant, magasinId, date, id').all();

const seen = new Map();
for (const e of all) {
  const key = `${e.motif}|${e.montant}|${e.magasinId}|${new Date(e.date).getTime()}`;
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key).push(e.id);
}

let totalDeleted = 0;
const magasinsToRecalc = new Set();

const deleteStmt = db.prepare('DELETE FROM Caisse WHERE id = ?');

for (const [key, ids] of seen) {
  if (ids.length > 1) {
    const [keep, ...toDelete] = ids;
    const sample = all.find(e => e.id === keep);
    console.log(`Doublon : ${sample.motif} | ${sample.montant} F | ${new Date(sample.date).toLocaleDateString('fr-FR')}`);
    console.log(`  → Gardé: id=${keep}, Suppr: ids=${toDelete.join(',')}`);

    const del = db.transaction((ids) => {
      for (const id of ids) {
        deleteStmt.run(id);
      }
    });
    del(toDelete);
    
    totalDeleted += toDelete.length;
    magasinsToRecalc.add(sample.magasinId);
  }
}

console.log(`\nTotal: ${totalDeleted} doublons supprimés.`);

db.close();
