const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'prisma', 'gesticom.db')
console.log('Base :', dbPath)

const db = new Database(dbPath)

// Désactiver les contraintes FK le temps du nettoyage
db.pragma('foreign_keys = OFF')

const tables = [
  'RetourLigne',
  'Retour',
  'VenteLigne',
  'Vente',
  'AchatLigne',
  'Achat',
  'ReglementVenteLigne',
  'ReglementVente',
  'ReglementAchatLigne',
  'ReglementAchat',
  'TransfertLigne',
  'Transfert',
  'MouvementCaisse',
  'Mouvement',
  'OperationBancaire',
  'EcritureComptable',
  'AuditLog',
  'Charge',
  'Depense',
  'ArchiveVenteLigne',
  'ArchiveVente',
  'ArchiveSoldeClient',
  'CommandeFournisseurLigne',
  'CommandeFournisseur',
  'SystemAlerte',
  'Stock',
]

const deleteAll = db.transaction(() => {
  for (const table of tables) {
    const count = db.prepare(`DELETE FROM "${table}"`).run()
    console.log(`  ✓ ${table.padEnd(32)} ${count.changes} ligne(s) supprimée(s)`)
  }
})

try {
  deleteAll()
  console.log('\n=== Nettoyage terminé ===')
} catch (e) {
  console.error('ERREUR :', e.message)
} finally {
  db.pragma('foreign_keys = ON')
  db.close()
}
