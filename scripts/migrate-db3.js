const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = 'C:/Users/GSN-EXPERTISES/Projets/gesticom-pro-master/gesticom.db';
const logFile = path.join(projectRoot, 'GestiComService.out');
const errFile = path.join(projectRoot, 'GestiComService.err');
const tmpFile = path.join(projectRoot, '_migrate.sql');

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [migrate] ' + msg + '\n'); } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [migrate] ' + msg + '\n'); } catch {}
}

// Generate all SQL
const sql = `
-- Columns migrations
ALTER TABLE "Utilisateur" ADD COLUMN "rolesSupplementaires" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Utilisateur" ADD COLUMN "lastLoginAt" DATETIME;
ALTER TABLE "Utilisateur" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Magasin" ADD COLUMN "estDepotPrincipal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Magasin" ADD COLUMN "soldeCaisse" REAL NOT NULL DEFAULT 0;

ALTER TABLE "Produit" ADD COLUMN "codeBarres" TEXT;
ALTER TABLE "Produit" ADD COLUMN "unite" TEXT NOT NULL DEFAULT 'unite';
ALTER TABLE "Produit" ADD COLUMN "pamp" REAL DEFAULT 0;
ALTER TABLE "Produit" ADD COLUMN "fournisseurId" INTEGER REFERENCES "Fournisseur"("id");
ALTER TABLE "Produit" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Produit" ADD COLUMN "prixMinimum" REAL DEFAULT 0;

ALTER TABLE "Stock" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Mouvement" ADD COLUMN "dateOperation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Mouvement" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Client" ADD COLUMN "code" TEXT;
ALTER TABLE "Client" ADD COLUMN "email" TEXT;
ALTER TABLE "Client" ADD COLUMN "adresse" TEXT;
ALTER TABLE "Client" ADD COLUMN "localisation" TEXT;
ALTER TABLE "Client" ADD COLUMN "soldeInitial" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "avoirInitial" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "pointsFidelite" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Fournisseur" ADD COLUMN "code" TEXT;
ALTER TABLE "Fournisseur" ADD COLUMN "adresse" TEXT;
ALTER TABLE "Fournisseur" ADD COLUMN "localisation" TEXT;
ALTER TABLE "Fournisseur" ADD COLUMN "soldeInitial" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Fournisseur" ADD COLUMN "avoirInitial" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Fournisseur" ADD COLUMN "numeroCamion" TEXT;
ALTER TABLE "Fournisseur" ADD COLUMN "entiteId" INTEGER DEFAULT 1;

ALTER TABLE "Vente" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Vente" ADD COLUMN "remiseGlobale" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Vente" ADD COLUMN "pointsGagnes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vente" ADD COLUMN "estVenteRapide" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vente" ADD COLUMN "numeroBon" TEXT;
ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Vente" ADD COLUMN "estHistorique" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Vente" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "VenteLigne" ADD COLUMN "coutUnitaire" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VenteLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VenteLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VenteLigne" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Achat" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Achat" ADD COLUMN "statut" TEXT NOT NULL DEFAULT 'VALIDEE';
ALTER TABLE "Achat" ADD COLUMN "numeroCamion" TEXT;
ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Achat" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "AchatLigne" ADD COLUMN "coutUnitaire" REAL NOT NULL DEFAULT 0;
ALTER TABLE "AchatLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;
ALTER TABLE "AchatLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;
ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AchatLigne" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Charge" ADD COLUMN "statut" TEXT DEFAULT 'VALIDE';
ALTER TABLE "Charge" ADD COLUMN "beneficiaire" TEXT;
ALTER TABLE "Charge" ADD COLUMN "modePaiement" TEXT NOT NULL DEFAULT 'ESPECES';
ALTER TABLE "Charge" ADD COLUMN "pieceJustificative" TEXT;
ALTER TABLE "Charge" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"("id");
ALTER TABLE "Charge" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Depense" ADD COLUMN "banqueId" INTEGER REFERENCES "Banque"("id");
ALTER TABLE "Depense" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Banque" ADD COLUMN "compteId" INTEGER REFERENCES "PlanCompte"("id");
ALTER TABLE "Banque" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Banque" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Caisse" ADD COLUMN "observation" TEXT;
ALTER TABLE "Caisse" ADD COLUMN "sousType" TEXT NOT NULL DEFAULT 'MANUEL';
ALTER TABLE "Caisse" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "Caisse" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Parametre" ADD COLUMN "slogan" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "email" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "siteWeb" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "numNCC" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "typeCommerce" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Parametre" ADD COLUMN "piedDePage" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "smtpHost" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "Parametre" ADD COLUMN "smtpUser" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "smtpPass" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "backupAuto" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parametre" ADD COLUMN "backupFrequence" TEXT NOT NULL DEFAULT 'QUOTIDIEN';
ALTER TABLE "Parametre" ADD COLUMN "backupDestination" TEXT NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "Parametre" ADD COLUMN "backupEmailDest" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "fideliteActive" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parametre" ADD COLUMN "fideliteSeuilPoints" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Parametre" ADD COLUMN "fideliteTauxRemise" REAL NOT NULL DEFAULT 5;
ALTER TABLE "Parametre" ADD COLUMN "logoLocal" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "registreCommerce" TEXT;
ALTER TABLE "Parametre" ADD COLUMN "mentionSpeciale" TEXT DEFAULT 'Les produits sortis du magasin ne seront plus repris. Veuillez exiger votre facture avant de partir.';
ALTER TABLE "Parametre" ADD COLUMN "dateCloture" DATETIME;

ALTER TABLE "OperationBancaire" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OperationBancaire" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "EcritureComptable" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "EcritureComptable" ADD COLUMN "entiteId" INTEGER DEFAULT 1;

ALTER TABLE "PrintTemplate" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ReglementVente" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReglementVente" ADD COLUMN "banqueId" INTEGER;

ALTER TABLE "ReglementAchat" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReglementAchat" ADD COLUMN "banqueId" INTEGER;
ALTER TABLE "ReglementAchat" ADD COLUMN "updatedAt" DATETIME;
`;

