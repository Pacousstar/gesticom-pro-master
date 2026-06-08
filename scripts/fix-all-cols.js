const D = require('better-sqlite3')
const db = new D('./prisma/gesticom.db')

// Toutes les colonnes a ajouter par table
// Format: [table, colonne, type, defaut]
const addCols = [
  ['VenteLigne', 'createdAt', 'DATETIME', null],
  ['AchatLigne', 'coutUnitaire', 'REAL', '0'],
  ['AchatLigne', 'createdAt', 'DATETIME', null],
  ['Vente', 'dateOperation', 'DATETIME', null],
  ['Achat', 'dateOperation', 'DATETIME', null],
  ['Caisse', 'dateOperation', 'DATETIME', null],
  ['Caisse', 'observation', 'TEXT', null],
  ['Caisse', 'sousType', 'TEXT', 'MANUEL'],
  ['Charge', 'modePaiement', 'TEXT', 'ESPECES'],
  ['Charge', 'pieceJustificative', 'TEXT', null],
  ['Charge', 'banqueId', 'INTEGER', null],
  ['Depense', 'banqueId', 'INTEGER', null],
  ['Parametre', 'dateCloture', 'DATETIME', null],
  ['Parametre', 'entiteId', 'INTEGER', '1'],
  ['PrintTemplate', 'entiteId', 'INTEGER', '1'],
  ['Vente', 'estVenteRapide', 'INTEGER', '0'],
  ['ReglementAchat', 'rapproche', 'INTEGER', '0'],
  ['ReglementAchat', 'banqueId', 'INTEGER', null],
  ['ReglementAchat', 'updatedAt', 'DATETIME', null],
  ['ReglementAchat', 'entiteId', 'INTEGER', '1'],
  ['ReglementVente', 'rapproche', 'INTEGER', '0'],
  ['ReglementVente', 'banqueId', 'INTEGER', null],
  ['ReglementVente', 'entiteId', 'INTEGER', '1'],
  ['OperationBancaire', 'entiteId', 'INTEGER', '1'],
  ['EcritureComptable', 'entiteId', 'INTEGER', '1'],
  ['Banque', 'compteId', 'INTEGER', null],
  ['Banque', 'actif', 'INTEGER', '1'],
  ['Depense', 'montantPaye', 'REAL', '0'],
  ['Depense', 'statutPaiement', 'TEXT', 'PAYE'],
  ['Mouvement', 'dateOperation', 'DATETIME', null],
  ['Client', 'soldeInitial', 'REAL', '0'],
  ['Client', 'avoirInitial', 'REAL', '0'],
  ['Fournisseur', 'soldeInitial', 'REAL', '0'],
  ['Fournisseur', 'avoirInitial', 'REAL', '0'],
  ['Fournisseur', 'numeroCamion', 'TEXT', null],
]

let added = 0, skipped = 0
for (const [table, col, type, def] of addCols) {
  // Check if column already exists
  const cols = db.prepare("PRAGMA table_info('" + table + "')").all()
  const names = cols.map(c => c.name)
  if (names.includes(col)) {
    skipped++
    continue
  }
  let sql = 'ALTER TABLE "' + table + '" ADD COLUMN "' + col + '" ' + type
  if (def !== null) {
    sql += ' NOT NULL DEFAULT ' + def
  }
  try {
    db.exec(sql)
    console.log('+ ' + table + '.' + col)
    added++
  } catch (e) {
    console.log('  ERR ' + table + '.' + col + ': ' + e.message)
  }
}
console.log(added + ' ajoutees, ' + skipped + ' deja presentes')

// Update not null values after add
const updates = [
  'UPDATE "Vente" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL',
  'UPDATE "Achat" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL',
  'UPDATE "Caisse" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL',
  'UPDATE "Mouvement" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL',
  'UPDATE "VenteLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL',
  'UPDATE "AchatLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL',
  'UPDATE "AchatLigne" SET "coutUnitaire" = 0 WHERE "coutUnitaire" IS NULL',
]
for (const sql of updates) {
  try {
    const r = db.exec(sql)
    console.log('UPDATE OK: ' + sql.substring(0, 50))
  } catch (e) {
    console.log('UPDATE ERR: ' + e.message)
  }
}

// Final verification
const checks = ['Vente', 'VenteLigne', 'Achat', 'AchatLigne', 'PrintTemplate']
for (const t of checks) {
  const cols = db.prepare("PRAGMA table_info('" + t + "')").all()
  console.log(t + ' (' + cols.length + '): ' + cols.map(c => c.name).join(', '))
}

db.close()
