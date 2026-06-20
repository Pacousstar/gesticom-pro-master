import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { logSuppression, getIpAddress } from '@/lib/audit'
import fs from 'fs'
import path from 'path'
import { getBackupDir, BACKUP_PREFIX, BACKUP_EXT } from '@/lib/sauvegarde-db'
import { apiCatch } from '@/lib/log-error'

function isValidBackupName(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXT)
}

export async function DELETE(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'sauvegardes:delete')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

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

    await logSuppression(session!, 'SAUVEGARDE', 0, `Suppression sauvegarde: ${name}`, { name }, getIpAddress(request))

    return NextResponse.json({ success: true, message: `Sauvegarde ${name} supprimée avec succès.` })
  } catch (e) {
    await apiCatch(e, 'api/sauvegarde/delete')
    const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la sauvegarde.', details: errorMsg },
      { status: 500 }
    )
  }
}
