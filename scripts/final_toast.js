const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

// 1. Dossiers lourds a supprimer APRES le build
const foldersToDelete = [
  path.join(rootDir, '.next', 'cache'), // Cache de build (tres lourd)
  path.join(rootDir, 'app'),           // Sources (inutiles si on utilise standalone, mais on les garde si Inno setup pointe dessus. Ici on nettoie juste les residus)
  path.join(rootDir, 'tmp'),
];

// 2. Fichiers de logs et temporaires
const filesToDelete = [
  path.join(rootDir, 'gesticom-error.log'),
  path.join(rootDir, 'npm-debug.log'),
  path.join(rootDir, 'test_credit_sync.js'),
  path.join(rootDir, 'scripts', 'final_audit_shield.js'), // Residue
];

// 3. On ne garde que les scripts vitaux dans /scripts
const scriptsToKeep = [
  'purge_prod.ts',
  'migration-master.ts',
  'audit_master_shield.ts',
  'generate-pwa-icons.js',
  'sauvegarde-bd.js',
  'standalone-launcher.js'
];

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
    console.log(`🗑️ Dossier supprime : ${directoryPath}`);
  }
}

console.log('🌪️  LANCEMENT DU NETTOYAGE MASTER : FINAL-TOAST');

// Nettoyage des dossiers
foldersToDelete.forEach(folder => {
    if (folder.includes('.next\\cache')) deleteFolderRecursive(folder);
    // On ne supprime pas 'app' pour l'instant car InnoSetup peut en avoir besoin selon la config
});

// Nettoyage des fichiers racine
filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`🗑️ Fichier supprime : ${file}`);
  }
});

// Nettoyage radical du dossier scripts
const scriptsDir = path.join(rootDir, 'scripts');
if (fs.existsSync(scriptsDir)) {
  fs.readdirSync(scriptsDir).forEach(file => {
    if (!scriptsToKeep.includes(file) && file !== 'final_toast.js') {
      const filePath = path.join(scriptsDir, file);
      if (fs.lstatSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Script retire : ${file}`);
      }
    }
  });
}

console.log('\n✨ GESTI-COM PRO EST MAINTENANT "LEAN" (LEGER).');
console.log('🚀 PRET POUR LA COMPILATION INNO SETUP FINALE.');
