import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import fs from 'fs'
import path from 'path'
import { getBackupDir, BACKUP_PREFIX, BACKUP_EXT } from '@/lib/sauvegarde-db'

/**
 * Vérifie que le nom de fichier est bien un nom de sauvegarde (pas de path traversal).
 */
function isValidBackupName(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXT)
}

/**
 * GET /api/sauvegarde/download?name=gesticom-backup-2025-01-30.db — Télécharge un fichier de sauvegarde.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name || !isValidBackupName(name)) {
    return NextResponse.json({ error: 'Nom de sauvegarde invalide.' }, { status: 400 })
  }

  const backupDir = getBackupDir()
  if (!backupDir || !fs.existsSync(backupDir)) {
    return NextResponse.json({ error: 'Dossier de sauvegarde introuvable.' }, { status: 404 })
  }

  const filePath = path.join(backupDir, name)
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: 'Sauvegarde introuvable.' }, { status: 404 })
  }

  try {
    const buffer = fs.readFileSync(filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (e) {
    console.error('GET /api/sauvegarde/download:', e)
    return NextResponse.json({ error: 'Erreur lors de la lecture du fichier.' }, { status: 500 })
  }
}
