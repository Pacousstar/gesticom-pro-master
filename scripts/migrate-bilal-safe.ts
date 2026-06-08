import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  console.log('=== Migration sans prisma db push ===\n')

  const alters = [
    `ALTER TABLE "Utilisateur" ADD COLUMN "rolesSupplementaires" TEXT;`,
    `ALTER TABLE "Utilisateur" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Utilisateur" ADD COLUMN "lastLoginAt" DATETIME;`,
    `ALTER TABLE "Utilisateur" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Utilisateur" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Magasin" ADD COLUMN "estDepotPrincipal" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Magasin" ADD COLUMN "soldeCaisse" REAL NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Magasin" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Produit" ADD COLUMN "prixMinimum" REAL DEFAULT 0;`,
    `ALTER TABLE "Produit" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Produit" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Stock" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Vente" ADD COLUMN "remiseGlobale" REAL NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Vente" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'VALIDEE';`,
    `ALTER TABLE "Vente" ADD COLUMN "montantPaye" REAL NOT NULL DEFAULT 0;`,
    `ALTER TABLE "Vente" ADD COLUMN "statutPaiement" TEXT NOT NULL DEFAULT 'CREDIT';`,
    `ALTER TABLE "Vente" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE "Vente" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "VenteLigne" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Achat" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "AchatLigne" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Caisse" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Mouvement" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Charge" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Depense" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "EcritureComptable" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "OperationBancaire" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "Banque" ADD COLUMN "updatedAt" DATETIME;`,
    `ALTER TABLE "ReglementAchat" ADD COLUMN "updatedAt" DATETIME;`,
  ]
  let ok = 0
  for (const s of alters) {
    try { await p.$executeRawUnsafe(s); ok++ } catch {}
  }
  console.log(`Colonnes ajoutées : ${ok}/${alters.length}`)

  const fixes = [
    `UPDATE "Achat" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "AchatLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Caisse" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Charge" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Depense" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "EcritureComptable" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Mouvement" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "OperationBancaire" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "ReglementAchat" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Vente" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "VenteLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;`,
    `UPDATE "Produit" SET "actif" = 1 WHERE "actif" IS NULL;`,
  ]
  for (const s of fixes) {
    try {
      const r = await p.$executeRawUnsafe(s)
      if (r) console.log(`  ${s.substring(0, 55)} → ${r} ligne(s)`)
    } catch {}
  }
  console.log()

  // Vérification stock
  const st: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite > 0')
  const neg: any = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM "Stock" WHERE quantite < 0')
  console.log('Stock > 0 : ' + Number(st[0].c))
  console.log('Stock < 0 : ' + Number(neg[0].c))

  await p.$disconnect()
}

main().catch(console.error)
