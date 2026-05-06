/**
 * Bump patch version in package.json + GestiCom-Install.iss
 * Usage: node scripts/bump-version.js
 */

const fs = require('fs')
const path = require('path')

function bumpPatch(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) throw new Error(`Version invalide: ${v}`)
  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3]) + 1
  return `${major}.${minor}.${patch}`
}

function main() {
  const root = path.join(__dirname, '..')

  // package.json
  const pkgPath = path.join(root, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const oldV = pkg.version
  const newV = bumpPatch(oldV)
  pkg.version = newV
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')

  // GestiCom-Install.iss
  const issPath = path.join(root, 'GestiCom-Install.iss')
  let iss = fs.readFileSync(issPath, 'utf8')
  iss = iss.replace(/#define MyAppVersion\s+"[^"]+"/, `#define MyAppVersion "${newV}"`)
  fs.writeFileSync(issPath, iss, 'utf8')

  console.log(`[bump-version] ${oldV} -> ${newV}`)
}

main()