const createSql = `
CREATE TABLE IF NOT EXISTS "ReglementVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT 'VALIDE', "rapproche" INTEGER NOT NULL DEFAULT 0, "banqueId" INTEGER, "venteId" INTEGER, "clientId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "entiteId" INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS "ReglementVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "venteId" INTEGER NOT NULL, "montant" REAL NOT NULL);
CREATE TABLE IF NOT EXISTS "ReglementAchat" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT 'VALIDE', "rapproche" INTEGER NOT NULL DEFAULT 0, "achatId" INTEGER, "fournisseurId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME, "entiteId" INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS "ReglementAchatLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "achatId" INTEGER NOT NULL, "montant" REAL NOT NULL);
CREATE TABLE IF NOT EXISTS "ArchiveVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numeroFactureOrigine" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montantTotal" REAL NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "ArchiveVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "venteId" INTEGER NOT NULL, "produitId" INTEGER, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "montant" REAL NOT NULL);
CREATE TABLE IF NOT EXISTS "ArchiveSoldeClient" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montant" REAL NOT NULL, "dateArchive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "CommandeFournisseur" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numero" TEXT NOT NULL UNIQUE, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "fournisseurId" INTEGER, "fournisseurLibre" TEXT, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "montantTotal" REAL NOT NULL DEFAULT 0, "fraisApproche" REAL NOT NULL DEFAULT 0, "observation" TEXT, "statut" TEXT NOT NULL DEFAULT 'BROUILLON', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);
CREATE TABLE IF NOT EXISTS "CommandeFournisseurLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "commandeId" INTEGER NOT NULL, "produitId" INTEGER NOT NULL, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "tva" REAL NOT NULL DEFAULT 0, "remise" REAL NOT NULL DEFAULT 0, "montant" REAL NOT NULL);
CREATE TABLE IF NOT EXISTS "SystemAlerte" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "type" TEXT NOT NULL DEFAULT 'INFO', "categorie" TEXT NOT NULL DEFAULT 'AUTRE', "message" TEXT NOT NULL, "referenceId" INTEGER, "lu" INTEGER NOT NULL DEFAULT 0, "entiteId" INTEGER DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Licence" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "cle" TEXT NOT NULL, "clientNom" TEXT, "debutValidite" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finValidite" DATETIME, "statut" TEXT NOT NULL DEFAULT 'ACTIVE', "features" TEXT NOT NULL DEFAULT '[]', "typeEssai" INTEGER NOT NULL DEFAULT 0, "debutEssai" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);
`;

const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');

l('Migration started');

// Step 1: Add columns
l('Step 1: Adding columns...');
fs.writeFileSync(tmpFile, sql, 'utf-8');
try {
  execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
    cwd: projectRoot,
    stdio: 'pipe',
    timeout: 30000,
  });
  l('Columns added successfully');
} catch (err) {
  const msg = err.stderr ? err.stderr.toString() : err.message;
  l('Columns addition: ' + msg.split('\n')[0]);
}

// Step 2: Create tables
l('Step 2: Creating tables...');
fs.writeFileSync(tmpFile, createSql, 'utf-8');
try {
  execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
    cwd: projectRoot,
    stdio: 'pipe',
    timeout: 30000,
  });
  l('Tables created successfully');
} catch (err) {
  const msg = err.stderr ? err.stderr.toString() : err.message;
  l('Tables creation: ' + msg.split('\n')[0]);
}

// Step 3: prisma db push for indexes/constraints
l('Step 3: Prisma db push for final sync...');
try {
  execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: 'pipe',
    timeout: 120000,
  });
  l('Prisma db push completed');
} catch (err) {
  const msg = err.stderr ? err.stderr.toString() : err.message;
  e('Prisma db push error: ' + msg);
  l('Prisma db push: ' + msg.split('\n')[0]);
}

if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);

l('Migration completed');
console.log('Migration completed');
