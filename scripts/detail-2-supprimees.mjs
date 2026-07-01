import Database from 'better-sqlite3';

const backup = new Database("C:/gesticom - BILAL1106/gesticom.db", { readonly: true });
const current = new Database("C:/gesticom/gesticom.db", { readonly: true });

// Check ArchiveVente columns
const cols = backup.prepare("PRAGMA table_info(archiveVente)").all();
console.log('ArchiveVente columns:');
for (const c of cols) console.log('  ' + c.name + ' ' + c.type);

// Check what's in ArchiveVente for these refs  
const refs = ['V1778777521291', 'V1780310465018'];

// Try different possible columns
const bArch = backup.prepare("SELECT * FROM archiveVente WHERE id IN (SELECT venteId FROM venteLigne WHERE venteId IN (SELECT id FROM archiveVente))").all();
// Just get all archives
console.log('\nAll ArchiveVente in backup:');
const allArch = backup.prepare("SELECT * FROM archiveVente").all();
for (const a of allArch) {
  console.log('  id=' + a.id + ' venteId=' + a.venteId);
}

// Check vente ID numbers for the 2 refs
console.log('\n=== Vente IDs ===');
for (const ref of refs) {
  const vb = backup.prepare("SELECT id FROM vente WHERE numero = ?").get(ref);
  if (vb) console.log(ref + ' -> id=' + vb.id);
}

// Look for vente IDs 726 and 858 in current DB (the IDs from backup for these references)
// Actually let me find the IDs from backup first
const v1 = backup.prepare("SELECT id FROM vente WHERE numero = 'V1778777521291'").get();
const v2 = backup.prepare("SELECT id FROM vente WHERE numero = 'V1780310465018'").get();

if (v1 && v2) {
  console.log('\nV1778777521291 id in backup: ' + v1.id);
  console.log('V1780310465018 id in backup: ' + v2.id);
  
  // Check if these IDs exist in current
  const cv1 = current.prepare("SELECT id, numero, statut FROM vente WHERE id = ?").get(v1.id);
  const cv2 = current.prepare("SELECT id, numero, statut FROM vente WHERE id = ?").get(v2.id);
  
  console.log('\nCurrent vente id=' + v1.id + ': ' + (cv1 ? cv1.numero + ' statut=' + cv1.statut : 'N\'EXISTE PAS'));
  console.log('Current vente id=' + v2.id + ': ' + (cv2 ? cv2.numero + ' statut=' + cv2.statut : 'N\'EXISTE PAS'));
  
  // Check what vente occupies these IDs in current
  if (!cv1) {
    const gap1 = current.prepare("SELECT id, numero, statut, date, clientLibre FROM vente WHERE id = ? OR id = ? OR id = ?").all(v1.id - 1, v1.id, v1.id + 1);
    console.log('Autour de id=' + v1.id + ' dans current:');
    for (const g of gap1) console.log('  id=' + g.id + ' ' + g.numero + ' statut=' + g.statut + ' client=' + (g.clientLibre || ''));
  }
  if (!cv2) {
    const gap2 = current.prepare("SELECT id, numero, statut, date, clientLibre FROM vente WHERE id = ? OR id = ? OR id = ?").all(v2.id - 1, v2.id, v2.id + 1);
    console.log('Autour de id=' + v2.id + ' dans current:');
    for (const g of gap2) console.log('  id=' + g.id + ' ' + g.numero + ' statut=' + g.statut + ' client=' + (g.clientLibre || ''));
  }
}

// Check ReglementVente for these IDs in both DB
console.log('\n=== Règlements ===');
if (v1) {
  const rb1 = backup.prepare("SELECT * FROM reglementVente WHERE venteId = ?").all(v1.id);
  console.log('ReglementVente backup id=' + v1.id + ': ' + rb1.length);
  for (const r of rb1) console.log('  ' + r.id + ' montant=' + r.montant + ' mode=' + r.modePaiement + ' date=' + new Date(r.date).toISOString().slice(0, 10));
  
  const rc1 = current.prepare("SELECT * FROM reglementVente WHERE venteId = ?").all(v1.id);
  console.log('ReglementVente current id=' + v1.id + ': ' + rc1.length);
}
if (v2) {
  const rb2 = backup.prepare("SELECT * FROM reglementVente WHERE venteId = ?").all(v2.id);
  console.log('ReglementVente backup id=' + v2.id + ': ' + rb2.length);
  
  const rc2 = current.prepare("SELECT * FROM reglementVente WHERE venteId = ?").all(v2.id);
  console.log('ReglementVente current id=' + v2.id + ': ' + rc2.length);
}

backup.close();
current.close();
