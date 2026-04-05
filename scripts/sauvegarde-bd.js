/**
 * Script CLI : créer une sauvegarde de la base ou lister les sauvegardes.
 * Usage :
 *   node scripts/sauvegarde-bd.js          -> crée une sauvegarde
 *   node scripts/sauvegarde-bd.js list     -> liste les sauvegardes
 *
 * Nécessite : DATABASE_URL dans .env (ou .database_url) et être exécuté depuis la racine du projet.
 * Les sauvegardes sont créées dans <répertoire de la base>/backups/
 */

const path = require('path')
const fs = require('fs')

const projectRoot = path.resolve(__dirname, '..')
const envPath = path.join(projectRoot, '.env')
const urlPath = path.join(projectRoot, '.database_url')

if (fs.existsSync(urlPath)) {
  try {
    process.env.DATABASE_URL = fs.readFileSync(urlPath, 'utf8').trim()
  } catch (_) {}
}
if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  try {
    const content = fs.readFileSync(envPath, 'utf8')
    // Regex améliorée pour supporter les guillemets et espaces
    const m = content.match(/DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/)
    if (m) process.env.DATABASE_URL = m[1].replace(/["']$/g, '').trim()
  } catch (_) {}
}

// Si toujours rien, on utilise le chemin portable par défaut
if (!process.env.DATABASE_URL) {
    const localDbPath = path.join(projectRoot, 'database', 'gesticom.db');
    if (fs.existsSync(localDbPath)) {
        process.env.DATABASE_URL = `file:${localDbPath.replace(/\\/g, '/')}`;
    } else {
        const legacyDbPath = "C:/gesticom/gesticom.db";
        if (fs.existsSync(legacyDbPath)) {
            process.env.DATABASE_URL = `file:${legacyDbPath}`;
        }
    }
}

if (!process.env.DATABASE_URL) {
  console.error('sauvegarde-bd: DATABASE_URL manquant. Définissez-le dans .env ou .database_url.')
  process.exit(1)
}

function getDatabaseFilePath() {
  let filePath = process.env.DATABASE_URL.trim()
  if (filePath.startsWith('file:')) filePath = filePath.slice(5)
  if (filePath.startsWith('file:///')) filePath = filePath.slice(8)
  else if (filePath.startsWith('file://')) filePath = filePath.slice(7)
  try {
    filePath = decodeURIComponent(filePath)
  } catch (_) {}
  if (path.isAbsolute(filePath)) return filePath
  return path.resolve(projectRoot, filePath)
}

const BACKUP_PREFIX = 'gesticom-backup-'
const BACKUP_EXT = '.db'
const BACKUP_DIR_NAME = 'backups'

function getBackupDir() {
  const dbPath = getDatabaseFilePath()
  return path.join(path.dirname(dbPath), BACKUP_DIR_NAME)
}

function backupFileName() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${BACKUP_PREFIX}${y}-${m}-${d}-${h}${min}${s}${BACKUP_EXT}`
}

function listBackups() {
  const dir = getBackupDir()
  if (!fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir)
  const result = []
  for (const name of files) {
    if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith(BACKUP_EXT)) continue
    const fullPath = path.join(dir, name)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isFile()) result.push({ name, size: stat.size, date: stat.mtime })
    } catch (_) {}
  }
  result.sort((a, b) => b.date.getTime() - a.date.getTime())
  return result
}

const command = process.argv[2] === 'list' ? 'list' : 'backup'

if (command === 'list') {
  const backups = listBackups()
  if (backups.length === 0) {
    console.log('Aucune sauvegarde.')
  } else {
    console.log('Sauvegardes (répertoire:', getBackupDir(), '):')
    backups.forEach((b) => {
      const sizeKo = (b.size / 1024).toFixed(1)
      console.log('  ', b.name, '  ', sizeKo, 'Ko  ', b.date.toLocaleString('fr-FR'))
    })
  }
  process.exit(0)
}

const dbPath = getDatabaseFilePath()
if (!fs.existsSync(dbPath)) {
  console.error('Base introuvable:', dbPath)
  process.exit(1)
}

const backupDir = getBackupDir()
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

const name = backupFileName()
const destPath = path.join(backupDir, name)
fs.copyFileSync(dbPath, destPath)
const sizeKo = (fs.statSync(destPath).size / 1024).toFixed(1)
console.log('Sauvegarde créée:', destPath, '(' + sizeKo + ' Ko)')
