import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  console.log('=== Migration COMPLÈTE ===\n')

  // 1. Tables manquantes
  const createTables = [
    `CREATE TABLE IF NOT EXISTS "Retour" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "numero" TEXT NOT NULL UNIQUE,
      "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "venteId" INTEGER NOT NULL REFERENCES "Vente"(id),
      "clientId" INTEGER REFERENCES "Client"(id),
      "magasinId" INTEGER NOT NULL REFERENCES "Magasin"(id),
      "entiteId" INTEGER NOT NULL REFERENCES "Entite"(id),
      "utilisateurId" INTEGER NOT NULL REFERENCES "Utilisateur"(id),
      "montantTotal" REAL NOT NULL,
      "observation" TEXT,
      "estRembourse" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "RetourLigne" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "retourId" INTEGER NOT NULL REFERENCES "Retour"(id) ON DELETE CASCADE,
      "produitId" INTEGER NOT NULL REFERENCES "Produit"(id),
      "designation" TEXT NOT NULL,
      "quantite" REAL NOT NULL,
      "prixUnitaire" REAL NOT NULL,
      "tva" REAL NOT NULL DEFAULT 0,
      "remise" REAL NOT NULL DEFAULT 0,
      "montant" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ReglementAchatLigne" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "reglementId" INTEGER NOT NULL REFERENCES "ReglementAchat"(id) ON DELETE CASCADE,
      "achatId" INTEGER NOT NULL REFERENCES "Achat"(id) ON DELETE CASCADE,
      "montant" REAL NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "ReglementVenteLigne" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "reglementId" INTEGER NOT NULL REFERENCES "ReglementVente"(id) ON DELETE CASCADE,
      "venteId" INTEGER NOT NULL REFERENCES "Vente"(id) ON DELETE CASCADE,
      "montant" REAL NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "SystemAlerte" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "type" TEXT NOT NULL DEFAULT 'INFO',
      "categorie" TEXT NOT NULL DEFAULT 'AUTRE',
      "message" TEXT NOT NULL,
      "referenceId" INTEGER,
      "lu" INTEGER NOT NULL DEFAULT 0,
      "entiteId" INTEGER DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Licence" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "cle" TEXT NOT NULL,
      "clientNom" TEXT,
      "debutValidite" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finValidite" DATETIME,
      "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
      "features" TEXT NOT NULL DEFAULT '[]',
      "typeEssai" INTEGER NOT NULL DEFAULT 0,
      "debutEssai" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ]
  let ct = 0
  for (const sql of createTables) {
    try { await p.$executeRawUnsafe(sql); ct++; console.log(`  + Table créée`) }
    catch (e: any) { console.log(`  - ${e.message?.substring(0, 80)}`) }
  }
  console.log(`Tables créées : ${ct}/${createTables.length}\n`)

  // 2. Index pour les nouvelles tables
  const indexes = [
    `CREATE INDEX IF NOT EXISTS "Retour_date_idx" ON "Retour"(date)`,
    `CREATE INDEX IF NOT EXISTS "Retour_venteId_idx" ON "Retour"(venteId)`,
    `CREATE INDEX IF NOT EXISTS "Retour_clientId_idx" ON "Retour"(clientId)`,
    `CREATE INDEX IF NOT EXISTS "Retour_entiteId_idx" ON "Retour"(entiteId)`,
    `CREATE INDEX IF NOT EXISTS "Retour_magasinId_idx" ON "Retour"(magasinId)`,
    `CREATE INDEX IF NOT EXISTS "RetourLigne_retourId_idx" ON "RetourLigne"(retourId)`,
    `CREATE INDEX IF NOT EXISTS "RetourLigne_produitId_idx" ON "RetourLigne"(produitId)`,
    `CREATE INDEX IF NOT EXISTS "ReglementAchatLigne_reglementId_idx" ON "ReglementAchatLigne"(reglementId)`,
    `CREATE INDEX IF NOT EXISTS "ReglementAchatLigne_achatId_idx" ON "ReglementAchatLigne"(achatId)`,
    `CREATE INDEX IF NOT EXISTS "ReglementVenteLigne_reglementId_idx" ON "ReglementVenteLigne"(reglementId)`,
    `CREATE INDEX IF NOT EXISTS "ReglementVenteLigne_venteId_idx" ON "ReglementVenteLigne"(venteId)`,
    `CREATE INDEX IF NOT EXISTS "SystemAlerte_date_idx" ON "SystemAlerte"(date)`,
    `CREATE INDEX IF NOT EXISTS "SystemAlerte_type_idx" ON "SystemAlerte"(type)`,
    `CREATE INDEX IF NOT EXISTS "SystemAlerte_categorie_idx" ON "SystemAlerte"(categorie)`,
    `CREATE INDEX IF NOT EXISTS "SystemAlerte_lu_idx" ON "SystemAlerte"(lu)`,
  ]
  for (const sql of indexes) {
    try { await p.$executeRawUnsafe(sql) }
    catch {}
  }
  console.log(`Index créés\n`)

  // 3. Colonnes manquantes sur les tables existantes
  const alters: { table: string; col: string; sql: string }[] = [
    // Caisse
    { table: 'Caisse', col: 'dateOperation', sql: `ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP` },
    { table: 'Caisse', col: 'observation', sql: `ALTER TABLE "Caisse" ADD COLUMN "observation" TEXT` },
    { table: 'Caisse', col: 'sousType', sql: `ALTER TABLE "Caisse" ADD COLUMN "sousType" TEXT NOT NULL DEFAULT 'MANUEL'` },
    // Charge
    { table: 'Charge', col: 'modePaiement', sql: `ALTER TABLE "Charge" ADD COLUMN "modePaiement" TEXT NOT NULL DEFAULT 'ESPECES'` },
    { table: 'Charge', col: 'pieceJustificative', sql: `ALTER TABLE "Charge" ADD COLUMN "pieceJustificative" TEXT` },
    { table: 'Charge', col: 'banqueId', sql: `ALTER TABLE "Charge" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"(id)` },
    // Depense
    { table: 'Depense', col: 'banqueId', sql: `ALTER TABLE "Depense" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"(id)` },
    // Vente
    { table: 'Vente', col: 'dateOperation', sql: `ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME DEFAULT CURRENT_TIMESTAMP` },
    { table: 'Vente', col: 'estVenteRapide', sql: `ALTER TABLE "Vente" ADD COLUMN "estVenteRapide" INTEGER NOT NULL DEFAULT 0` },
    // VenteLigne
    { table: 'VenteLigne', col: 'createdAt', sql: `ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP` },
    // AchatLigne
    { table: 'AchatLigne', col: 'createdAt', sql: `ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP` },
    // ReglementAchat
    { table: 'ReglementAchat', col: 'rapproche', sql: `ALTER TABLE "ReglementAchat" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0` },
    { table: 'ReglementAchat', col: 'banqueId', sql: `ALTER TABLE "ReglementAchat" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"(id)` },
    // ReglementVente
    { table: 'ReglementVente', col: 'rapproche', sql: `ALTER TABLE "ReglementVente" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0` },
    { table: 'ReglementVente', col: 'banqueId', sql: `ALTER TABLE "ReglementVente" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"(id)` },
    // Parametre
    { table: 'Parametre', col: 'dateCloture', sql: `ALTER TABLE "Parametre" ADD COLUMN "dateCloture" DATETIME` },
  ]
  let ak = 0
  for (const a of alters) {
    try {
      await p.$executeRawUnsafe(a.sql)
      console.log(`  + ${a.table}.${a.col}`)
      ak++
    } catch (e: any) {
      const msg = e.message || ''
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        console.log(`  - ${a.table}.${a.col} : ${msg.substring(0, 80)}`)
      }
    }
  }
  console.log(`\nColonnes ajoutées : ${ak}/${alters.length}`)

  // 4. Data fixes
  const updates = [
    `UPDATE "Caisse" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL`,
    `UPDATE "Caisse" SET "sousType" = 'MANUEL' WHERE "sousType" IS NULL`,
    `UPDATE "Charge" SET "modePaiement" = 'ESPECES' WHERE "modePaiement" IS NULL`,
    `UPDATE "Vente" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL`,
    `UPDATE "VenteLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`,
    `UPDATE "AchatLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL`,
  ]
  for (const sql of updates) {
    try {
      const r = await p.$executeRawUnsafe(sql)
      if (r && Number(r) > 0) console.log(`  UPDATE → ${r} ligne(s)`)
    } catch {}
  }

  // 5. Vérification finale
  const tables = await p.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM sqlite_master WHERE type=? ORDER BY name', 'table')
  const expected = ['Achat','AchatLigne','ArchiveSoldeClient','ArchiveVente','ArchiveVenteLigne','AuditLog','Banque','Caisse','Charge','Client','CommandeFournisseur','CommandeFournisseurLigne','DashboardPreference','Depense','EcritureComptable','Entite','Fournisseur','Journal','Licence','Magasin','Mouvement','OperationBancaire','Parametre','PlanCompte','PrintTemplate','Produit','ReglementAchat','ReglementAchatLigne','ReglementVente','ReglementVenteLigne','Retour','RetourLigne','Stock','SystemAlerte','Transfert','TransfertLigne','Utilisateur','Vente','VenteLigne']
  const present = new Set(tables.map((t: any) => t.name))
  const missing = expected.filter(t => !present.has(t))
  if (missing.length > 0) {
    console.log(`\n❌ Tables encore manquantes : ${missing.join(', ')}`)
  } else {
    console.log(`\n✅ Toutes les ${expected.length} tables présentes`)
  }

  const st: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite>0')
  const neg: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite<0')
  console.log(`Stock >0: ${Number(st[0].c)}  Stock <0: ${Number(neg[0].c)}`)

  await p.$disconnect()
}
main().catch(console.error)
