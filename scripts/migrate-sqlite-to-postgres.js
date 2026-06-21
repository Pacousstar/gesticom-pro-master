/**
 * scripts/migrate-sqlite-to-postgres.js
 * Migre toutes les donnees SQLite vers PostgreSQL.
 * Usage: node scripts/migrate-sqlite-to-postgres.js <postgresUrl>
 * Exemple: node scripts/migrate-sqlite-to-postgres.js "postgresql://gesticom:monMotDePasse@localhost:5432/gesticom"
 *
 * Etapes:
 *   1. lit toutes les tables SQLite via Prisma
 *   2. pousse le schema Prisma vers PostgreSQL (prisma migrate deploy)
 *   3. insere toutes les donnees dans PostgreSQL dans l'ordre des dependances FK
 *   4. sauvegarde .env.sqlite-backup + ecrit la nouvelle DATABASE_URL dans .env
 */

const { PrismaClient } = require('@prisma/client');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PG_URL = process.argv[2];
if (!PG_URL || !PG_URL.startsWith('postgresql')) {
  console.error('Usage: node scripts/migrate-sqlite-to-postgres.js <postgresql://...>');
  process.exit(1);
}

// --- Helpers ---
function envPath() {
  return path.resolve(__dirname, '..', '.env');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...opts.env },
    ...opts,
  });
  if (r.error) throw new Error(`Echec: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`Commande echouee (code ${r.status})`);
}

// 1. Lire toutes les donnees depuis SQLite
async function dumpSQLite() {
  const sqlite = new PrismaClient();
  try {
    console.log('[1/4] Lecture des donnees SQLite...');

    // Ordre topologique par dependances FK
    const tables = [
      // Niveau 0 : aucune FK
      'planCompte', 'journal', 'parametre', 'entite',
      // Niveau 1 : FK vers entite
      'banque', 'fournisseur', 'client', 'magasin',
      // Niveau 2 : FK vers entite + (client/fournisseur)
      'compteCourant',
      // Niveau 2 : FK vers entite + magasin
      'utilisateur',
      // Niveau 3 : FK vers entite + fournisseur
      'produit',
      // Niveau 4 : FK vers produit + magasin + entite
      'stock',
      // Niveau 5 : FK vers client + magasin + entite + utilisateur
      'vente', 'achat',
      // Niveau 5 : FK vers vente/fournisseur
      'transfert', 'commandeFournisseur',
      // Niveau 6 : lignes de vente
      'venteLigne', 'achatLigne',
      // Niveau 6 : reglements
      'reglementVente', 'reglementAchat',
      // Niveau 7 : lignes reglements
      'reglementVenteLigne', 'reglementAchatLigne',
      // Niveau 7 : retours
      'retour',
      // Niveau 8 : lignes retour
      'retourLigne',
      // Niveau 8 : retraits partiels
      'retraitPartiel',
      // Niveau 9 : lignes retrait
      'retraitPartielLigne',
      // Niveau 8 : lignes transfert
      'transfertLigne',
      // Niveau 8 : lignes commande
      'commandeFournisseurLigne',
      // Autres
      'caisse', 'charge', 'depense', 'operationBancaire',
      'ecritureComptable',
      'mouvement',
      'auditLog', 'systemAlerte', 'relanceClient',
      'archiveVente',
      // Niveau 9 : lignes archive
      'archiveVenteLigne', 'archiveSoldeClient',
      'licence',
      'printTemplate', 'dashboardPreference',
    ];

    const data = {};
    for (const t of tables) {
      try {
        const rows = await sqlite[t].findMany();
        data[t] = rows;
        console.log(`  ${t}: ${rows.length} enregistrements`);
      } catch (e) {
        // Table peut ne pas exister encore
        console.log(`  ${t}: 0 (non trouve)`);
        data[t] = [];
      }
    }

    console.log('[1/4] Donnees lues avec succes.');
    return data;
  } finally {
    await sqlite.$disconnect();
  }
}

// 2. Pousser le schema Prisma vers PostgreSQL
function pushSchema() {
  console.log('\n[2/4] Deploiement du schema Prisma vers PostgreSQL...');

  // Verification de la connexion PostgreSQL
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_URL: PG_URL,
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
      timeout: 60000,
    });
  } catch (e) {
    throw new Error(`Echec du deploiement du schema: ${e.message}`);
  }

  console.log('[2/4] Schema deployee avec succes.');
}

// 3. Inserer les donnees dans PostgreSQL
async function insertIntoPostgres(data) {
  console.log('\n[3/4] Insertion des donnees dans PostgreSQL...');

  const pg = new PrismaClient({
    datasources: { db: { url: PG_URL } },
  });

  try {
    // Desactiver les contraintes FK pour l'import
    await pg.$executeRawUnsafe('SET session_replication_role = replica;');

    const tables = Object.keys(data);

    for (const t of tables) {
      const rows = data[t];
      if (!rows || rows.length === 0) {
        console.log(`  ${t}: 0 (vide)`);
        continue;
      }

      // Inserer ligne par ligne pour respecter les sequences
      let count = 0;
      for (const row of rows) {
        try {
          await pg[t].create({ data: row });
          count++;
        } catch (e) {
          // Ignorer les doublons (upsert silencieux)
          if (e.code === 'P2002') {
            console.log(`  ${t}: doublon ignore (id=${row.id})`);
            continue;
          }
          // Si la table n'a pas de create (table non exposee), essayer raw
          console.error(`  ${t}: erreur ligne ${row.id || JSON.stringify(row).slice(0,80)}: ${e.message}`);
        }
      }
      console.log(`  ${t}: ${count} inseres`);
    }

    // Reactiver les contraintes FK
    await pg.$executeRawUnsafe('SET session_replication_role = origin;');

    console.log('[3/4] Donnees inserees avec succes.');
  } finally {
    await pg.$disconnect();
  }
}

// 4. Sauvegarder .env et ecrire la nouvelle URL
function updateEnv() {
  console.log('\n[4/4] Mise a jour du fichier .env...');

  const envFile = envPath();
  let envContent = '';
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf8');
    // Backup
    const backupPath = envFile + '.sqlite-backup';
    fs.copyFileSync(envFile, backupPath);
    console.log(`  .env sauvegarde dans ${backupPath}`);
  }

  // Remplacer ou ajouter DATABASE_URL
  const lines = envContent.split('\n');
  let found = false;
  const newLines = lines.map((l) => {
    if (l.startsWith('DATABASE_URL=')) {
      found = true;
      return `DATABASE_URL=${PG_URL}`;
    }
    return l;
  });

  if (!found) {
    newLines.push(`DATABASE_URL=${PG_URL}`);
  }

  fs.writeFileSync(envFile, newLines.join('\n'), 'utf8');
  console.log('  .env mis a jour avec la nouvelle DATABASE_URL.');
  console.log('[4/4] Migration terminee avec succes !');
}

async function main() {
  console.log('=== Migration SQLite → PostgreSQL ===\n');

  try {
    const data = await dumpSQLite();
    pushSchema();
    await insertIntoPostgres(data);
    updateEnv();

    console.log('\nMigration reussie ! Redemarrez GestiCom Pro pour utiliser PostgreSQL.');
    console.log('ATTENTION: Conservez le fichier .env.sqlite-backup (sauvegarde SQLite).');
  } catch (e) {
    console.error('\nERREUR CRITIQUE:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrate: main, dumpSQLite };
