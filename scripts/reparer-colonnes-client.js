/**
 * Script de réparation pour colonnes manquantes sur installation client.
 * À exécuter dans C:\GestiComPro : node scripts\reparer-colonnes-client.js
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const logFile = path.join(projectRoot, 'GestiComService.out');
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const dbPath = 'C:/gesticom/gesticom.db';
const tmpFile = path.join(projectRoot, '_mig.sql');

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [repair] ' + msg + '\n'); } catch {}
  console.log(msg);
}

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
    l('  ERREUR: ' + msg.split('\n')[0].substring(0, 120));
    return false;
  }
}

l('=== RÉPARATION DES COLONNES MANQUANTES ===\n');
l('Base de données : ' + dbPath);

// 1. ALTER TABLE pour les colonnes manquantes
const alters = [
  // PrintTemplate
  'ALTER TABLE "PrintTemplate" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // ReglementVente
  'ALTER TABLE "ReglementVente" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementVente" ADD COLUMN "banqueId" INTEGER;',
  // ReglementAchat
  'ALTER TABLE "ReglementAchat" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "banqueId" INTEGER;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "updatedAt" DATETIME;',
  // VenteLigne
  'ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME;',
  // AchatLigne
  'ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME;',
  // Vente
  'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME;',
  // Achat
  'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME;',
  // Caisse
  'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME;',
];

let added = 0, exists = 0, failed = 0;
for (const sql of alters) {
  const r = execOne(sql);
  if (r === true) { added++; l('  + ' + sql.substring(0, 60).trim()); }
  else if (r === 'exists') exists++;
  else failed++;
}
l(`\nRésultat : ${added} ajoutées, ${exists} déjà présentes, ${failed} échecs\n`);

// 2. Correction des données NULL (via better-sqlite3 pour fiabilité)
l('Correction des données NULL...');
let fixed = 0;
try {
  const sqlite3 = require('better-sqlite3');
  const db = new sqlite3(dbPath);
  const upd = [
    ['Vente', 'dateOperation', 'date'],
    ['Vente', 'createdAt', null],
    ['VenteLigne', 'createdAt', null],
    ['AchatLigne', 'createdAt', null],
    ['Achat', 'dateOperation', 'date'],
    ['Achat', 'createdAt', null],
    ['Caisse', 'dateOperation', 'date'],
    ['Caisse', 'updatedAt', null],
    ['Charge', 'updatedAt', null],
    ['ReglementAchat', 'updatedAt', null],
  ];
  for (const [table, col, src] of upd) {
    try {
      const sql = src
        ? `UPDATE "${table}" SET "${col}" = "${src}" WHERE "${col}" IS NULL`
        : `UPDATE "${table}" SET "${col}" = CURRENT_TIMESTAMP WHERE "${col}" IS NULL`;
      const r = db.prepare(sql).run();
      if (r.changes > 0) { fixed += r.changes; l(`  ${table}.${col}: ${r.changes} corrigé(s)`); }
    } catch (e) { /* column likely doesn't exist, ignore */ }
  }
  db.close();
} catch (e) {
  l('  better-sqlite3 non disponible, fallback prisma db execute...');
  // Fallback
  const fixes = [
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
  ];
  for (const sql of fixes) { if (execOne(sql) === true) fixed++; }
}
l(`  ${fixed} lignes corrigées\n`);

// 3. Finaliser avec prisma db push
l('Finalisation avec prisma db push...');
try {
  const out = execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: projectRoot, env: { ...process.env, DATABASE_URL: 'file:' + dbPath },
    stdio: 'pipe', timeout: 120000,
  });
  l('✅ prisma db push OK — base à jour');
} catch (err) {
  const stderr = (err.stderr || '').toString().trim();
  const stdout = (err.stdout || '').toString().trim();
  const msg = stderr || stdout || err.message || 'Erreur inconnue';
  l('❌ prisma db push a échoué');
  l('   ' + msg.split('\n').slice(0, 3).join(' | ').substring(0, 200));
  // Si le problème est des updatedAt NULL, les corriger en force
  if (msg.includes('updatedAt') && msg.includes('NULL')) {
    l('   → Tentative de correction des updatedAt NULL via better-sqlite3...');
    try {
      const s = require('better-sqlite3');
      const d = new s(dbPath);
      for (const t of ['Caisse', 'Charge', 'ReglementAchat']) {
        const r = d.prepare(`UPDATE "${t}" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`).run();
        if (r.changes > 0) l(`     ${t}: ${r.changes} corrigé(s)`);
      }
      d.close();
      // Re-tenter
      execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
        cwd: projectRoot, env: { ...process.env, DATABASE_URL: 'file:' + dbPath },
        stdio: 'pipe', timeout: 120000,
      });
      l('✅ prisma db push OK après correction');
    } catch (e2) {
      l('❌ Toujours en échec après correction');
    }
  }
}

// Cleanup
try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

l('\n=== RÉPARATION TERMINÉE ===');
