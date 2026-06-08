const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'prisma', 'gesticom.db')
console.log('Base:', dbPath)

// Ouvrir en mode écriture
const db = new Database(dbPath)

try {
  // Activer l'écriture directe dans sqlite_master via exec (contourne la validation de schéma)
  db.exec("PRAGMA writable_schema = ON")
  
  // Supprimer l'index orphelin directement de sqlite_master
  const result = db.exec("SELECT COUNT(*) FROM sqlite_master WHERE name = 'ArchiveVente_date_idx'")
  console.log('Exec result:', result)

  db.exec("DELETE FROM sqlite_master WHERE name = 'ArchiveVente_date_idx'")
  console.log('Index supprimé de sqlite_master')

  db.exec("PRAGMA writable_schema = OFF")
  
  // Vérification
  db.exec("SELECT * FROM sqlite_master LIMIT 1") // Force reload
  
  const check = db.prepare('PRAGMA integrity_check').get()
  console.log('Intégrité:', JSON.stringify(check))
  
  if (check && check['integrity_check'] === 'ok') {
    console.log('✅ Base réparée!')
  } else {
    console.log('⚠️ Problème persistant')
  }

  // Stats stock
  const st = db.prepare('SELECT COUNT(*) as c FROM "Stock"').get()
  const pos = db.prepare('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0').get()
  console.log(`Stock: ${st.c} lignes, ${pos.c} positifs`)
  
} catch (e) {
  console.error('ERREUR:', e.message)
} finally {
  db.close()
}
