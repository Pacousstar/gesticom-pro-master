/**
 * Utilitaires pour sauvegarde / restauration de la base SQLite.
 * Résout le chemin du fichier .db à partir de DATABASE_URL et gère le dossier backups.
 */

import path from 'path'
import fs from 'fs'

export const BACKUP_PREFIX = 'gesticom-backup-'
export const BACKUP_EXT = '.db'
const BACKUP_DIR_NAME = 'backups'

/**
 * Retourne le chemin absolu du fichier de base à partir de DATABASE_URL.
 * Ex. file:./prisma/gesticom.db -> C:/projet/prisma/gesticom.db
 *     file:/C:/data/gesticom.db -> C:/data/gesticom.db
 */
export function getDatabaseFilePath(): string | null {
  const url = process.env.DATABASE_URL
  if (!url || typeof url !== 'string') {
    console.error('[sauvegarde-db] DATABASE_URL non défini ou invalide')
    // Essayer de trouver le fichier dans des emplacements par défaut
    return findDatabaseFile()
  }
  
  let filePath = url.trim()
  
  // Supprimer le préfixe file: ou file://
  if (filePath.startsWith('file:///')) {
    // Windows: file:///C:/path/to/db
    filePath = filePath.slice(8)
  } else if (filePath.startsWith('file://')) {
    // Unix: file:///path/to/db
    filePath = filePath.slice(7)
  } else if (filePath.startsWith('file:')) {
    // file:./path/to/db ou file:/path/to/db
    filePath = filePath.slice(5)
  }
  
  // Décoder les caractères encodés
  try {
    filePath = decodeURIComponent(filePath)
  } catch {
    // Si le décodage échoue, utiliser tel quel
  }
  
  // Normaliser les séparateurs de chemin pour Windows
  // Sur Windows, remplacer / par \ sauf pour les chemins UNC
  if (process.platform === 'win32' && !filePath.startsWith('\\\\')) {
    // Ne pas remplacer si le chemin commence déjà par un drive letter (C:, D:, etc.)
    if (!/^[A-Za-z]:/.test(filePath)) {
      filePath = filePath.replace(/\//g, path.sep)
    }
  }
  
  // Résoudre le chemin
  let resolved: string
  if (path.isAbsolute(filePath)) {
    resolved = path.normalize(filePath)
  } else {
    // Chemin relatif - résoudre depuis le répertoire de travail
    resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath)
  }
  
  // Normaliser à nouveau pour s'assurer que les séparateurs sont corrects
  resolved = path.normalize(resolved)
  
  // Vérifier si le fichier existe
  if (fs.existsSync(resolved)) {
    const stats = fs.statSync(resolved)
    if (stats.isFile()) {
      console.log('[sauvegarde-db] Fichier trouvé:', resolved)
      return resolved
    } else {
      console.warn('[sauvegarde-db] Le chemin existe mais n\'est pas un fichier:', resolved)
    }
  } else {
    console.warn('[sauvegarde-db] Fichier non trouvé au chemin configuré:', resolved)
  }
  
  // Essayer de trouver le fichier dans des emplacements alternatifs
  return findDatabaseFile(resolved)
}

/**
 * Recherche le fichier de base de données dans des emplacements par défaut
 */
function findDatabaseFile(originalPath?: string): string | null {
  const cwd = process.cwd()
  const possiblePaths = [
    // Emplacements relatifs au projet (les plus probables)
    path.join(/*turbopackIgnore: true*/ cwd, 'prisma', 'gesticom.db'),
    path.join(/*turbopackIgnore: true*/ cwd, 'prisma', 'prisma', 'gesticom.db'), // Cas où Prisma génère dans prisma/prisma
    path.join(/*turbopackIgnore: true*/ cwd, 'data', 'gesticom.db'),
    path.join(/*turbopackIgnore: true*/ cwd, 'gesticom.db'),
    // Si un chemin original était fourni, l'inclure aussi
    ...(originalPath ? [originalPath] : []),
  ]
  
  console.log('[sauvegarde-db] Recherche du fichier dans les emplacements suivants:')
  for (const possiblePath of possiblePaths) {
    try {
      const normalized = path.normalize(possiblePath)
      const exists = fs.existsSync(normalized)
      console.log('[sauvegarde-db]   -', normalized, exists ? '✓' : '✗')
      if (exists) {
        const stats = fs.statSync(normalized)
        if (stats.isFile()) {
          console.log('[sauvegarde-db] Fichier trouvé à l\'emplacement alternatif:', normalized)
          return normalized
        }
      }
    } catch (e) {
      // Ignorer les erreurs de chemin
      console.log('[sauvegarde-db]   - Erreur lors de la vérification:', e instanceof Error ? e.message : String(e))
    }
  }
  
  console.error('[sauvegarde-db] Aucun fichier de base de données trouvé dans les emplacements par défaut')
  return null
}

/**
 * Dossier des sauvegardes (même répertoire parent que le fichier .db, sous-dossier "backups").
 */
export function getBackupDir(): string | null {
  const dbPath = getDatabaseFilePath()
  if (!dbPath) return null
  const dir = path.join(/*turbopackIgnore: true*/ path.dirname(dbPath), BACKUP_DIR_NAME)
  return dir
}

/**
 * Crée le dossier backups si nécessaire. Retourne le chemin du dossier ou null.
 */
export function ensureBackupDir(): string | null {
  const dir = getBackupDir()
  if (!dir) return null
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Génère un nom de fichier de sauvegarde avec horodatage.
 */
export function backupFileName(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${BACKUP_PREFIX}${y}-${m}-${d}-${h}${min}${s}${BACKUP_EXT}`
}

/**
 * Liste les fichiers de sauvegarde (nom, taille, date). Tri par date décroissante.
 * Ne retourne que les fichiers dont le nom correspond au préfixe attendu.
 */
export function listBackups(): Array<{ name: string; size: number; date: string }> {
  const dir = getBackupDir()
  if (!dir || !fs.existsSync(dir)) return []
  const files = fs.readdirSync(dir)
  const result: Array<{ name: string; size: number; date: string }> = []
  for (const name of files) {
    if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith(BACKUP_EXT)) continue
    const fullPath = path.join(/*turbopackIgnore: true*/ dir, name)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isFile()) {
        result.push({
          name,
          size: stat.size,
          date: stat.mtime.toISOString(),
        })
      }
    } catch {
      // Fichier inaccessible, ignorer
    }
  }
  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return result
}

/**
 * Effectue une sauvegarde physique immédiate du fichier .db actuel.
 */
export function createBackup(): string {
  const dbPath = getDatabaseFilePath()
  if (!dbPath) throw new Error('Chemin de la base de données non trouvé.')
  
  const dir = ensureBackupDir()
  if (!dir) throw new Error('Impossible de créer le dossier des sauvegardes.')
  
  const targetName = backupFileName()
  const targetPath = path.join(/*turbopackIgnore: true*/ dir, targetName)
  
  fs.copyFileSync(dbPath, targetPath)
  console.log(`[sauvegarde-db] Sauvegarde créée : ${targetPath}`)
  
  return targetName
}
