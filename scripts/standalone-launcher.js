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

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}
function e(msg) {
  try { fs.appendFileSync(errFile, new Date().toISOString() + ' [launcher] ' + msg + '\n'); } catch {}
}

l('Démarrage...');
l(`PORT=${PORT}, root=${projectRoot}`);

process.env.DATABASE_URL = 'file:C:/gesticom/gesticom.db';
process.env.NODE_ENV = 'production';
process.env.PORT = String(PORT);

let serverPath = path.join(projectRoot, 'server.js');
if (!fs.existsSync(serverPath)) {
  serverPath = path.join(projectRoot, '.next', 'standalone', 'server.js');
}
if (!fs.existsSync(serverPath)) {
  e(`server.js introuvable dans ${projectRoot} ni .next/standalone/`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════
//  0. SAUVEGARDE SYSTÉMATIQUE avant toute opération sur la base
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
//  Fonctions utilitaires d'exécution SQL via Prisma
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
//  1. PRÉPARATION : ajout des colonnes manquantes AVANT le sync schéma
//     SQLite ne permet pas d'ajouter une colonne NOT NULL sans défaut,
//     donc on ajoute avec DEFAULT pour que db push puisse recréer
//     les tables sans perdre les données.
// ═══════════════════════════════════════════════════════════════════════

l('Ajout des colonnes manquantes (préparation)...');

const addColumnStmts = [
  // updatedAt - ajouté avec DEFAULT pour éviter les NOT NULL sans valeur
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
  // entiteId
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
  // dateOperation
  'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME;',
  'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME;',
  // coutUnitaire
  'ALTER TABLE "AchatLigne" ADD COLUMN "coutUnitaire" REAL;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "coutUnitaire" REAL;',
  // numeroCamion, fraisApproche, pamp
  'ALTER TABLE "Achat" ADD COLUMN "numeroCamion" TEXT;',
  'ALTER TABLE "Achat" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Achat" ADD COLUMN "pamp" REAL NOT NULL DEFAULT 0;',
  // motDePasse nullable
  'ALTER TABLE "Utilisateur" ADD COLUMN "motDePasse" TEXT;',
  // createdAt
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

// ═══════════════════════════════════════════════════════════════════════
//  2. FIX NULLS : mise à jour des valeurs NULL AVANT le sync schéma
//     pour garantir que tous les champs NOT NULL ont des valeurs,
//     évitant ainsi la perte de données lors du db push.
// ═══════════════════════════════════════════════════════════════════════

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
  `UPDATE "Produit" SET "actif" = 1 WHERE "actif" IS NULL;`,
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
  `UPDATE "VenteLigne" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "AchatLigne" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "ReglementVente" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "ReglementAchat" SET "entiteId" = ${fixEntiteId} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
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

// ═══════════════════════════════════════════════════════════════════════
//  3. SCHÉMA : synchro via db push uniquement
//     - migrate deploy est TROP risqué (P3005 si historique différent)
//     - db push avec --accept-data-loss est nécessaire pour SQLite
//     - La préparation ci-dessus garantit que les INSERT SELECT marchent
// ═══════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════
//  4. VÉRIFICATION D'INTÉGRITÉ : si le sync a échoué, on restaure
// ═══════════════════════════════════════════════════════════════════════

if (!schemaSyncOk) {
  l('  ÉCHEC de la synchro schéma → restauration du backup');
  if (restoreDb()) {
    l('  Base restaurée. Démarrage sur l\'ancienne version.');
  } else {
    e('  RESTAURATION IMPOSSIBLE. La base est peut-être corrompue.');
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  2. DÉPENDANCES : s'assurer que bcryptjs est disponible pour seed.js
//     avec NODE_PATH et npm install --omit=dev si nécessaire
// ═══════════════════════════════════════════════════════════════════════

const nodeModulesPath = path.join(projectRoot, 'node_modules');
const standaloneNodeModules = path.join(projectRoot, '.next', 'standalone', 'node_modules');
process.env.NODE_PATH = [
  nodeModulesPath,
  standaloneNodeModules,
  ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
].join(path.delimiter);
require('module').Module._initPaths();

// ═══════════════════════════════════════════════════════════════════════
//  3. SEED : crée Entite/Magasin/Admin UNIQUEMENT si base vierge
//     Exécuté AVANT les corrections pour garantir qu'Entite existe
// ═══════════════════════════════════════════════════════════════════════

l('Seed automatique...');
try {
  execSync(`node "${path.join(projectRoot, 'scripts', 'seed.js')}"`, {
    cwd: projectRoot, stdio: 'pipe', timeout: 30000, windowsHide: true,
  });
  l('  Seed terminé');
} catch (err) {
  e('  Seed échoué: ' + (err.stderr || err.message));
  l('  Repli: création manuelle des données minimales...');
  try {
    const prismaClientPath = path.join(nodeModulesPath, '@prisma', 'client');
    if (fs.existsSync(prismaClientPath)) {
      execSync(`node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        (async () => {
          const exists = await prisma.entite.findFirst();
          if (!exists) {
            const e = await prisma.entite.create({ data: { code: 'ENT001', nom: 'Entreprise Principale', type: 'PRINCIPALE', localisation: '-', active: true } });
            console.log('Entite créée (repli):', e.id);
            const m = await prisma.magasin.create({ data: { code: 'MAG01', nom: 'Magasin 01', localisation: '-', entiteId: e.id, actif: true } });
            console.log('Magasin créé (repli):', m.id);
          }
          const users = await prisma.utilisateur.count();
          if (users === 0) {
            let hash;
            try {
              const bcrypt = require('bcryptjs');
              hash = await bcrypt.hash('Admin@123', 10);
            } catch (_) {
              hash = '\$2a\$10\$8K1p/a0dL1LXMIgoEDFrwOfMQkf9Rn6bm1FZwOJK3dN6nFP3sGjOS'; // bcrypt hash for 'Admin@123'
            }
            await prisma.utilisateur.create({ data: { login: 'admin', nom: 'Super Admin', email: 'admin@gesticom.local', motDePasse: hash, role: 'SUPER_ADMIN', entiteId: (await prisma.entite.findFirst()).id, actif: true } });
            console.log('Admin créé (repli)');
          }
          await prisma.\$disconnect();
        })();
      "`, { cwd: projectRoot, stdio: 'pipe', timeout: 30000, windowsHide: true });
      l('  Données minimales créées (repli)');
    } else {
      e('  @prisma/client introuvable, impossible de créer les données minimales');
    }
  } catch (err2) {
    e('  Repli seed échoué: ' + (err2.message || err2));
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  4. POST-FIX : corrections supplémentaires (si entité créée par seed)
// ═══════════════════════════════════════════════════════════════════════

const fixEntiteId2 = '(SELECT id FROM "Entite" ORDER BY id ASC LIMIT 1)';

const fixPostStmts = [
  `UPDATE "Produit" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Client" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Fournisseur" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Stock" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Utilisateur" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Magasin" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Vente" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
  `UPDATE "Mouvement" SET "entiteId" = ${fixEntiteId2} WHERE "entiteId" IS NULL OR "entiteId" = 0;`,
];

l('Corrections post-seed...');
execSql(fixPostStmts.join('\n'));

// Cleanup temp file
try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

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
if (!fs.existsSync(path.join(nodeModulesPath, 'bcryptjs'))) {
  if (fs.existsSync(path.join(standaloneNodeModules, 'bcryptjs'))) {
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
