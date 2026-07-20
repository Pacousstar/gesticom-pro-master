const path = require('path');
const fs = require('fs');
const { fork, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const logFile = path.join(projectRoot, 'GestiComService.out');
const errFile = path.join(projectRoot, 'GestiComService.err');
const PORT = parseInt(process.env.PORT || '3001', 10);
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
const dbPath = 'C:/gesticom/gesticom.db';
const backupPath = dbPath + '.backup';

const tmpFile = path.join(projectRoot, '_mig.sql');

// Charger .env manuellement (dotenv non disponible dans le standalone)
const envFilePath = path.join(projectRoot, '.env');
if (fs.existsSync(envFilePath)) {
  const envRaw = fs.readFileSync(envFilePath, 'utf-8');
  for (const line of envRaw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    let k = t.substring(0, eq).trim();
    let v = t.substring(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const isPostgres = () => (process.env.DATABASE_URL || '').startsWith('postgresql')
const isSQLite = () => !isPostgres()

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}

l('Démarrage...');
l(`PORT=${PORT}, root=${projectRoot}`);

// Ne pas écraser DATABASE_URL si déjà définie (PostgreSQL)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:C:/gesticom/gesticom.db';
}
process.env.NODE_ENV = 'production';
process.env.PORT = String(PORT);
if (process.env.HOST) {
  process.env.__NEXT_PRIVATE_HOST = process.env.HOST;
}

let serverPath = path.join(projectRoot, 'server.js');
if (!fs.existsSync(serverPath)) {
  serverPath = path.join(projectRoot, '.next', 'standalone', 'server.js');
}
if (!fs.existsSync(serverPath)) {
  e(`server.js introuvable dans ${projectRoot} ni .next/standalone/`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════
//  0. MIGRATION / SYNC SCHÉMA selon le provider
// ═══════════════════════════════════════════════════════════════════════

if (isPostgres()) {
  // ── PostgreSQL : prisma migrate deploy propre ──
  l('Provider: PostgreSQL → prisma migrate deploy');
  try {
    execSync(`node "${prismaCli}" migrate deploy --schema="${schemaPath}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
    });
    l('  prisma migrate deploy réussi');
  } catch (err) {
    const msg = (err.stderr || err.message || '');
    e('  prisma migrate deploy échoué: ' + msg);
    l('  Repli: prisma db push...');
    try {
      execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
      });
      l('  prisma db push réussi (repli PostgreSQL)');
    } catch (err2) {
      e('  prisma db push échoué: ' + (err2.stderr || err2.message));
    }
  }
} else {
  // ── SQLite : migration legacy avec backup + ALTER TABLE + db push ──
  l('Provider: SQLite → migration legacy');

  // 0. SUPPRESSION DE LA TABLE _prisma_migrations POUR ÉVITER P3005
  l('Nettoyage de la table _prisma_migrations...');
  try {
    fs.writeFileSync(tmpFile, 'DROP TABLE IF EXISTS "_prisma_migrations"', 'utf-8');
    execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 15000, windowsHide: true,
    });
    l('  _prisma_migrations supprimée');
  } catch (err) {
    l('  _prisma_migrations non présente ou déjà supprimée');
  }

  // 0. SAUVEGARDE SYSTÉMATIQUE
  function backupDb() {
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        l(`Base sauvegardée (${fs.statSync(dbPath).size} octets)`);
      }
    } catch (err) {
      e('  Échec sauvegarde: ' + err.message);
    }
  }
  function restoreDb() {
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        l('  Base restaurée depuis le backup');
        return true;
      }
      e('  Aucun backup trouvé');
      return false;
    } catch (err) {
      e('  Échec restauration: ' + err.message);
      return false;
    }
  }
  backupDb();

  function execOne(sql) {
    try {
      fs.writeFileSync(tmpFile, sql.trim(), 'utf-8');
      execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 30000, windowsHide: true,
      });
      return true;
    } catch (err) {
      return false;
    }
  }
  function execSql(sql) {
    try {
      fs.writeFileSync(tmpFile, sql, 'utf-8');
      execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  l('Migration automatique de la base de donnees...');

  // 1. PRÉPARATION : ajout des colonnes manquantes AVANT le sync schéma
  const addColumnStmts = [
    'ALTER TABLE "Achat" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Caisse" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Charge" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Client" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Depense" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "EcritureComptable" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Fournisseur" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Mouvement" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "PrintTemplate" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "ReglementAchat" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "ReglementVente" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Vente" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "Produit" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Client" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Fournisseur" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Stock" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Utilisateur" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Magasin" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Caisse" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Vente" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Achat" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Mouvement" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Banque" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Charge" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Depense" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "OperationBancaire" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "EcritureComptable" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "ReglementVente" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "ReglementAchat" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
    'ALTER TABLE "Magasin" ADD COLUMN "soldeCaisse" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "Utilisateur" ADD COLUMN "rolesSupplementaires" TEXT;',
    'ALTER TABLE "Vente" ADD COLUMN "typeVente" TEXT NOT NULL DEFAULT \'LIVRAISON_IMMEDIATE\';',
    'ALTER TABLE "Vente" ADD COLUMN "dateLivraison" DATETIME;',
    'ALTER TABLE "Vente" ADD COLUMN "retraitDiffere" INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "quantiteLivree" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "Retour" ADD COLUMN "estRembourse" INTEGER NOT NULL DEFAULT 0;',
    'ALTER TABLE "RetourLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "RetourLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME;',
    'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME;',
    'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "coutUnitaire" REAL;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "coutUnitaire" REAL;',
    'ALTER TABLE "Achat" ADD COLUMN "numeroCamion" TEXT;',
    'ALTER TABLE "Achat" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "Achat" ADD COLUMN "pamp" REAL NOT NULL DEFAULT 0;',
    'ALTER TABLE "Utilisateur" ADD COLUMN "motDePasse" TEXT;',
    'ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "ReglementVente" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
    'ALTER TABLE "ReglementAchat" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
  ];
  let addColOk = 0;
  for (const stmt of addColumnStmts) {
    try {
      fs.writeFileSync(tmpFile, stmt, 'utf-8');
      execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 15000, windowsHide: true,
      });
      addColOk++;
    } catch (err) {
      // "duplicate column" = déjà existant → normal
    }
  }
  l(`  ${addColOk} colonnes ajoutées sur ${addColumnStmts.length} tentatives`);

  // 2. FIX NULLS
  const fixEntiteId = '(SELECT id FROM "Entite" ORDER BY id ASC LIMIT 1)';
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
    'UPDATE "ReglementVente" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "Fournisseur" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "Client" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "VenteLigne" SET "coutUnitaire" = 0 WHERE "coutUnitaire" IS NULL;',
    'UPDATE "AchatLigne" SET "coutUnitaire" = 0 WHERE "coutUnitaire" IS NULL;',
    'UPDATE "Produit" SET "actif" = 1 WHERE "actif" IS NULL;',
    'UPDATE "Produit" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Client" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Fournisseur" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Stock" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Utilisateur" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Magasin" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Caisse" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Vente" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Achat" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Mouvement" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Banque" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Charge" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Depense" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "OperationBancaire" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "EcritureComptable" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "VenteLigne" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "AchatLigne" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "ReglementVente" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "ReglementAchat" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
  ];
  l('Correction des valeurs NULL (pré-sync)...');
  if (!execSql(fixNullStmts.join('\n'))) {
    e('  Erreur batch pré-sync, tentative individuelle...');
    let fixed = 0;
    for (const stmt of fixNullStmts) { if (execOne(stmt)) fixed++; }
    l(`  ${fixed} corrections appliquées`);
  } else {
    l(`  ${fixNullStmts.length} corrections appliquées`);
  }

  // 3. SCHÉMA : synchro via db push
  function hasMigrationTable() {
    try {
      const out = execSync(
        `node "${prismaCli}" db execute --url="file:${dbPath}" --stdin`,
        {
          input: "SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'",
          cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, windowsHide: true,
        }
      );
      return out.toString().trim().length > 0;
    } catch {
      return false;
    }
  }
  let schemaSyncOk = false;
  if (hasMigrationTable()) {
    l('Base suivie par Prisma → prisma migrate deploy');
    try {
      execSync(`node "${prismaCli}" migrate deploy --schema="${schemaPath}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
      });
      l('  prisma migrate deploy réussi');
      schemaSyncOk = true;
    } catch (err) {
      const msg = (err.stderr || err.message || '');
      e('  prisma migrate deploy échoué: ' + msg);
      l('  Repli: prisma db push...');
      try {
        execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
          cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
        });
        l('  prisma db push réussi (repli)');
        schemaSyncOk = true;
      } catch (err2) {
        e('  prisma db push échoué: ' + (err2.stderr || err2.message));
      }
    }
  } else {
    l('Base sans historique Prisma → prisma db push');
    try {
      execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
      });
      l('  prisma db push réussi');
      schemaSyncOk = true;
    } catch (err) {
      e('  prisma db push échoué: ' + (err.stderr || err.message));
    }
  }
  if (!schemaSyncOk) {
    l('ÉCHEC de la synchro schéma → restauration du backup');
    if (restoreDb()) {
      l('Base restaurée. Démarrage sur l\'ancienne version.');
    } else {
      e('RESTAURATION IMPOSSIBLE. La base est peut-être corrompue.');
    }
  }

  // POST-FIX sqlite
  const fixPostStmts = [
    'UPDATE "Produit" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Client" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Fournisseur" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Stock" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Utilisateur" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Magasin" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Vente" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
    'UPDATE "Mouvement" SET "entiteId" = ' + fixEntiteId + ' WHERE "entiteId" IS NULL OR "entiteId" = 0;',
  ];
  l('Corrections post-seed...');
  execSql(fixPostStmts.join('\n'));

  // Cleanup temp file
  try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
}

