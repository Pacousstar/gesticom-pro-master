import Database from 'better-sqlite3';

const db = new Database('C:/gesticom/gesticom.db', { readonly: true });

// Check vente table columns
const venteCols = db.prepare("PRAGMA table_info(vente)").all();
console.log('Vente columns:');
for (const c of venteCols) {
  console.log('  ' + c.name + ' (' + c.type + ')');
}

// The mouvement reference format is V1781514890503
// We need to find the vente that matches this reference
// Usually it's stored in a field like "numero" or "id"
// Let me check what field stores "V1781514890503"

// Check vente table indexes
const indexes = db.prepare("PRAGMA index_list(vente)").all();
console.log('\nVente indexes:');
for (const idx of indexes) {
  const cols = db.prepare("PRAGMA index_info(" + idx.name + ")").all();
  console.log('  ' + idx.name + ' on ' + cols.map(c => c.name).join(', '));
}

// Check how vente references are stored
// The Modif Vente observation says "Modif Vente V1781514890503"
// So the reference "V1781514890503" is the vente identifier
// Let me check if vente has a "reference" column
const hasRef = venteCols.find(c => c.name === 'reference');
if (!hasRef) {
  console.log('\nNo reference column. Checking numero column format...');
  const sample = db.prepare("SELECT id, numero, date, montantTotal, clientLibre FROM vente WHERE numero LIKE 'V178151489%'").all();
  console.log('Samples:', sample.length);
  for (const s of sample) {
    console.log('  id=' + s.id + ' numero="' + s.numero + '" date=' + s.date + ' total=' + s.montantTotal + ' client=' + (s.clientLibre || ''));
  }
}

db.close();
