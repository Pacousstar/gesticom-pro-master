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

const alters = [
  // updatedAt avec DEFAULT pour éviter NOT NULL sans valeur
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
  // soldeCaisse
  'ALTER TABLE "Magasin" ADD COLUMN "soldeCaisse" REAL NOT NULL DEFAULT 0;',
  // rolesSupplementaires
  'ALTER TABLE "Utilisateur" ADD COLUMN "rolesSupplementaires" TEXT;',
  // typeVente, dateLivraison, retraitDiffere
  'ALTER TABLE "Vente" ADD COLUMN "typeVente" TEXT NOT NULL DEFAULT \'LIVRAISON_IMMEDIATE\';',
  'ALTER TABLE "Vente" ADD COLUMN "dateLivraison" DATETIME;',
  'ALTER TABLE "Vente" ADD COLUMN "retraitDiffere" INTEGER NOT NULL DEFAULT 0;',
  // quantiteLivree, tva, remise (VenteLigne)
  'ALTER TABLE "VenteLigne" ADD COLUMN "quantiteLivree" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
  // estRembourse (Retour)
  'ALTER TABLE "Retour" ADD COLUMN "estRembourse" INTEGER NOT NULL DEFAULT 0;',
  // tva, remise (RetourLigne)
  'ALTER TABLE "RetourLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "RetourLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
  // tva, remise (AchatLigne)
  'ALTER TABLE "AchatLigne" ADD COLUMN "tva" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "AchatLigne" ADD COLUMN "remise" REAL NOT NULL DEFAULT 0;',
  // PrintTemplate
  'ALTER TABLE "PrintTemplate" ADD COLUMN "entiteId" INTEGER NOT NULL DEFAULT 1;',
  // ReglementVente
  'ALTER TABLE "ReglementVente" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementVente" ADD COLUMN "banqueId" INTEGER;',
  // ReglementAchat
  'ALTER TABLE "ReglementAchat" ADD COLUMN "rapproche" INTEGER NOT NULL DEFAULT 0;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "banqueId" INTEGER;',
  // VenteLigne createdAt
  'ALTER TABLE "VenteLigne" ADD COLUMN "createdAt" DATETIME;',
  // AchatLigne createdAt
  'ALTER TABLE "AchatLigne" ADD COLUMN "createdAt" DATETIME;',
  // Vente dateOperation
  'ALTER TABLE "Vente" ADD COLUMN "dateOperation" DATETIME;',
  // Achat dateOperation
  'ALTER TABLE "Achat" ADD COLUMN "dateOperation" DATETIME;',
  // Caisse dateOperation
  'ALTER TABLE "Caisse" ADD COLUMN "dateOperation" DATETIME;',
  // coutUnitaire
  'ALTER TABLE "AchatLigne" ADD COLUMN "coutUnitaire" REAL;',
  'ALTER TABLE "VenteLigne" ADD COLUMN "coutUnitaire" REAL;',
  // numeroCamion, fraisApproche, pamp
  'ALTER TABLE "Achat" ADD COLUMN "numeroCamion" TEXT;',
  'ALTER TABLE "Achat" ADD COLUMN "fraisApproche" REAL NOT NULL DEFAULT 0;',
  'ALTER TABLE "Achat" ADD COLUMN "pamp" REAL NOT NULL DEFAULT 0;',
  // createdAt
  'ALTER TABLE "ReglementVente" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
  'ALTER TABLE "ReglementAchat" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
];

let added = 0, exists = 0, failed = 0;
for (const sql of alters) {
  const r = execOne(sql);
  if (r === true) { added++; l('  + ' + sql.substring(0, 60).trim()); }
  else if (r === 'exists') exists++;
  else failed++;
}
l(`\nRésultat : ${added} ajoutées, ${exists} déjà présentes, ${failed} échecs\n`);

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
    ['ReglementVente', 'updatedAt', null],
    ['Vente', 'updatedAt', null],
    ['VenteLigne', 'updatedAt', null],
    ['Achat', 'updatedAt', null],
    ['AchatLigne', 'updatedAt', null],
    ['Depense', 'updatedAt', null],
    ['EcritureComptable', 'updatedAt', null],
    ['Mouvement', 'updatedAt', null],
    ['PrintTemplate', 'updatedAt', null],
    ['Fournisseur', 'updatedAt', null],
    ['Client', 'updatedAt', null],
    ['VenteLigne', 'coutUnitaire', null],
    ['AchatLigne', 'coutUnitaire', null],
  ];
  for (const [table, col, src] of upd) {
    try {
      const sql = src
        ? `UPDATE "${table}" SET "${col}" = "${src}" WHERE "${col}" IS NULL`
        : `UPDATE "${table}" SET "${col}" = CURRENT_TIMESTAMP WHERE "${col}" IS NULL`;
      const r = db.prepare(sql).run();
      if (r.changes > 0) { fixed += r.changes; l(`  ${table}.${col}: ${r.changes} corrigé(s)`); }
    } catch (e) { }
  }
  db.close();
} catch (e) {
  l('  better-sqlite3 non disponible, fallback prisma db execute...');
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
    'UPDATE "ReglementVente" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "Vente" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "VenteLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "Achat" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "AchatLigne" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;',
    'UPDATE "VenteLigne" SET "coutUnitaire" = 0 WHERE "coutUnitaire" IS NULL;',
    'UPDATE "AchatLigne" SET "coutUnitaire" = 0 WHERE "coutUnitaire" IS NULL;',
  ];
  for (const sql of fixes) { if (execOne(sql) === true) fixed++; }
}
l(`  ${fixed} lignes corrigées\n`);

l('Finalisation avec prisma db push...');
try {
  const out = execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: projectRoot, env: { ...process.env, DATABASE_URL: 'file:' + dbPath },
    stdio: 'pipe', timeout: 120000,
  });
  l('  prisma db push OK — base à jour');
} catch (err) {
  const stderr = (err.stderr || '').toString().trim();
  const stdout = (err.stdout || '').toString().trim();
  const msg = stderr || stdout || err.message || 'Erreur inconnue';
  l('  prisma db push a échoué');
  l('  ' + msg.split('\n').slice(0, 3).join(' | ').substring(0, 200));
  if (msg.includes('updatedAt') && msg.includes('NULL')) {
    l('  Tentative de correction des updatedAt NULL via better-sqlite3...');
    try {
      const s = require('better-sqlite3');
      const d = new s(dbPath);
      for (const t of ['Caisse', 'Charge', 'ReglementAchat', 'ReglementVente', 'Vente', 'VenteLigne', 'Achat', 'AchatLigne', 'Depense', 'EcritureComptable', 'Mouvement', 'PrintTemplate', 'Fournisseur', 'Client']) {
        const r = d.prepare(`UPDATE "${t}" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`).run();
        if (r.changes > 0) l(`    ${t}: ${r.changes} corrigé(s)`);
      }
      d.close();
      execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
        cwd: projectRoot, env: { ...process.env, DATABASE_URL: 'file:' + dbPath },
        stdio: 'pipe', timeout: 120000,
      });
      l('  prisma db push OK après correction');
    } catch (e2) {
      l('  Toujours en échec après correction');
    }
  }
}

try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

l('\n=== RÉPARATION TERMINÉE ===');