// 6. CORRECTION RÉTROACTIVE DES ANNULATIONS (bug quantiteLivree)
try {
  const correctionScript = path.join(__dirname, 'corriger-annulations-auto.mjs');
  if (fs.existsSync(correctionScript)) {
    execSync(`node "${correctionScript}"`, { cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true });
    l('Correction annulations stock exécutée');
  }
} catch (err) {
  l('Correction annulations non applicable: ' + (err.message || ''));
}

// 7. VÉRIFICATION DES FICHIERS CSS (évite page sans style)
(function checkCss() {
  const cssPaths = [
    path.join(projectRoot, '.next', 'static', 'css'),
    path.join(path.dirname(serverPath), '.next', 'static', 'css'),
  ];
  let found = false;
  for (const p of cssPaths) {
    if (fs.existsSync(p) && fs.readdirSync(p).some(f => f.endsWith('.css'))) { found = true; break; }
  }
  if (!found) {
    e('Aucun fichier CSS trouvé dans .next/static/css/ — la page sera affichée sans style');
    e('Chemins vérifiés: ' + cssPaths.join(', '));
  } else {
    l('Fichiers CSS présents');
  }
})();

// 8. PLANIFICATEUR DE SAUVEGARDE (tâche de fond)
let backupScheduler = null;
try {
  const scheduler = require('./scheduled-backup');
  if (typeof scheduler.startScheduler === 'function') {
    scheduler.startScheduler();
    l('Planificateur de sauvegarde demarré');
  }
} catch (err) {
  l('Planificateur non disponible: ' + (err.message || ''));
}

