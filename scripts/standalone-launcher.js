const path = require('path');
const fs = require('fs');
const { fork, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const logFile = path.join(projectRoot, 'GestiComService.out');
const errFile = path.join(projectRoot, 'GestiComService.err');
const PORT = parseInt(process.env.PORT || '3001', 10);
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const dbPath = 'C:/gesticom/gesticom.db';
const flagFile = path.join(projectRoot, '.migrated');
const tmpFile = path.join(projectRoot, '_mig.sql');

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}

l('Démarrage...');
l(`PORT=${PORT}, root=${projectRoot}`);
l(`DATABASE_URL défini`);

process.env.DATABASE_URL = 'file:C:/gesticom/gesticom.db';
process.env.NODE_ENV = 'production';
process.env.PORT = String(PORT);

const serverPath = path.join(projectRoot, 'server.js');
if (!fs.existsSync(serverPath)) {
  e(`server.js introuvable dans ${projectRoot}`);
  process.exit(1);
}

l('Migration automatique de la base de donnees...');

// ═══════════════════════════════════════════════════════════════════
//  SÉCURITÉ : prisma db push est DÉSACTIVÉ car il peut recréer
//  les tables avec --accept-data-loss et corrompre les données
//  (notamment Stock, en mélangeant les colonnes).
//  On utilise uniquement les ALTER TABLE + CREATE TABLE ci-dessous,
//  qui sont 100% sûrs (ils n'affectent que la structure, pas les données).
// ═══════════════════════════════════════════════════════════════════

function execOne(sql) {
  try {
    fs.writeFileSync(tmpFile, sql.trim(), 'utf-8');
    execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 30000,
    });
    return true;
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) return 'exists';
    return false;
  }
}

function execBatch(sqlList) {
  for (const stmt of sqlList) execOne(stmt);
}

