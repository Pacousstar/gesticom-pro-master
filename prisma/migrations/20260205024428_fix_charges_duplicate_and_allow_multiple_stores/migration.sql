-- AlterTable
ALTER TABLE "Client" ADD COLUMN "ncc" TEXT;

-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN "ncc" TEXT;

-- AlterTable
ALTER TABLE "Parametre" ADD COLUMN "logo" TEXT;

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN "permissionsPersonnalisees" TEXT;

-- CreateTable
CREATE TABLE "Depense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "categorie" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "montantPaye" REAL NOT NULL DEFAULT 0,
    "statutPaiement" TEXT NOT NULL DEFAULT 'PAYE',
    "modePaiement" TEXT NOT NULL,
    "beneficiaire" TEXT,
    "pieceJustificative" TEXT,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Depense_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Depense_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Depense_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Banque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "nomBanque" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "soldeInitial" REAL NOT NULL DEFAULT 0,
    "soldeActuel" REAL NOT NULL DEFAULT 0,
    "entiteId" INTEGER NOT NULL,
    "compteId" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Banque_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Banque_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "PlanCompte" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationBancaire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "banqueId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "soldeAvant" REAL NOT NULL,
    "soldeApres" REAL NOT NULL,
    "reference" TEXT,
    "beneficiaire" TEXT,
    "utilisateurId" INTEGER NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationBancaire_banqueId_fkey" FOREIGN KEY ("banqueId") REFERENCES "Banque" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OperationBancaire_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateurId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entiteId" INTEGER,
    "description" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanCompte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EcritureComptable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalId" INTEGER NOT NULL,
    "piece" TEXT,
    "libelle" TEXT NOT NULL,
    "compteId" INTEGER NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "reference" TEXT,
    "referenceType" TEXT,
    "referenceId" INTEGER,
    "utilisateurId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EcritureComptable_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EcritureComptable_compteId_fkey" FOREIGN KEY ("compteId") REFERENCES "PlanCompte" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EcritureComptable_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrintTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "logo" TEXT,
    "enTete" TEXT,
    "piedDePage" TEXT,
    "variables" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DashboardPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "utilisateurId" INTEGER NOT NULL,
    "widgets" TEXT,
    "periode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DashboardPreference_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Achat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "fournisseurId" INTEGER,
    "fournisseurLibre" TEXT,
    "montantTotal" REAL NOT NULL,
    "montantPaye" REAL NOT NULL DEFAULT 0,
    "statutPaiement" TEXT NOT NULL DEFAULT 'PAYE',
    "modePaiement" TEXT NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achat_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Achat_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Achat" ("createdAt", "date", "entiteId", "fournisseurId", "fournisseurLibre", "id", "magasinId", "modePaiement", "montantTotal", "numero", "observation", "utilisateurId") SELECT "createdAt", "date", "entiteId", "fournisseurId", "fournisseurLibre", "id", "magasinId", "modePaiement", "montantTotal", "numero", "observation", "utilisateurId" FROM "Achat";
DROP TABLE "Achat";
ALTER TABLE "new_Achat" RENAME TO "Achat";
CREATE UNIQUE INDEX "Achat_numero_key" ON "Achat"("numero");
CREATE INDEX "Achat_date_idx" ON "Achat"("date");
CREATE TABLE "new_Charge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "rubrique" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Charge_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Charge_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Charge_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Charge" ("createdAt", "date", "entiteId", "id", "montant", "observation", "rubrique", "type", "utilisateurId") SELECT "createdAt", "date", "entiteId", "id", "montant", "observation", "rubrique", "type", "utilisateurId" FROM "Charge";
DROP TABLE "Charge";
ALTER TABLE "new_Charge" RENAME TO "Charge";
CREATE INDEX "Charge_date_idx" ON "Charge"("date");
CREATE INDEX "Charge_type_idx" ON "Charge"("type");
CREATE INDEX "Charge_magasinId_idx" ON "Charge"("magasinId");
CREATE TABLE "new_Stock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produitId" INTEGER NOT NULL,
    "magasinId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "quantiteInitiale" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Stock_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Stock" ("id", "magasinId", "produitId", "quantite", "quantiteInitiale", "updatedAt") SELECT "id", "magasinId", "produitId", "quantite", "quantiteInitiale", "updatedAt" FROM "Stock";
