const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'prisma', 'gesticom.db')
console.log('Base:', dbPath)

const db = new Database(dbPath)

// 1. Lister les index
const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL").all()
console.log('Index:', indexes.length)

// 2. Lister les tables
const tables = new Set()
const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
for (const t of tableRows) tables.add(t.name)

// 3. Supprimer les index orphelins
let dropped = 0
for (const idx of indexes) {
  if (!tables.has(idx.tbl_name)) {
    console.log(`  Orphelin: ${idx.name} (table ${idx.tbl_name})`)
    try {
      db.prepare(`DROP INDEX "${idx.name}"`).run()
      dropped++
    } catch (e) {
      console.log(`  Erreur: ${e.message}`)
    }
  }
}
console.log(`Supprimés: ${dropped}`)

// 4. Vérification
const check = db.prepare('PRAGMA integrity_check').get()
console.log('Intégrité:', JSON.stringify(check))

// 5. Stats stock
const st = db.prepare('SELECT COUNT(*) as c FROM "Stock"').get()
const pos = db.prepare('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0').get()
console.log(`Stock: ${st.c} lignes, ${pos.c} positifs`)

db.close()
console.log('Terminé')