// Build all ALTER TABLE + CREATE TABLE + UPDATE statements
const addStmts = [
  // --- Utilisateur ---
  'ALTER TABLE "Utilisateur" ADD COLUMN "rolesSupplementaires" TEXT;',
  'ALTER TABLE "Utilisateur" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Utilisateur" ADD COLUMN "lastLoginAt" DATETIME;',
  'ALTER TABLE "Utilisateur" ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Utilisateur" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Magasin ---
  'ALTER TABLE "Magasin" ADD COLUMN "estDepotPrincipal" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Magasin" ADD COLUMN "soldeCaisse" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Magasin" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Produit ---
  'ALTER TABLE "Produit" ADD COLUMN "codeBarres" TEXT;',
  'ALTER TABLE "Produit" ADD COLUMN "unite" TEXT NOT NULL DEFAULT \'unite\';',
  'ALTER TABLE "Produit" ADD COLUMN "pamp" REAL DEFAULT 0;',
  'ALTER TABLE "Produit" ADD COLUMN "fournisseurId" INTEGER;',
  'ALTER TABLE "Produit" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE "Produit" ADD COLUMN "prixMinimum" REAL DEFAULT 0;',
  'ALTER TABLE "Produit" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;',
  // --- Stock ---
  'ALTER TABLE "Stock" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Mouvement ---
  'ALTER TABLE "Mouvement" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Mouvement" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Mouvement" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Client ---
  'ALTER TABLE "Client" ADD COLUMN "code" TEXT;',
  'ALTER TABLE "Client" ADD COLUMN "email" TEXT;',
  'ALTER TABLE "Client" ADD COLUMN "adresse" TEXT;',
  'ALTER TABLE "Client" ADD COLUMN "localisation" TEXT;',
  'ALTER TABLE "Client" ADD COLUMN "soldeInitial" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Client" ADD COLUMN "avoirInitial" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Client" ADD COLUMN "pointsFidelite" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Client" ADD COLUMN "type" TEXT NOT NULL DEFAULT \'CASH\';',
  'ALTER TABLE "Client" ADD COLUMN "plafondCredit" REAL;',
  'ALTER TABLE "Client" ADD COLUMN "ncc" TEXT;',
  'ALTER TABLE "Client" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE "Client" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Fournisseur ---
  'ALTER TABLE "Fournisseur" ADD COLUMN "code" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "adresse" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "localisation" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "soldeInitial" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "avoirInitial" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "numeroCamion" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "email" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "ncc" TEXT;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE "Fournisseur" ADD COLUMN "entiteId" INTEGER DEFAULT 1;',
  // --- Vente ---
  'ALTER TABLE "Vente" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "remiseGlobale" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "pointsGagnes" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "estVenteRapide" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "numeroBon" TEXT;',
  'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Vente" ADD COLUMN "estHistorique" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "statut" TEXT NOT NULL DEFAULT \'VALIDEE\';',
  'ALTER TABLE "Vente" ADD COLUMN "montantPaye" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Vente" ADD COLUMN "statutPaiement" TEXT NOT NULL DEFAULT \'CREDIT\';',
  'ALTER TABLE "Vente" ADD COLUMN "modePaiement" TEXT NOT NULL DEFAULT \'ESPECES\';',
  'ALTER TABLE "Vente" ADD COLUMN "observation" TEXT;',
  'ALTER TABLE "Vente" ADD COLUMN "createdAt" DATETIME;',
  'ALTER TABLE "Vente" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Vente" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- VenteLigne ---
  'ALTER TABLE "VenteLigne" ADD COLUMN "coutUnitaire" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "updatedAt" DATETIME;',
  // --- Achat ---
  'ALTER TABLE "Achat" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Achat" ADD COLUMN "statut" TEXT NOT NULL DEFAULT \'VALIDEE\';',
  'ALTER TABLE "Achat" ADD COLUMN "numeroCamion" TEXT;',
  'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Achat" ADD COLUMN "montantPaye" REAL DEFAULT 0;',
  'ALTER TABLE "Achat" ADD COLUMN "statutPaiement" TEXT NOT NULL DEFAULT \'CREDIT\';',
  'ALTER TABLE "Achat" ADD COLUMN "modePaiement" TEXT NOT NULL DEFAULT \'ESPECES\';',
  'ALTER TABLE "Achat" ADD COLUMN "observation" TEXT;',
  'ALTER TABLE "Achat" ADD COLUMN "createdAt" DATETIME;',
  'ALTER TABLE "Achat" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Achat" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- AchatLigne ---
  'ALTER TABLE "AchatLigne" ADD COLUMN "coutUnitaire" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "AchatLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "AchatLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME;',
  'ALTER TABLE "AchatLigne" ADD COLUMN "updatedAt" DATETIME;',
  // --- Charge ---
  'ALTER TABLE "Charge" ADD COLUMN "statut" TEXT DEFAULT \'VALIDE\';',
  'ALTER TABLE "Charge" ADD COLUMN "beneficiaire" TEXT;',
  'ALTER TABLE "Charge" ADD COLUMN "modePaiement" TEXT NOT NULL DEFAULT \'ESPECES\';',
  'ALTER TABLE "Charge" ADD COLUMN "pieceJustificative" TEXT;',
  'ALTER TABLE "Charge" ADD COLUMN "banqueId" INTEGER;',
  'ALTER TABLE "Charge" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Charge" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Depense ---
  'ALTER TABLE "Depense" ADD COLUMN "banqueId" INTEGER;',
  'ALTER TABLE "Depense" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Depense" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Banque ---
  'ALTER TABLE "Banque" ADD COLUMN "compteId" INTEGER;',
  'ALTER TABLE "Banque" ADD COLUMN "actif" INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE "Banque" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Banque" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Caisse ---
  'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Caisse" ADD COLUMN "observation" TEXT;',
  'ALTER TABLE "Caisse" ADD COLUMN "sousType" TEXT NOT NULL DEFAULT \'MANUEL\';',
  'ALTER TABLE "Caisse" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "Caisse" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- Parametre ---
  'ALTER TABLE "Parametre" ADD COLUMN "slogan" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "email" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "siteWeb" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "numNCC" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "typeCommerce" TEXT NOT NULL DEFAULT \'GENERAL\';',
  'ALTER TABLE "Parametre" ADD COLUMN "piedDePage" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "smtpHost" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "smtpPort" INTEGER;',
  'ALTER TABLE "Parametre" ADD COLUMN "smtpUser" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "smtpPass" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "backupAuto" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Parametre" ADD COLUMN "backupFrequence" TEXT NOT NULL DEFAULT \'QUOTIDIEN\';',
  'ALTER TABLE "Parametre" ADD COLUMN "backupDestination" TEXT NOT NULL DEFAULT \'LOCAL\';',
  'ALTER TABLE "Parametre" ADD COLUMN "backupEmailDest" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "fideliteActive" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "Parametre" ADD COLUMN "fideliteSeuilPoints" INTEGER NOT NULL DEFAULT 100;',
  'ALTER TABLE "Parametre" ADD COLUMN "fideliteTauxRemise" REAL NOT NULL DEFAULT 5;',
  'ALTER TABLE "Parametre" ADD COLUMN "logoLocal" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "registreCommerce" TEXT;',
  'ALTER TABLE "Parametre" ADD COLUMN "mentionSpeciale" TEXT DEFAULT \'...\';',
  'ALTER TABLE "Parametre" ADD COLUMN "dateCloture" DATETIME;',
  'ALTER TABLE "Parametre" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- OperationBancaire ---
  'ALTER TABLE "OperationBancaire" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  'ALTER TABLE "OperationBancaire" ADD COLUMN "updatedAt" DATETIME;',
  // --- EcritureComptable ---
  'ALTER TABLE "EcritureComptable" ADD COLUMN "updatedAt" DATETIME;',
  'ALTER TABLE "EcritureComptable" ADD COLUMN "entiteId" INTEGER DEFAULT 1;',
  // --- PrintTemplate ---
  'ALTER TABLE "PrintTemplate" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // --- ReglementVente ---
  'ALTER TABLE "ReglementVente" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementVente" ADD COLUMN "banqueId" INTEGER;',
  // --- ReglementAchat ---
  'ALTER TABLE "ReglementAchat" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "banqueId" INTEGER;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "updatedAt" DATETIME;',
  // --- New tables ---
  'CREATE TABLE IF NOT EXISTS "PrintTemplate" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "type" TEXT NOT NULL, "nom" TEXT NOT NULL, "logo" TEXT, "enTete" TEXT, "piedDePage" TEXT, "variables" TEXT, "actif" INTEGER NOT NULL DEFAULT 1, "entiteId" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);',
  'CREATE TABLE IF NOT EXISTS "ReglementVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT \'VALIDE\', "rapproche" INTEGER NOT NULL DEFAULT 0, "banqueId" INTEGER, "venteId" INTEGER, "clientId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "entiteId" INTEGER DEFAULT 1);',
  'CREATE TABLE IF NOT EXISTS "ReglementVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "venteId" INTEGER NOT NULL, "montant" REAL NOT NULL);',
  'CREATE TABLE IF NOT EXISTS "ReglementAchat" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT \'VALIDE\', "rapproche" INTEGER NOT NULL DEFAULT 0, "achatId" INTEGER, "fournisseurId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME, "entiteId" INTEGER DEFAULT 1);',
  'CREATE TABLE IF NOT EXISTS "ReglementAchatLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "achatId" INTEGER NOT NULL, "montant" REAL NOT NULL);',
  'CREATE TABLE IF NOT EXISTS "ArchiveVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numeroFactureOrigine" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montantTotal" REAL NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  'CREATE TABLE IF NOT EXISTS "ArchiveVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "venteId" INTEGER NOT NULL, "produitId" INTEGER, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "montant" REAL NOT NULL);',
  'CREATE TABLE IF NOT EXISTS "ArchiveSoldeClient" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montant" REAL NOT NULL, "dateArchive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  'CREATE TABLE IF NOT EXISTS "CommandeFournisseur" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numero" TEXT NOT NULL UNIQUE, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "fournisseurId" INTEGER, "fournisseurLibre" TEXT, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "montantTotal" REAL NOT NULL DEFAULT 0, "fraisApproche" REAL NOT NULL DEFAULT 0, "observation" TEXT, "statut" TEXT NOT NULL DEFAULT \'BROUILLON\', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);',
  'CREATE TABLE IF NOT EXISTS "CommandeFournisseurLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "commandeId" INTEGER NOT NULL, "produitId" INTEGER NOT NULL, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "tva" REAL NOT NULL DEFAULT 0, "remise" REAL NOT NULL DEFAULT 0, "montant" REAL NOT NULL);',
  'CREATE TABLE IF NOT EXISTS "SystemAlerte" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "type" TEXT NOT NULL DEFAULT \'INFO\', "categorie" TEXT NOT NULL DEFAULT \'AUTRE\', "message" TEXT NOT NULL, "referenceId" INTEGER, "lu" INTEGER NOT NULL DEFAULT 0, "entiteId" INTEGER DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);',
  'CREATE TABLE IF NOT EXISTS "Licence" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "cle" TEXT NOT NULL, "clientNom" TEXT, "debutValidite" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finValidite" DATETIME, "statut" TEXT NOT NULL DEFAULT \'ACTIVE\', "features" TEXT NOT NULL DEFAULT \'[]\', "typeEssai" INTEGER NOT NULL DEFAULT 0, "debutEssai" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);',
];

