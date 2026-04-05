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
 * DELETE /api/sauvegarde/delete?name=gesticom-backup-2025-01-30.db — Supprime un fichier de sauvegarde.
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    const name = request.nextUrl.searchParams.get('name')
    if (!name || !isValidBackupName(name)) {
      return NextResponse.json({ error: 'Nom de sauvegarde invalide.' }, { status: 400 })
    }

    const backupDir = getBackupDir()
    if (!backupDir || !fs.existsSync(backupDir)) {
      return NextResponse.json({ error: 'Dossier de sauvegarde introuvable.' }, { status: 404 })
    }

    const backupPath = path.join(backupDir, name)
    if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
      return NextResponse.json({ error: 'Sauvegarde introuvable.' }, { status: 404 })
    }

    fs.unlinkSync(backupPath)
    return NextResponse.json({ success: true, message: `Sauvegarde ${name} supprimée avec succès.` })
  } catch (e) {
    console.error('DELETE /api/sauvegarde/delete:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la sauvegarde.', details: errorMsg },
      { status: 500 }
    )
  }
}
