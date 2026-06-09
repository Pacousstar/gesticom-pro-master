const path = require('path');
const fs = require('fs');
const { fork, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const logFile = path.join(projectRoot, 'GestiComService.out');
const errFile = path.join(projectRoot, 'GestiComService.err');
const PORT = parseInt(process.env.PORT || '3001', 10);
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const dbPath = 'C:/gesticom/gesticom.db';

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
//  SÉCURITÉ : on utilise prisma migrate deploy (officiel, idempotent)
//  plutôt que des ALTER TABLE manuels, car les migrations sont
//  versionnées et testées. Les quelques ALTER TABLE ci-dessous ne
//  concernent que les corrections de données (pas de schéma).
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

// ═══════════════════════════════════════════════════════════════════
//  MIGRATION OFFICIELLE : prisma migrate deploy
//  Applique les migrations Prisma manquantes (versionnées).
//  Ne touche jamais les données existantes.
// ═══════════════════════════════════════════════════════════════════
l('Exécution de prisma migrate deploy...');
try {
  execSync(`node "${prismaCli}" migrate deploy --schema="${path.join(projectRoot, 'prisma', 'schema.prisma')}"`, {
    cwd: projectRoot, stdio: 'pipe', timeout: 60000,
  });
  l('  prisma migrate deploy réussi');
} catch (err) {
  e('  prisma migrate deploy échoué: ' + (err.stderr || err.message));
  // On continue — le launcher ne doit pas bloquer le démarrage
}

// ═══════════════════════════════════════════════════════════════════
//  Les migrations Prisma ne couvrent pas toutes les tables (certaines
//  ont été ajoutées directement dans schema.prisma sans migration).
//  On les crée ici avec CREATE TABLE IF NOT EXISTS (sûr, idempotent).
//  Toute nouvelle table DOIT être ajoutée ici ET dans schema.prisma.
// ═══════════════════════════════════════════════════════════════════

l('Création des tables manquantes...');
const createTableStmts = [
  // --- Retour ---
  `CREATE TABLE IF NOT EXISTS "Retour" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numero" TEXT NOT NULL UNIQUE, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "venteId" INTEGER NOT NULL, "clientId" INTEGER, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "montantTotal" REAL NOT NULL, "observation" TEXT, "estRembourse" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS "RetourLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "retourId" INTEGER NOT NULL, "produitId" INTEGER NOT NULL, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "tva" REAL NOT NULL DEFAULT 0, "remise" REAL NOT NULL DEFAULT 0, "montant" REAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  // --- Transfert ---
  `CREATE TABLE IF NOT EXISTS "Transfert" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numero" TEXT NOT NULL UNIQUE, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "magasinOrigineId" INTEGER NOT NULL, "magasinDestId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  `CREATE TABLE IF NOT EXISTS "TransfertLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "transfertId" INTEGER NOT NULL, "produitId" INTEGER NOT NULL, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  // --- ReglementVente ---
  `CREATE TABLE IF NOT EXISTS "ReglementVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT 'VALIDE', "rapproche" INTEGER NOT NULL DEFAULT 0, "banqueId" INTEGER, "venteId" INTEGER, "clientId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "entiteId" INTEGER DEFAULT 1);`,
  `CREATE TABLE IF NOT EXISTS "ReglementVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "venteId" INTEGER NOT NULL, "montant" REAL NOT NULL);`,
  // --- ReglementAchat ---
  `CREATE TABLE IF NOT EXISTS "ReglementAchat" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "montant" REAL NOT NULL, "modePaiement" TEXT NOT NULL, "statut" TEXT NOT NULL DEFAULT 'VALIDE', "rapproche" INTEGER NOT NULL DEFAULT 0, "achatId" INTEGER, "fournisseurId" INTEGER, "utilisateurId" INTEGER NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME, "entiteId" INTEGER DEFAULT 1);`,
  `CREATE TABLE IF NOT EXISTS "ReglementAchatLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "reglementId" INTEGER NOT NULL, "achatId" INTEGER NOT NULL, "montant" REAL NOT NULL);`,
  // --- ArchiveVente ---
  `CREATE TABLE IF NOT EXISTS "ArchiveVente" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numeroFactureOrigine" TEXT NOT NULL, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montantTotal" REAL NOT NULL, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  `CREATE TABLE IF NOT EXISTS "ArchiveVenteLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "venteId" INTEGER NOT NULL, "produitId" INTEGER, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "montant" REAL NOT NULL);`,
  `CREATE TABLE IF NOT EXISTS "ArchiveSoldeClient" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "clientId" INTEGER, "clientLibre" TEXT, "montant" REAL NOT NULL, "dateArchive" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "observation" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  // --- CommandeFournisseur ---
  `CREATE TABLE IF NOT EXISTS "CommandeFournisseur" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "numero" TEXT NOT NULL UNIQUE, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "fournisseurId" INTEGER, "fournisseurLibre" TEXT, "magasinId" INTEGER NOT NULL, "entiteId" INTEGER NOT NULL, "utilisateurId" INTEGER NOT NULL, "montantTotal" REAL NOT NULL DEFAULT 0, "fraisApproche" REAL NOT NULL DEFAULT 0, "observation" TEXT, "statut" TEXT NOT NULL DEFAULT 'BROUILLON', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);`,
  `CREATE TABLE IF NOT EXISTS "CommandeFournisseurLigne" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "commandeId" INTEGER NOT NULL, "produitId" INTEGER NOT NULL, "designation" TEXT NOT NULL, "quantite" REAL NOT NULL, "prixUnitaire" REAL NOT NULL, "tva" REAL NOT NULL DEFAULT 0, "remise" REAL NOT NULL DEFAULT 0, "montant" REAL NOT NULL);`,
  // --- SystemAlerte ---
  `CREATE TABLE IF NOT EXISTS "SystemAlerte" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "type" TEXT NOT NULL DEFAULT 'INFO', "categorie" TEXT NOT NULL DEFAULT 'AUTRE', "message" TEXT NOT NULL, "referenceId" INTEGER, "lu" INTEGER NOT NULL DEFAULT 0, "entiteId" INTEGER DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`,
  // --- Licence ---
  `CREATE TABLE IF NOT EXISTS "Licence" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "cle" TEXT NOT NULL, "clientNom" TEXT, "debutValidite" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finValidite" DATETIME, "statut" TEXT NOT NULL DEFAULT 'ACTIVE', "features" TEXT NOT NULL DEFAULT '[]', "typeEssai" INTEGER NOT NULL DEFAULT 0, "debutEssai" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME);`,
];
// Exécuter les CREATE TABLE IF NOT EXISTS (idempotent)
for (const stmt of createTableStmts) {
  execOne(stmt);
}
l(`  ${createTableStmts.length} tables vérifiées/créées`);

// ═══════════════════════════════════════════════════════════════════
//  Ci-dessous : uniquement des corrections de données (UPDATE),
//  jamais d'ALTER TABLE.
// ═══════════════════════════════════════════════════════════════════

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

// Étape 3: TOUJOURS corriger les données (actif, entiteId, updatedAt)
l('Correction des données...');
let fixed = 0;
for (const stmt of fixNullStmts) {
  if (execOne(stmt)) fixed++;
}
l(`  ${fixed} corrections appliquées`);

// Étape: Seed auto (crée admin/entité/magasin si base vierge, sans risque sur existant)
l('Seed automatique...');
try {
  execSync(`node "${path.join(projectRoot, 'scripts', 'seed.js')}"`, {
    cwd: projectRoot, stdio: 'pipe', timeout: 30000,
  });
  l('  Seed terminé');
} catch (err) {
  e('  Seed échoué: ' + (err.stderr || err.message));
}

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