const fixEntiteId = '(SELECT id FROM "Entite" ORDER BY id ASC LIMIT 1)';

// ═══════════════════════════════════════════════════════════════════
//  SÉCURITÉ : les corrections ci-dessous ne corrigent que les
//  valeurs NULL ou 0. Elles ne modifient JAMAIS les entiteId
//  existants et valides (≠ 0), pour ne pas écraser les données
//  réelles du client (multi-entités).
// ═══════════════════════════════════════════════════════════════════
const fixNullStmts = [
  'UPDATE "Vente" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL;',
  'UPDATE "Vente" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;',
  'UPDATE "VenteLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;',
  'UPDATE "AchatLigne" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;',
  'UPDATE "Achat" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL;',
  'UPDATE "Achat" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;',
  'UPDATE "Caisse" SET "dateOperation" = "date" WHERE "dateOperation" IS NULL;',
  'UPDATE "Caisse" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "Charge" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "ReglementAchat" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "Achat" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "AchatLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "Depense" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "EcritureComptable" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "Mouvement" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "PrintTemplate" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "Vente" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  'UPDATE "VenteLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
  `UPDATE "Produit" SET "actif" = 1 WHERE "actif" IS NULL;`,
  // entiteId: seulement NULL ou 0 → jamais d'écrasement des valeurs existantes
  `UPDATE "Produit" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Client" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Fournisseur" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Stock" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Utilisateur" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Magasin" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Caisse" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Vente" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Achat" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Mouvement" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Banque" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Charge" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Depense" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "OperationBancaire" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "EcritureComptable" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
];

const flagPath = path.join(projectRoot, '.migrated');
const isFirstLaunch = !fs.existsSync(flagPath);

// Étape 1: ALTER TABLE sécurisé (ne touche qu'aux colonnes, jamais aux données)
// S'exécute à chaque démarrage pour rattraper les colonnes manquantes.
l('Ajout des colonnes et tables manquantes...');
const batchSql = addStmts.join('\n');
let batchOk = false;
try {
  fs.writeFileSync(tmpFile, batchSql, 'utf-8');
  execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
    cwd: projectRoot, stdio: 'pipe', timeout: 60000,
  });
  l('  Batch SQL exécuté avec succès');
  batchOk = true;
} catch {
  l('  Batch SQL échoué — exécution individuelle...');
}

if (!batchOk) {
  let added = 0, exists = 0, failed = 0;
  for (const stmt of addStmts) {
    const r = execOne(stmt);
    if (r === true) added++;
    else if (r === 'exists') exists++;
    else failed++;
  }
  l(`  ALTER: ${added} ajoutés, ${exists} déjà présents, ${failed} échecs`);
}

// Étape 3: TOUJOURS corriger les données (actif, entiteId, updatedAt)
l('Correction des données...');
let fixed = 0;
for (const stmt of fixNullStmts) {
  if (execOne(stmt)) fixed++;
}
l(`  ${fixed} corrections appliquées`);

// Marquer la migration comme terminée
if (isFirstLaunch) {
  try { fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8'); l('Migration initiale marquée comme terminée'); } catch {}
}

// Cleanup temp file
try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

l('Fork de server.js...');

const outStream = fs.createWriteStream(logFile, { flags: 'a' });
const errStream = fs.createWriteStream(errFile, { flags: 'a' });

const nextServer = fork(serverPath, [], {
  env: process.env,
  cwd: projectRoot,
  silent: true,
});
nextServer.stdout.pipe(outStream);
nextServer.stderr.pipe(errStream);

nextServer.on('error', (er) => e(`Erreur fork: ${er.message}`));
nextServer.on('exit', (code, signal) => {
  l(`Serveur arrêté (code: ${code}, signal: ${signal})`);
  process.exit(code || 0);
});

l(`Fork réussi, PID: ${nextServer.pid}`);

l('Le VBS launcher surveille le serveur et ouvrira le navigateur.');
