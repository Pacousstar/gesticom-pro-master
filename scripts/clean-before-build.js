const fs = require('fs')
const path = require('path')
const root = __dirname + '/..'

const STANDALONE = path.join(root, '.next', 'standalone')

function rm(p, desc) {
  const full = path.join(root, p)
  if (!fs.existsSync(full)) { console.log(`  - ${desc} : introuvable`); return }
  const stat = fs.statSync(full)
  try {
    if (stat.isDirectory()) fs.rmSync(full, { recursive: true, force: true })
    else fs.rmSync(full, { force: true })
    console.log(`  ✓ ${desc} : ${(stat.size / 1048576).toFixed(1)} MB libérés`)
  } catch (e) { console.log(`  ✗ ${desc} : erreur - ${e.message}`) }
}

console.log('\n=== Nettoyage pre-build ===\n')

if (!fs.existsSync(STANDALONE)) {
  console.log('  .next/standalone introuvable. Lancez d\'abord npm run build.')
  process.exit(0)
}

// 1. Fichier tmp orphelin (doublon prisma engine)
const tmpFile = path.join(STANDALONE, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node.tmp14820')
if (fs.existsSync(tmpFile)) {
  const size = fs.statSync(tmpFile).size
  fs.rmSync(tmpFile)
  console.log(`  ✓ Fichier tmp orphelin : ${(size / 1048576).toFixed(1)} MB libérés`)
} else {
  console.log('  - Fichier tmp orphelin : introuvable')
}

// 2. Source maps jspdf
const jspdfDist = path.join(STANDALONE, 'node_modules', 'jspdf', 'dist')
if (fs.existsSync(jspdfDist)) {
  const maps = fs.readdirSync(jspdfDist).filter(f => f.endsWith('.map'))
  let total = 0
  for (const m of maps) {
    const fp = path.join(jspdfDist, m)
    total += fs.statSync(fp).size
    fs.rmSync(fp)
  }
  console.log(`  ✓ Source maps jspdf (${maps.length} fichiers) : ${(total / 1048576).toFixed(1)} MB libérés`)
}

// 3. Base SQLite de dev dans standalone
const dbPath = path.join(STANDALONE, 'prisma', 'gesticom.db')
if (fs.existsSync(dbPath)) {
  const size = fs.statSync(dbPath).size
  fs.rmSync(dbPath)
  console.log(`  ✓ Base SQLite dev (gesticom.db) : ${(size / 1048576).toFixed(1)} MB libérés`)
}

// 4. Fichiers .ts dans app/ et lib/ (standalone)
let tsCleaned = 0
let tsSize = 0
for (const dir of ['app', 'lib', 'hooks']) {
  const full = path.join(STANDALONE, dir)
  if (!fs.existsSync(full)) continue
  const entries = fs.readdirSync(full, { recursive: true, encoding: 'utf8' })
  for (const entry of entries) {
    const fp = path.join(full, entry)
    try {
      if (fs.statSync(fp).isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
        tsSize += fs.statSync(fp).size
        fs.rmSync(fp)
        tsCleaned++
      }
    } catch {}
  }
}
if (tsCleaned > 0) console.log(`  ✓ Fichiers .ts/.tsx (${tsCleaned}) : ${(tsSize / 1048576).toFixed(1)} MB libérés`)

// 5. Logs résiduels
for (const f of ['GestiComService.out', 'GestiComService.err', 'gesticom-error.log']) {
  const fp = path.join(STANDALONE, f)
  if (fs.existsSync(fp)) {
    const size = fs.statSync(fp).size
    fs.rmSync(fp)
    console.log(`  ✓ ${f} : ${(size / 1048576).toFixed(1)} MB libérés`)
  }
}

// 6. Engines Prisma inutilisés (mysql.wasm, sqlite.wasm)
const prismaRuntime = path.join(STANDALONE, 'node_modules', '@prisma', 'client', 'runtime')
for (const wasm of ['query_engine_bg.mysql.wasm', 'query_engine_bg.sqlite.wasm']) {
  const fp = path.join(prismaRuntime, wasm)
  if (fs.existsSync(fp)) {
    const size = fs.statSync(fp).size
    fs.rmSync(fp)
    console.log(`  ✓ Engine inutilisé ${wasm} : ${(size / 1048576).toFixed(1)} MB libérés`)
  }
}

// 7. tsconfig.tsbuildinfo à la racine standalone
const tsbuild = path.join(STANDALONE, 'tsconfig.tsbuildinfo')
if (fs.existsSync(tsbuild)) {
  const size = fs.statSync(tsbuild).size
  fs.rmSync(tsbuild)
  console.log(`  ✓ tsconfig.tsbuildinfo : ${(size / 1048576).toFixed(1)} MB libérés`)
}

// 8. node_modules/.cache
rm('node_modules/.cache', 'Cache npm/node-gyp')
rm('node_modules/.prisma/client/query_engine-windows.dll.node.tmp*', 'Autres résidus tmp')

console.log('\n=== Nettoyage terminé ===\n')
