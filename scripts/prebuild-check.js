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

// 1. Syntaxe JS des scripts de build
console.log('\n[Scripts JS]')
const jsFiles = [
  'scripts/standalone-launcher.js',
  'scripts/bump-version.js',
  'scripts/download-postgres.js',
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

// 2. Vérification .next/standalone (peut ne pas exister avant build)
console.log('\n[Build]')
const standaloneServer = path.join(root, '.next', 'standalone', 'server.js')
if (fs.existsSync(standaloneServer)) {
  console.log('  ✓ .next/standalone/server.js présent')
} else {
  console.log('  ~ .next/standalone/server.js absent (normal si premier build)')
}

console.log(`\n${errors === 0 ? '✓ Toutes les vérifications passées' : `✘ ${errors} erreur(s) détectée(s)`}`)
process.exit(errors > 0 ? 1 : 0)
