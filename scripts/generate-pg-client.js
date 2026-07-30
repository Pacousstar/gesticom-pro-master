const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
const pgSchema = path.join(root, 'prisma', 'schema.postgres.prisma')
const defaultOutput = path.join(root, 'node_modules', '.prisma', 'client')
const pgOutput = path.join(root, 'node_modules', '@prisma', 'client-pg')
const atPrismaClient = path.join(root, 'node_modules', '@prisma', 'client')

if (!fs.existsSync(pgSchema)) {
  console.log('[pg-client] schema.postgres.prisma introuvable, skip')
  process.exit(0)
}

console.log('[pg-client] Generation client PostgreSQL...')
const r1 = spawnSync(process.execPath || 'node', [prismaCli, 'generate', '--schema=' + pgSchema], {
  cwd: root, stdio: 'pipe', timeout: 120000, windowsHide: true,
})
if (r1.status !== 0) {
  console.error('[pg-client] ECHEC generation PostgreSQL:', (r1.stderr?.toString() || '').slice(0, 300))
  process.exit(1)
}
console.log('[pg-client] Generation PostgreSQL OK')

// Copy default output to client-pg directory (exclude .tmp* files recursively)
if (fs.existsSync(pgOutput)) fs.rmSync(pgOutput, { recursive: true, force: true })
if (!fs.existsSync(pgOutput)) fs.mkdirSync(pgOutput, { recursive: true })
function cpFilter(src) {
  const name = path.basename(src)
  return !/\.tmp\d*$/.test(name)
}
fs.cpSync(defaultOutput, pgOutput, { recursive: true, force: true, filter: cpFilter })
// Recursive cleanup of any stray .tmp files in pgOutput
function rmTmp(dir) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) { rmTmp(full); continue }
    if (/\.tmp\d*$/.test(f)) try { fs.unlinkSync(full) } catch {}
  }
  try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir) } catch {}
}
rmTmp(pgOutput)
console.log('[pg-client] Copie vers client-pg/ OK')

// Also update @prisma/client/index.js to match (has PG provider at this point)
const pgIndex = path.join(defaultOutput, 'index.js')
if (fs.existsSync(pgIndex)) {
  fs.copyFileSync(pgIndex, path.join(atPrismaClient, 'index.js'))
  console.log('[pg-client] @prisma/client/index.js mis à jour (PostgreSQL)')
}

// Now regenerate with SQLite schema to restore default
console.log('[pg-client] Regeneration client SQLite...')
const r2 = spawnSync(process.execPath || 'node', [prismaCli, 'generate', '--schema=' + path.join(root, 'prisma', 'schema.prisma')], {
  cwd: root, stdio: 'pipe', timeout: 120000, windowsHide: true,
})
if (r2.status !== 0) {
  console.error('[pg-client] ECHEC generation SQLite:', (r2.stderr?.toString() || '').slice(0, 300))
  process.exit(1)
}
console.log('[pg-client] Generation SQLite OK')

// Update @prisma/client/index.js to SQLite version (final state for MODE_1)
if (fs.existsSync(pgIndex)) {
  fs.copyFileSync(pgIndex, path.join(atPrismaClient, 'index.js'))
  console.log('[pg-client] @prisma/client/index.js mis à jour (SQLite)')
}
