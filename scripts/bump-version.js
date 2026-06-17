/**
 * Gestion semantique de versionnage GestiCom Pro
 * 
 * Logique:
 * - 2.0.x : x va de 0 a 20 (20 releases)
 * - Apres 2.0.20 -> 2.1.0
 * - 2.1.x : x va de 1 a 5 (5 releases)
 * - Apres 2.1.5 -> 2.2.0
 * - ...
 * - Apres 2.5.5 -> 3.0.0
 * 
 * Usage: node scripts/bump-version.js
 */

const fs = require('fs')
const path = require('path')

function parseVersion(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!m) throw new Error(`Version invalide: ${v}`)
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3])
  }
}

function incrementVersion(currentVersion) {
  const v = parseVersion(currentVersion)
  
  // Cas special: 2.5.5 -> 3.0.0
  if (v.major === 2 && v.minor === 5 && v.patch === 5) {
    return { major: 3, minor: 0, patch: 0 }
  }
  
  // Cas: version mineure 0 (2.0.x) -> apres 20, passer a la mineure suivante
  if (v.minor === 0) {
    if (v.patch >= 20) {
      // 2.0.20 -> 2.1.0
      return { major: v.major, minor: v.minor + 1, patch: 0 }
    } else {
      // 2.0.x -> 2.0.(x+1)
      return { major: v.major, minor: v.minor, patch: v.patch + 1 }
    }
  }
  
  // Cas: autres mineures (2.1.x, 2.2.x, ...) -> apres 5, passer a la mineure suivante
  if (v.patch >= 5) {
    // 2.x.5 -> 2.(x+1).0
    return { major: v.major, minor: v.minor + 1, patch: 0 }
  } else {
    // 2.x.y -> 2.x.(y+1)
    return { major: v.major, minor: v.minor, patch: v.patch + 1 }
  }
}

function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}`
}

function main() {
  const root = path.join(__dirname, '..')
  
  // package.json
  const pkgPath = path.join(root, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const oldV = pkg.version
  
  console.log(`[bump-version] Version actuelle: ${oldV}`)
  
  const newV = formatVersion(incrementVersion(oldV))
  
  pkg.version = newV
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  
  // GestiCom-Install.iss
  const issPath = path.join(root, 'GestiCom-Install.iss')
  let iss = fs.readFileSync(issPath, 'utf8')
  iss = iss.replace(/#define MyAppVersion\s+"[^"]+"/, `#define MyAppVersion "${newV}"`)
  fs.writeFileSync(issPath, iss, 'utf8')
  
  // .env (dev + prod)
  for (const envFile of ['.env', '.env.production', '.env.local'].filter(f => fs.existsSync(path.join(root, f)))) {
    let env = fs.readFileSync(path.join(root, envFile), 'utf8')
    env = env.replace(/^NEXT_PUBLIC_APP_VERSION=.*$/m, `NEXT_PUBLIC_APP_VERSION=${newV}`)
    fs.writeFileSync(path.join(root, envFile), env, 'utf8')
  }

  // public/sw.js — change le cache name pour forcer le navigateur à détecter la mise à jour
  const swPath = path.join(root, 'public', 'sw.js')
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8')
    sw = sw.replace(/^const CACHE_NAME = '.*'$/m, `const CACHE_NAME = 'gesticom-${newV}'`)
    fs.writeFileSync(swPath, sw, 'utf8')
  }
  
  console.log(`[bump-version] ${oldV} -> ${newV} ✅`)
  
  // Afficher la progression
  const v = parseVersion(newV)
  if (v.major === 2 && v.minor === 0) {
    console.log(`[bump-version] Progression: ${v.patch}/20 sur mineur 0`)
  } else if (v.major === 3 && v.minor === 0) {
    console.log(`[bump-version] 🎉 MAJOR UPDATE: Version 3.0.0 atteinte!`)
  }
}

main()