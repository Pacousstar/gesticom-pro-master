const fs = require('fs')
const path = require('path')

/** @type {import('next').NextConfig} */
// On lit la version directement depuis package.json (fs.readFileSync + JSON.parse)
// pour éviter le problème où npm_package_version est figé AVANT le bump de version.
// Contrairement à require(), fs.readFileSync n'ajoute pas le fichier au graphe NFT.
const pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version

const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: pkgVersion,
  },
  outputFileTracingExcludes: {
    '*': [
      '**/api/sauvegarde/**/*',
      '**/backups/**/*',
    ],
  },
};

module.exports = nextConfig;
