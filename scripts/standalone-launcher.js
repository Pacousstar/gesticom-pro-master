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
//  Les modifications de schéma sont gérées par les Prisma Migrations
//  (ci-dessus). Ci-dessous : uniquement des corrections de données
//  (UPDATE), jamais d'ALTER TABLE.
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
