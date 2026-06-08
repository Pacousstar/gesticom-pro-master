const D = require('better-sqlite3')
const db = new D('./prisma/gesticom.db')

const alters = [
  'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME',
  'ALTER TABLE "PrintTemplate" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME',
  'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME',
]

for (const sql of alters) {
  try {
    db.exec(sql)
    const name = sql.match(/"(\w+)"\./)[1]
    const col = sql.match(/ADD COLUMN "(\w+)"/)[1]
    console.log('✅ ' + name + '.' + col)
  } catch (e) {
    if (e.message && e.message.includes('duplicate column')) {
      console.log('⏭ déjà présent')
    } else {
      console.log('❌ ' + e.message)
    }
  }
}

// Updates apres ajout
try { db.exec('UPDATE "Vente" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL'); console.log('✅ Vente.dateOperation mis à jour') } catch (e) { console.log('❌ ' + e.message) }
try { db.exec('UPDATE "Achat" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL'); console.log('✅ Achat.dateOperation mis à jour') } catch (e) { console.log('❌ ' + e.message) }
try { db.exec('UPDATE "Caisse" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL'); console.log('✅ Caisse.dateOperation mis à jour') } catch (e) { console.log('❌ ' + e.message) }

// Verification
;['Vente', 'PrintTemplate', 'Achat', 'Caisse'].forEach(t => {
  const cols = db.prepare("PRAGMA table_info('" + t + "')").all()
  const names = cols.map(c => c.name)
  console.log(t + ' (' + cols.length + ' cols): ' + names.join(', '))
})

db.close()
