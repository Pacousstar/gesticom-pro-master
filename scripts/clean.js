const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const filesToDelete = [
  'tsconfig.tsbuildinfo',
  'server.log',
  '.env.example',
  'eslint.config.mjs',
  'postcss.config.mjs',
  '.gitignore',
  'next-env.d.ts'
];

console.log('🌪️  DERNIER COUP DE BALAI MASTER-SHIELD...');

filesToDelete.forEach(file => {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️ Retire : ${file}`);
  }
});

console.log('\n✨ RACINE NETTOYEE. GestiCom Pro est maintenant pur et professionnel.');
