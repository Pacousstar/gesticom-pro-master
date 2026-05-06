import { access } from 'fs/promises'
import path from 'path'

/** Retourne le premier chemin existant pour filename (ex. GestiCom_Produits_Master.json), ou null. */
export async function resolveDataFilePath(filename: string): Promise<string | null> {
  // Validation de sécurité : interdire les séquences de path traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    console.warn('[resolveDataFilePath] Nom de fichier invalide : tentative de path traversal détectée.')
    return null
  }

  // Valider que le filename ne contient que des caractères sûrs (alphanum, tiret, underscore, point)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
    console.warn('[resolveDataFilePath] Nom de fichier contient des caractères non autorisés.')
    return null
  }

  const cwd = process.cwd()
  const bases = [
    path.join(cwd, 'data'),
    path.join(cwd, '..', 'data'),
  ]
  for (const base of bases) {
    const p = path.join(base, filename)
    // Vérifier que le chemin résolu reste dans le répertoire de base autorisé
    const resolvedPath = path.resolve(p)
    const resolvedBase = path.resolve(base)
    if (!resolvedPath.startsWith(resolvedBase)) {
      continue // Chemin hors de la base autorisée
    }
    try {
      await access(p)
      return p
    } catch {
      continue
    }
  }
  return null
}
