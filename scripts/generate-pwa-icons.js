/**
 * Script pour générer les icônes PWA à partir du logo
 * 
 * Usage:
 * 1. Installer sharp: npm install sharp --save-dev
 * 2. Exécuter: node scripts/generate-pwa-icons.js
 * 
 * Note: Ce script nécessite le package 'sharp' pour le redimensionnement d'images
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    // Vérifier si sharp est installé
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      console.error('❌ Le package "sharp" n\'est pas installé.');
      console.log('📦 Installation: npm install sharp --save-dev');
      console.log('\n💡 Alternative: Créez manuellement les icônes:');
      console.log('   - icon-192x192.png (192x192 pixels)');
      console.log('   - icon-512x512.png (512x512 pixels)');
      console.log('   Utilisez le logo.png comme base et redimensionnez-le.');
      process.exit(1);
    }

    const logoPath = path.join(__dirname, '../public/logo.png');
    const outputDir = path.join(__dirname, '../public');

    // Vérifier que le logo existe
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo introuvable:', logoPath);
      console.log('💡 Assurez-vous que public/logo.png existe.');
      process.exit(1);
    }

    console.log('🎨 Génération des icônes PWA...');

    // Générer icon-192x192.png
    await sharp(logoPath)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-192x192.png'));

    console.log('✅ icon-192x192.png créé');

    // Générer icon-512x512.png
    await sharp(logoPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-512x512.png'));

    console.log('✅ icon-512x512.png créé');

    console.log('\n🎉 Icônes PWA générées avec succès !');
    console.log('📱 Les icônes sont prêtes pour l\'installation PWA.');

  } catch (error) {
    console.error('❌ Erreur lors de la génération des icônes:', error.message);
    process.exit(1);
  }
}

generateIcons();
