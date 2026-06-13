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

let serverPath = path.join(projectRoot, 'server.js');
if (!fs.existsSync(serverPath)) {
  serverPath = path.join(projectRoot, '.next', 'standalone', 'server.js');
}
if (!fs.existsSync(serverPath)) {
  e(`server.js introuvable dans ${projectRoot} ni .next/standalone/`);
  process.exit(1);
}

l('Migration automatique de la base de donnees...');

// ═══════════════════════════════════════════════════════════════════════
//  1. SCHÉMA : détection auto du mode migration
//     - Si _prisma_migrations existe → prisma migrate deploy (versionné)
//     - Sinon → prisma db push (s'applique sur base existante non suivie)
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

if (hasMigrationTable()) {
  l('Base suivie par Prisma → prisma migrate deploy');
  try {
    execSync(`node "${prismaCli}" migrate deploy --schema="${schemaPath}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
    });
    l('  prisma migrate deploy réussi');
  } catch (err) {
    const msg = (err.stderr || err.message || '');
    e('  prisma migrate deploy échoué: ' + msg);
    // P3005: schema not empty / P3009: failed migrations
    // → supprimer _prisma_migrations pour repartir sur un db push sain
    if (msg.includes('P3005') || msg.includes('P3009')) {
      l('  Migrations corrompues → nettoyage de _prisma_migrations...');
      try {
        execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --stdin`, {
          input: 'DROP TABLE IF EXISTS "_prisma_migrations";',
          cwd: projectRoot, stdio: 'pipe', timeout: 15000, windowsHide: true,
        });
        l('  Table _prisma_migrations supprimée');
      } catch (dropErr) {
        e('  Échec suppression _prisma_migrations: ' + (dropErr.stderr || dropErr.message));
      }
    }
    l('  Repli: prisma db push...');
    try {
      execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
        cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
      });
      l('  prisma db push réussi (repli)');
    } catch (err2) {
      e('  prisma db push échoué: ' + (err2.stderr || err2.message));
    }
  }
} else {
  l('Base existante sans historique Prisma → prisma db push');
  try {
    execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss --schema="${schemaPath}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 60000, windowsHide: true,
    });
    l('  prisma db push réussi');
  } catch (err) {
    e('  prisma db push échoué: ' + (err.stderr || err.message));
    l('  La base existante est conservée telle quelle.');
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  2. DÉPENDANCES : s'assurer que bcryptjs est disponible pour seed.js
//     avec NODE_PATH et npm install --omit=dev si nécessaire
// ═══════════════════════════════════════════════════════════════════════

const nodeModulesPath = path.join(projectRoot, 'node_modules');
process.env.NODE_PATH = [
  nodeModulesPath,
  ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
].join(path.delimiter);
require('module').Module._initPaths();

if (!fs.existsSync(path.join(nodeModulesPath, 'bcryptjs'))) {
  l('bcryptjs manquant → installation des dépendances...');
  try {
    execSync('npm install --omit=dev --no-audit --no-fund', {
      cwd: projectRoot, stdio: 'pipe', timeout: 120000, windowsHide: true,
    });
    l('  Dépendances installées');
  } catch (err) {
    e('  npm install échoué: ' + (err.stderr || err.message));
  }
}

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
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash('Admin@123', 10);
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
//  4. CORRECTIONS : appliquées APRÈS le seed (garantit qu'Entite existe)
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
];

function execOne(sql) {
  try {
    fs.writeFileSync(tmpFile, sql.trim(), 'utf-8');
    execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 30000, windowsHide: true,
    });
    return true;
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString().toLowerCase();
    if (msg.includes('duplicate column') || msg.includes('already exists')) return 'exists';
    return false;
  }
}

l('Correction des données (batch)...');
try {
  fs.writeFileSync(tmpFile, fixNullStmts.join('\n'), 'utf-8');
  execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
    cwd: projectRoot, stdio: 'pipe', timeout: 30000, windowsHide: true,
  });
  l(`  ${fixNullStmts.length} corrections appliquées`);
} catch (err) {
  e('  Erreur batch corrections: ' + (err.stderr || err.message));
  l('  Repli exécution individuelle...');
  let fixed = 0;
  for (const stmt of fixNullStmts) { if (execOne(stmt)) fixed++; }
  l(`  ${fixed} corrections appliquées (repli)`);
}

// Marquer la migration comme terminée
const flagPath = path.join(projectRoot, '.migrated');
if (!fs.existsSync(flagPath)) {
  try { fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8'); l('Migration initiale marquée comme terminée'); } catch {}
}

// Cleanup temp file
try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

l('Fork de server.js...');

const outStream = fs.createWriteStream(logFile, { flags: 'a' });
const errStream = fs.createWriteStream(errFile, { flags: 'a' });

const nextServer = fork(serverPath, [], {
  env: process.env,
  cwd: path.dirname(serverPath),
  silent: true,
  windowsHide: true,
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