l('Fork de server.js...');

const outStream = fs.createWriteStream(logFile, { flags: 'a' });
const errStream = fs.createWriteStream(errFile, { flags: 'a' });

const http = require('http');

function waitForServer(callback, attempt) {
  attempt = attempt || 1;
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    if (res.statusCode === 200) {
      l(`Serveur prêt (tentative ${attempt})`);
      callback(true);
    } else {
      retry(callback, attempt);
    }
  });
  req.on('error', () => retry(callback, attempt));
  req.setTimeout(3000, () => { req.destroy(); retry(callback, attempt); });
}

function retry(callback, attempt) {
  if (attempt >= 60) {
    e(`Serveur non joignable après ${attempt} tentatives`);
    callback(false);
    return;
  }
  setTimeout(() => waitForServer(callback, attempt + 1), 1000);
}

const nextServer = fork(serverPath, [], {
  env: process.env,
  cwd: path.dirname(serverPath),
  silent: true,
  windowsHide: true,
});
nextServer.stdout.pipe(outStream);
nextServer.stderr.pipe(errStream);

nextServer.on('error', (er) => e(`Erreur fork: ${er.message}`));

l(`Fork réussi, PID: ${nextServer.pid}`);

// 5. VÉRIFICATION bcryptjs : non-bloquante, le serveur est déjà lancé
const nmPath = path.join(projectRoot, 'node_modules');
const standaloneNm = path.join(projectRoot, '.next', 'standalone', 'node_modules');
if (!fs.existsSync(path.join(nmPath, 'bcryptjs'))) {
  if (fs.existsSync(path.join(standaloneNm, 'bcryptjs'))) {
    l('bcryptjs trouvé dans standalone/node_modules');
  } else {
    l('bcryptjs manquant (le serveur tourne déjà, fallback hash OK)');
  }
}

// Attendre que le serveur écoute vraiment, puis marquer .migrated
waitForServer((ok) => {
  if (ok) {
    const flagPath = path.join(projectRoot, '.migrated');
    if (!fs.existsSync(flagPath)) {
      try { fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8'); l('Migration initiale marquée comme terminée'); } catch {}
    }
    l('Serveur prêt, le VBS peut ouvrir le navigateur.');
  } else {
    e('Le serveur n\'a pas démarré correctement');
  }
});

nextServer.on('exit', (code, signal) => {
  l(`Serveur arrêté (code: ${code}, signal: ${signal})`);
  process.exit(code || 0);
});
