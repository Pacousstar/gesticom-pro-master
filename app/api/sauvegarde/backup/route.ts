import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import fs from 'fs'
import path from 'path'
import {
  getDatabaseFilePath,
  ensureBackupDir,
  backupFileName,
} from '@/lib/sauvegarde-db'

/**
 * POST /api/sauvegarde/backup — Crée une sauvegarde de la base courante.
 */
export async function POST() {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    const dbPath = getDatabaseFilePath()
    if (!dbPath) {
      console.error('[backup] Impossible de déterminer le chemin de la base de données')
      console.error('[backup] DATABASE_URL:', process.env.DATABASE_URL || 'non défini')
      console.error('[backup] CWD:', process.cwd())
      return NextResponse.json(
        { 
          error: 'Base de données introuvable (chemin ou fichier manquant).',
          details: 'DATABASE_URL non défini ou invalide. Vérifiez votre fichier .env. Le fichier de base de données doit être accessible.'
        },
        { status: 400 }
      )
    }
    
    if (!fs.existsSync(dbPath)) {
      console.error('[backup] Fichier de base de données introuvable au chemin:', dbPath)
      return NextResponse.json(
        { 
          error: 'Base de données introuvable (chemin ou fichier manquant).',
          details: `Le fichier n'existe pas au chemin: ${dbPath}. Vérifiez que le fichier existe et que DATABASE_URL dans .env pointe vers le bon emplacement.`
        },
        { status: 400 }
      )
    }
    
    // Vérifier que c'est bien un fichier et non un dossier
    const stats = fs.statSync(dbPath)
    if (!stats.isFile()) {
      return NextResponse.json(
        { 
          error: 'Le chemin spécifié n\'est pas un fichier.',
          details: `Le chemin ${dbPath} existe mais n'est pas un fichier.`
        },
        { status: 400 }
      )
    }

    const backupDir = ensureBackupDir()
    if (!backupDir) {
      return NextResponse.json(
        { error: 'Impossible de déterminer le dossier de sauvegarde.' },
        { status: 500 }
      )
    }

    const name = backupFileName()
    const destPath = path.join(backupDir, name)
    
    // Copier le fichier
    try {
      fs.copyFileSync(dbPath, destPath)
      const size = fs.statSync(destPath).size
      
      console.log('[backup] Sauvegarde créée avec succès:', destPath, `(${Math.round(size / 1024)} Ko)`)
      
      return NextResponse.json({
        success: true,
        name,
        path: destPath,
        size,
        message: `Sauvegarde créée avec succès: ${name}`,
      })
    } catch (copyError) {
      console.error('[backup] Erreur lors de la copie:', copyError)
      return NextResponse.json(
        { 
          error: 'Erreur lors de la copie du fichier de base de données.',
          details: copyError instanceof Error ? copyError.message : String(copyError)
        },
        { status: 500 }
      )
    }
  } catch (e) {
    console.error('POST /api/sauvegarde/backup:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json(
      { 
        error: 'Erreur lors de la création de la sauvegarde.',
        details: errorMsg
      },
      { status: 500 }
    )
  }
}
