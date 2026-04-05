import { access } from 'fs/promises'
import path from 'path'

/** Retourne le premier chemin existant pour filename (ex. GestiCom_Produits_Master.json), ou null. */
export async function resolveDataFilePath(filename: string): Promise<string | null> {
  const cwd = process.cwd()
  const bases = [
    path.join(cwd, 'data'),
    path.join(cwd, '..', 'data'),
  ]
  for (const base of bases) {
    const p = path.join(base, filename)
    try {
      await access(p)
      return p
    } catch {
      continue
    }
  }
  return null
}
