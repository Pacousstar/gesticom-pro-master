import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import fs from 'fs'
import path from 'path'
import { apiCatch } from '@/lib/log-error'
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
  const authError = requirePermission(session, 'sauvegardes:create')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const dbPath = getDatabaseFilePath()
    if (!dbPath) {
      await apiCatch(new Error('Impossible de déterminer le chemin ou de créer la sauvegarde'), 'api/sauvegarde/backup')
      return NextResponse.json(
        { 
          error: 'Base de données introuvable (chemin ou fichier manquant).',
          details: 'DATABASE_URL non défini ou invalide. Vérifiez votre fichier .env. Le fichier de base de données doit être accessible.'
        },
        { status: 400 }
      )
    }
    
    if (!fs.existsSync(dbPath)) {
      await apiCatch(new Error('Fichier de base de données introuvable: ' + dbPath), 'api/sauvegarde/backup')
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
      
    
      
      return NextResponse.json({
        success: true,
        name,
        path: destPath,
        size,
        message: `Sauvegarde créée avec succès: ${name}`,
      })
    } catch (copyError) {
      await apiCatch(copyError, 'api/sauvegarde/backup')
      return NextResponse.json(
        { 
          error: 'Erreur lors de la copie du fichier de base de données.',
          details: copyError instanceof Error ? copyError.message : String(copyError)
        },
        { status: 500 }
      )
    }
  } catch (e) {
    await apiCatch(e, 'api/sauvegarde/backup')
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