DROP TABLE "Stock";
ALTER TABLE "new_Stock" RENAME TO "Stock";
CREATE UNIQUE INDEX "Stock_produitId_magasinId_key" ON "Stock"("produitId", "magasinId");
CREATE TABLE "new_Vente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "magasinId" INTEGER NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "clientLibre" TEXT,
    "montantTotal" REAL NOT NULL,
    "montantPaye" REAL NOT NULL DEFAULT 0,
    "statutPaiement" TEXT NOT NULL DEFAULT 'PAYE',
    "modePaiement" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'VALIDEE',
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vente_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "Entite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vente_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Vente" ("clientId", "clientLibre", "createdAt", "date", "entiteId", "id", "magasinId", "modePaiement", "montantTotal", "numero", "observation", "statut", "utilisateurId") SELECT "clientId", "clientLibre", "createdAt", "date", "entiteId", "id", "magasinId", "modePaiement", "montantTotal", "numero", "observation", "statut", "utilisateurId" FROM "Vente";
DROP TABLE "Vente";
ALTER TABLE "new_Vente" RENAME TO "Vente";
CREATE UNIQUE INDEX "Vente_numero_key" ON "Vente"("numero");
CREATE INDEX "Vente_date_idx" ON "Vente"("date");
CREATE INDEX "Vente_numero_idx" ON "Vente"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Depense_date_idx" ON "Depense"("date");

-- CreateIndex
CREATE INDEX "Depense_categorie_idx" ON "Depense"("categorie");

-- CreateIndex
CREATE INDEX "Depense_magasinId_idx" ON "Depense"("magasinId");

-- CreateIndex
CREATE UNIQUE INDEX "Banque_numero_key" ON "Banque"("numero");

-- CreateIndex
CREATE INDEX "Banque_entiteId_idx" ON "Banque"("entiteId");

-- CreateIndex
CREATE INDEX "Banque_compteId_idx" ON "Banque"("compteId");

-- CreateIndex
CREATE INDEX "OperationBancaire_banqueId_idx" ON "OperationBancaire"("banqueId");

-- CreateIndex
CREATE INDEX "OperationBancaire_date_idx" ON "OperationBancaire"("date");

-- CreateIndex
CREATE INDEX "OperationBancaire_type_idx" ON "OperationBancaire"("type");

-- CreateIndex
CREATE INDEX "AuditLog_date_idx" ON "AuditLog"("date");

-- CreateIndex
CREATE INDEX "AuditLog_utilisateurId_idx" ON "AuditLog"("utilisateurId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_type_idx" ON "AuditLog"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCompte_numero_key" ON "PlanCompte"("numero");

-- CreateIndex
CREATE INDEX "PlanCompte_numero_idx" ON "PlanCompte"("numero");

-- CreateIndex
CREATE INDEX "PlanCompte_classe_idx" ON "PlanCompte"("classe");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_code_key" ON "Journal"("code");

-- CreateIndex
CREATE INDEX "Journal_code_idx" ON "Journal"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EcritureComptable_numero_key" ON "EcritureComptable"("numero");

-- CreateIndex
CREATE INDEX "EcritureComptable_date_idx" ON "EcritureComptable"("date");

-- CreateIndex
CREATE INDEX "EcritureComptable_journalId_idx" ON "EcritureComptable"("journalId");

-- CreateIndex
CREATE INDEX "EcritureComptable_compteId_idx" ON "EcritureComptable"("compteId");

-- CreateIndex
CREATE INDEX "EcritureComptable_referenceType_referenceId_idx" ON "EcritureComptable"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "PrintTemplate_type_idx" ON "PrintTemplate"("type");

-- CreateIndex
CREATE INDEX "PrintTemplate_actif_idx" ON "PrintTemplate"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardPreference_utilisateurId_key" ON "DashboardPreference"("utilisateurId");
