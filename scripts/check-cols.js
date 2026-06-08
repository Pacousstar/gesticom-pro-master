const D = require('better-sqlite3')
const db = new D('./prisma/gesticom.db')

const tables = ['Vente', 'PrintTemplate', 'Achat', 'Caisse', 'Charge', 'Depense']
const targetCols = ['dateOperation', 'estVenteRapide', 'entiteId', 'observation', 'sousType', 'modePaiement', 'pieceJustificative', 'banqueId', 'dateCloture', 'rapproche', 'createdAt']

for (const t of tables) {
  const cols = db.prepare("PRAGMA table_info('" + t + "')").all()
  const names = cols.map(c => c.name)
  console.log(t + ' (' + cols.length + ' cols): ' + names.join(', '))
  for (const tc of targetCols) {
    if (!names.includes(tc)) {
      console.log('  ❌ manquant: ' + tc)
    }
  }
}
db.close()
