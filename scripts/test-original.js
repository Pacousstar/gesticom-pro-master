const Database = require('better-sqlite3')

const original = 'C:\\Users\\GSN-EXPERTISES\\Projets\\gesticom - BILAL0706\\gesticom.db'
const local = __dirname + '\\..\\prisma\\gesticom.db'

for (const [label, path] of [['ORIGINAL', original], ['LOCAL', local]]) {
  try {
    const db = new Database(path)
    const st = db.prepare('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0').get()
    const neg = db.prepare('SELECT COUNT(*) as c FROM "Stock" WHERE quantite < 0').get()
    console.log(`${label}: Stock >0=${st.c}, <0=${neg.c} ✅`)
    db.close()
  } catch (e) {
    console.log(`${label}: ${e.message} ❌`)
    if (e.message.includes('malformed database schema')) {
      // Try to recover
      try {
        const db2 = new Database(path, { readonly: false })
        db2.exec("PRAGMA writable_schema = ON")
        db2.exec("DELETE FROM sqlite_master WHERE name = 'ArchiveVente_date_idx'")
        db2.exec("PRAGMA writable_schema = OFF")
        const st2 = db2.prepare('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0').get()
        console.log(`  Après réparation: Stock >0=${st2.c}`)
        db2.close()
      } catch (e2) {
        console.log(`  Réparation impossible: ${e2.message}`)
      }
    }
  }
}
