// Script de réparation des entiteId pour GestiCom Pro
// À copier dans C:\GestiComPro et exécuter avec: node reparer-entite.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prismaCli = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js');
const dbPath = 'C:/gesticom/gesticom.db';
const tmpFile = path.join(__dirname, '_reparer_entite.sql');

let betterSqlite3;
try { betterSqlite3 = require('better-sqlite3'); } catch {}

function getEntiteId() {
  try {
    const eidScript = `const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('${dbPath}',{readOnly:true});const r=db.prepare('SELECT id FROM "Entite" ORDER BY id ASC LIMIT 1').get();db.close();console.log(r?id:1);`;
    const sf = path.join(__dirname, '_eid.js');
    fs.writeFileSync(sf, eidScript, 'utf-8');
    const nodeFlags = process.versions.node.startsWith('22') ? '--experimental-sqlite' : '';
    const out = execSync(`node ${nodeFlags} "${sf}"`, { timeout: 5000, stdio: 'pipe' });
    const id = parseInt(out.toString().trim(), 10);
    if (id > 0) return id;
  } catch {}
  return 1;
}

function execSQL(sql) {
  fs.writeFileSync(tmpFile, sql, 'utf-8');
  execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
    cwd: __dirname, stdio: 'pipe', timeout: 60000,
  });
}

try {
  const entiteId = getEntiteId();
  console.log(`Entité trouvée: id = ${entiteId}`);

  const tables = [
    'Utilisateur', 'Produit', 'Stock', 'Client', 'Fournisseur',
    'Caisse', 'Magasin', 'Vente', 'Achat', 'Mouvement',
    'Banque', 'Charge', 'Depense', 'Parametre',
    'OperationBancaire', 'EcritureComptable',
  ];

  const updates = tables.map(t =>
    `UPDATE "${t}" SET "entiteId" = ${entiteId} WHERE "entiteId" IS NULL OR "entiteId" <> ${entiteId};`
  );
  updates.push(
    'UPDATE "Produit" SET "actif" = 1 WHERE "actif" IS NULL;'
  );

  execSQL(updates.join('\n'));
  console.log('OK - Toutes les tables corrigées');
} catch (err) {
  console.error('ERREUR:', err.message);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpFile); } catch {}
}
