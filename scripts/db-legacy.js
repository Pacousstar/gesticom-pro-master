const fs = require('fs')
const path = require('path')

const LEGACY_PATHS = [
  'C:\\gesticom\\gesticom.db',
  'C:\\ProgramData\\gesticom\\gesticom.db',
  'C:\\Users\\Public\\gesticom\\gesticom.db',
]

function findLegacyDB(dataDir) {
  const newPath = path.join(dataDir, 'gesticom.db')
  if (fs.existsSync(newPath)) {
    return { found: false, path: newPath, reason: 'deja presente' }
  }

  for (const p of LEGACY_PATHS) {
    if (fs.existsSync(p)) {
      const size = fs.statSync(p).size
      return { found: true, path: p, size, reason: `trouvee dans ${p}` }
    }
  }

  return { found: false, path: null, reason: 'aucune base legacy trouvee' }
}

function copyLegacyToNew(dataDir) {
  const result = findLegacyDB(dataDir)
  if (!result.found) return result

  const dest = path.join(dataDir, 'gesticom.db')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  fs.copyFileSync(result.path, dest)
  return { ...result, dest, copied: true, reason: `copiee de ${result.path} vers ${dest}` }
}

module.exports = { findLegacyDB, copyLegacyToNew, LEGACY_PATHS }
