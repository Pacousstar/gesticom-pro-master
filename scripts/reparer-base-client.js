const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const dbPath = 'C:/gesticom/gesticom.db';
const prismaCli = path.join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const logFile = path.join(projectRoot, 'GestiComService.out');

function l(msg) {
  try { fs.appendFileSync(logFile, new Date().toISOString() + ' [reparateur] ' + msg + '\n'); } catch {}
  console.log(msg);
}

const tmpFile = path.join(projectRoot, '_reparer.sql');

function run(sql) {
  try {
    fs.writeFileSync(tmpFile, sql.trim(), 'utf-8');
    execSync(`node "${prismaCli}" db execute --url="file:${dbPath}" --file="${tmpFile}"`, {
      cwd: projectRoot, stdio: 'pipe', timeout: 15000,
    });
    return true;
  } catch { return false; }
}

const stmts = [
  "ALTER TABLE Utilisateur ADD COLUMN rolesSupplementaires TEXT;",
  "ALTER TABLE Utilisateur ADD COLUMN tokenVersion INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Utilisateur ADD COLUMN lastLoginAt DATETIME;",
  "ALTER TABLE Utilisateur ADD COLUMN loginCount INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Utilisateur ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Magasin ADD COLUMN estDepotPrincipal INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Magasin ADD COLUMN soldeCaisse REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Produit ADD COLUMN codeBarres TEXT;",
  "ALTER TABLE Produit ADD COLUMN unite TEXT NOT NULL DEFAULT 'unite';",
  "ALTER TABLE Produit ADD COLUMN pamp REAL DEFAULT 0;",
  "ALTER TABLE Produit ADD COLUMN fournisseurId INTEGER;",
  "ALTER TABLE Produit ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Produit ADD COLUMN prixMinimum REAL DEFAULT 0;",
  "ALTER TABLE Produit ADD COLUMN actif INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Stock ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Mouvement ADD COLUMN dateOperation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Mouvement ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Client ADD COLUMN code TEXT;",
  "ALTER TABLE Client ADD COLUMN email TEXT;",
  "ALTER TABLE Client ADD COLUMN adresse TEXT;",
  "ALTER TABLE Client ADD COLUMN localisation TEXT;",
  "ALTER TABLE Client ADD COLUMN soldeInitial REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Client ADD COLUMN avoirInitial REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Client ADD COLUMN pointsFidelite INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Client ADD COLUMN type TEXT NOT NULL DEFAULT 'CASH';",
  "ALTER TABLE Client ADD COLUMN plafondCredit REAL;",
  "ALTER TABLE Client ADD COLUMN ncc TEXT;",
  "ALTER TABLE Client ADD COLUMN actif INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Client ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Fournisseur ADD COLUMN code TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN adresse TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN localisation TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN soldeInitial REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Fournisseur ADD COLUMN avoirInitial REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Fournisseur ADD COLUMN numeroCamion TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN email TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN ncc TEXT;",
  "ALTER TABLE Fournisseur ADD COLUMN actif INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Fournisseur ADD COLUMN entiteId INTEGER DEFAULT 1;",
  "ALTER TABLE Vente ADD COLUMN fraisApproche REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN remiseGlobale REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN pointsGagnes INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN estVenteRapide INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN numeroBon TEXT;",
  "ALTER TABLE Vente ADD COLUMN dateOperation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Vente ADD COLUMN estHistorique INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN statut TEXT NOT NULL DEFAULT 'VALIDEE';",
  "ALTER TABLE Vente ADD COLUMN montantPaye REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Vente ADD COLUMN statutPaiement TEXT NOT NULL DEFAULT 'CREDIT';",
  "ALTER TABLE Vente ADD COLUMN modePaiement TEXT NOT NULL DEFAULT 'ESPECES';",
  "ALTER TABLE Vente ADD COLUMN observation TEXT;",
  "ALTER TABLE Vente ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Vente ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE VenteLigne ADD COLUMN coutUnitaire REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE VenteLigne ADD COLUMN tva REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE VenteLigne ADD COLUMN remise REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE VenteLigne ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE VenteLigne ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Achat ADD COLUMN fraisApproche REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE Achat ADD COLUMN statut TEXT NOT NULL DEFAULT 'VALIDEE';",
  "ALTER TABLE Achat ADD COLUMN numeroCamion TEXT;",
  "ALTER TABLE Achat ADD COLUMN dateOperation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Achat ADD COLUMN montantPaye REAL DEFAULT 0;",
  "ALTER TABLE Achat ADD COLUMN statutPaiement TEXT NOT NULL DEFAULT 'CREDIT';",
  "ALTER TABLE Achat ADD COLUMN modePaiement TEXT NOT NULL DEFAULT 'ESPECES';",
  "ALTER TABLE Achat ADD COLUMN observation TEXT;",
  "ALTER TABLE Achat ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Achat ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE AchatLigne ADD COLUMN coutUnitaire REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE AchatLigne ADD COLUMN tva REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE AchatLigne ADD COLUMN remise REAL NOT NULL DEFAULT 0;",
  "ALTER TABLE AchatLigne ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE AchatLigne ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Charge ADD COLUMN statut TEXT DEFAULT 'VALIDE';",
  "ALTER TABLE Charge ADD COLUMN beneficiaire TEXT;",
  "ALTER TABLE Charge ADD COLUMN modePaiement TEXT NOT NULL DEFAULT 'ESPECES';",
  "ALTER TABLE Charge ADD COLUMN pieceJustificative TEXT;",
  "ALTER TABLE Charge ADD COLUMN banqueId INTEGER;",
  "ALTER TABLE Charge ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Depense ADD COLUMN banqueId INTEGER;",
  "ALTER TABLE Depense ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Banque ADD COLUMN compteId INTEGER;",
  "ALTER TABLE Banque ADD COLUMN actif INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Banque ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Caisse ADD COLUMN dateOperation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;",
  "ALTER TABLE Caisse ADD COLUMN observation TEXT;",
  "ALTER TABLE Caisse ADD COLUMN sousType TEXT NOT NULL DEFAULT 'MANUEL';",
  "ALTER TABLE Caisse ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE Caisse ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE Parametre ADD COLUMN slogan TEXT;",
  "ALTER TABLE Parametre ADD COLUMN email TEXT;",
  "ALTER TABLE Parametre ADD COLUMN siteWeb TEXT;",
  "ALTER TABLE Parametre ADD COLUMN numNCC TEXT;",
  "ALTER TABLE Parametre ADD COLUMN typeCommerce TEXT NOT NULL DEFAULT 'GENERAL';",
  "ALTER TABLE Parametre ADD COLUMN piedDePage TEXT;",
  "ALTER TABLE Parametre ADD COLUMN smtpHost TEXT;",
  "ALTER TABLE Parametre ADD COLUMN smtpPort INTEGER;",
  "ALTER TABLE Parametre ADD COLUMN smtpUser TEXT;",
  "ALTER TABLE Parametre ADD COLUMN smtpPass TEXT;",
  "ALTER TABLE Parametre ADD COLUMN backupAuto INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Parametre ADD COLUMN backupFrequence TEXT NOT NULL DEFAULT 'QUOTIDIEN';",
  "ALTER TABLE Parametre ADD COLUMN backupDestination TEXT NOT NULL DEFAULT 'LOCAL';",
  "ALTER TABLE Parametre ADD COLUMN backupEmailDest TEXT;",
  "ALTER TABLE Parametre ADD COLUMN fideliteActive INTEGER NOT NULL DEFAULT 0;",
  "ALTER TABLE Parametre ADD COLUMN fideliteSeuilPoints INTEGER NOT NULL DEFAULT 100;",
  "ALTER TABLE Parametre ADD COLUMN fideliteTauxRemise REAL NOT NULL DEFAULT 5;",
  "ALTER TABLE Parametre ADD COLUMN logoLocal TEXT;",
  "ALTER TABLE Parametre ADD COLUMN registreCommerce TEXT;",
  "ALTER TABLE Parametre ADD COLUMN mentionSpeciale TEXT DEFAULT '...';",
  "ALTER TABLE Parametre ADD COLUMN dateCloture DATETIME;",
  "ALTER TABLE OperationBancaire ADD COLUMN entiteId INTEGER NOT NULL DEFAULT 1;",
  "ALTER TABLE OperationBancaire ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE EcritureComptable ADD COLUMN updatedAt DATETIME;",
  "ALTER TABLE EcritureComptable ADD COLUMN entiteId INTEGER DEFAULT 1;",
  "CREATE TABLE IF NOT EXISTS PrintTemplate (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, nom TEXT NOT NULL, logo TEXT, enTete TEXT, piedDePage TEXT, variables TEXT, actif INTEGER NOT NULL DEFAULT 1, entiteId INTEGER NOT NULL DEFAULT 1, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME);",
  "CREATE TABLE IF NOT EXISTS ReglementVente (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, montant REAL NOT NULL, modePaiement TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'VALIDE', rapproche INTEGER NOT NULL DEFAULT 0, banqueId INTEGER, venteId INTEGER, clientId INTEGER, utilisateurId INTEGER NOT NULL, observation TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, entiteId INTEGER DEFAULT 1);",
  "CREATE TABLE IF NOT EXISTS ReglementVenteLigne (id INTEGER PRIMARY KEY AUTOINCREMENT, reglementId INTEGER NOT NULL, venteId INTEGER NOT NULL, montant REAL NOT NULL);",
  "CREATE TABLE IF NOT EXISTS ReglementAchat (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, montant REAL NOT NULL, modePaiement TEXT NOT NULL, statut TEXT NOT NULL DEFAULT 'VALIDE', rapproche INTEGER NOT NULL DEFAULT 0, achatId INTEGER, fournisseurId INTEGER, utilisateurId INTEGER NOT NULL, observation TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME, entiteId INTEGER DEFAULT 1);",
  "CREATE TABLE IF NOT EXISTS ReglementAchatLigne (id INTEGER PRIMARY KEY AUTOINCREMENT, reglementId INTEGER NOT NULL, achatId INTEGER NOT NULL, montant REAL NOT NULL);",
  "CREATE TABLE IF NOT EXISTS ArchiveVente (id INTEGER PRIMARY KEY AUTOINCREMENT, numeroFactureOrigine TEXT NOT NULL, date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, magasinId INTEGER NOT NULL, entiteId INTEGER NOT NULL, utilisateurId INTEGER NOT NULL, clientId INTEGER, clientLibre TEXT, montantTotal REAL NOT NULL, observation TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS ArchiveVenteLigne (id INTEGER PRIMARY KEY AUTOINCREMENT, venteId INTEGER NOT NULL, produitId INTEGER, designation TEXT NOT NULL, quantite REAL NOT NULL, prixUnitaire REAL NOT NULL, montant REAL NOT NULL);",
  "CREATE TABLE IF NOT EXISTS ArchiveSoldeClient (id INTEGER PRIMARY KEY AUTOINCREMENT, entiteId INTEGER NOT NULL, utilisateurId INTEGER NOT NULL, clientId INTEGER, clientLibre TEXT, montant REAL NOT NULL, dateArchive DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, observation TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS CommandeFournisseur (id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT NOT NULL UNIQUE, date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, fournisseurId INTEGER, fournisseurLibre TEXT, magasinId INTEGER NOT NULL, entiteId INTEGER NOT NULL, utilisateurId INTEGER NOT NULL, montantTotal REAL NOT NULL DEFAULT 0, fraisApproche REAL NOT NULL DEFAULT 0, observation TEXT, statut TEXT NOT NULL DEFAULT 'BROUILLON', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME);",
  "CREATE TABLE IF NOT EXISTS CommandeFournisseurLigne (id INTEGER PRIMARY KEY AUTOINCREMENT, commandeId INTEGER NOT NULL, produitId INTEGER NOT NULL, designation TEXT NOT NULL, quantite REAL NOT NULL, prixUnitaire REAL NOT NULL, tva REAL NOT NULL DEFAULT 0, remise REAL NOT NULL DEFAULT 0, montant REAL NOT NULL);",
  "CREATE TABLE IF NOT EXISTS SystemAlerte (id INTEGER PRIMARY KEY AUTOINCREMENT, date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, type TEXT NOT NULL DEFAULT 'INFO', categorie TEXT NOT NULL DEFAULT 'AUTRE', message TEXT NOT NULL, referenceId INTEGER, lu INTEGER NOT NULL DEFAULT 0, entiteId INTEGER DEFAULT 1, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE IF NOT EXISTS Licence (id INTEGER PRIMARY KEY AUTOINCREMENT, cle TEXT NOT NULL, clientNom TEXT, debutValidite DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finValidite DATETIME, statut TEXT NOT NULL DEFAULT 'ACTIVE', features TEXT NOT NULL DEFAULT '[]', typeEssai INTEGER NOT NULL DEFAULT 0, debutEssai DATETIME, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME);",
  "UPDATE Achat SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE AchatLigne SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE Depense SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE EcritureComptable SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE Mouvement SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE PrintTemplate SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE Vente SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE VenteLigne SET updatedAt = CURRENT_TIMESTAMP WHERE updatedAt IS NULL;",
  "UPDATE Utilisateur SET entiteId = 1 WHERE entiteId IS NULL OR entiteId = 0;",
  "UPDATE Produit SET actif = 1 WHERE actif IS NULL;",
  "UPDATE Produit SET entiteId = 1 WHERE entiteId IS NULL;",
];

let ok = 0, ko = 0;
for (const stmt of stmts) {
  const label = stmt.replace(/\s+/g, ' ').substring(0, 60);
  if (run(stmt)) {
    console.log('  OK  ' + label);
    ok++;
  } else {
    console.log('  --  ' + label + ' (déjà fait)');
    ko++;
  }
}

try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}

console.log(`\nTerminé: ${ok} OK, ${ko} ignorés`);
console.log('Lance maintenant prisma db push...');
try {
  execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: projectRoot, env: process.env, stdio: 'pipe', timeout: 120000,
  });
  console.log('prisma db push: OK');
} catch (err) {
  console.log('prisma db push: ' + err.message.split('\n')[0]);
}
