const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')

let errors = 0

function check(ok, msg) {
  if (!ok) { console.error('  ✘ ' + msg); errors++ }
  else console.log('  ✓ ' + msg)
}

console.log('--- Vérification pre-build ---')

// 1. Syntaxe JS de tous les scripts racine
console.log('\n[Scripts JS]')
const jsFiles = [
  'start.js',
  'scripts/standalone-launcher.js',
  'scripts/install-service.js',
  'scripts/maintenance-runner.js',
  'scripts/seed.js',
  'scripts/sauvegarde-bd.js',
  'scripts/bump-version.js',
  'next.config.js',
]
for (const f of jsFiles) {
  const full = path.join(root, f)
  if (!fs.existsSync(full)) { check(false, `${f} introuvable`); continue }
  try {
    execSync(`node -c "${full}"`, { stdio: 'pipe', timeout: 5000, windowsHide: true })
    check(true, `${f} syntaxe OK`)
  } catch (e) {
    check(false, `${f} : ${e.stderr?.toString().split('\n')[0] || e.message}`)
  }
}

// 2. Fichiers essentiels présents
console.log('\n[Fichiers essentiels]')
const essentials = [
  'node.exe',                     // runtime Node.js
  'nssm.exe',                     // NSSM
  'LANCER-SILENCIEUX.vbs',        // launcher VBS
]
for (const f of essentials) {
  check(fs.existsSync(path.join(root, f)), `${f} présent`)
}

// 2b. Vérification optionnelle standalone (peut ne pas exister avant build)
const standaloneServer = path.join(root, '.next', 'standalone', 'server.js')
if (fs.existsSync(standaloneServer)) {
  console.log('  ✓ .next/standalone/server.js présent')
} else {
  console.log('  ~ .next/standalone/server.js absent (normal si premier build)')
}

// 3. GestiCom-Install.iss cohérent
console.log('\n[Inno Setup]')
const issPath = path.join(root, 'GestiCom-Install.iss')
if (fs.existsSync(issPath)) {
  const iss = fs.readFileSync(issPath, 'utf8')
  const versionMatch = iss.match(/#define MyAppVersion "(\d+\.\d+\.\d+)"/)
  check(!!versionMatch, `Version ISS: ${versionMatch ? versionMatch[1] : 'non trouvée'}`)
  check(iss.includes('Source: ".next\\standalone\\*"'), 'Source standalone présente')
  check(iss.includes('Source: "nssm.exe"'), 'NSSM inclus')
  check(iss.includes('Source: "scripts\\install-service.js"'), 'install-service.js inclus')
  check(iss.includes('Filename: "{app}\\node.exe"'), 'Service installé')
} else {
  check(false, 'GestiCom-Install.iss introuvable')
}

// 4. Vérification rapide LANCER-SILENCIEUX.vbs
console.log('\n[VBScript]')
const vbsPath = path.join(root, 'LANCER-SILENCIEUX.vbs')
if (fs.existsSync(vbsPath)) {
  const vbs = fs.readFileSync(vbsPath, 'utf8')
  check(vbs.includes('net start GestiComPro'), 'Contient net start')
  check(vbs.includes('http://localhost:3001'), 'URL 3001 présente')
  check(vbs.includes('ShellApp.ShellExecute'), 'Ouverture navigateur')
}

console.log(`\n${errors === 0 ? '✓ Toutes les vérifications passées' : `✘ ${errors} erreur(s) détectée(s)`}`)
process.exit(errors > 0 ? 1 : 0)
