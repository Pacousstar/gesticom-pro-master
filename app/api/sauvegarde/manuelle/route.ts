import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { createBackup, getBackupDir } from '@/lib/sauvegarde-db'
import { requirePermission } from '@/lib/require-role'
import { logAction, getIpAddress } from '@/lib/audit'
import path from 'path'

export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'sauvegardes:create')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const backupName = await createBackup()
    const backupDir = getBackupDir()

    // Log Audit
    await logAction(
      session,
      'CREATION',
      'SAUVEGARDE',
      `Sauvegarde manuelle effectuée : ${backupName} (Dossier GestiCom Pro)`,
      undefined,
      { backupName, backupDir },
      getIpAddress(request)
    )

    return NextResponse.json({ 
      success: true, 
      name: backupName,
      path: backupDir ? path.join(backupDir, backupName) : backupName,
      message: `La sauvegarde a été enregistrée avec succès dans le dossier GestiCom Pro (${backupName})`
    })
  } catch (e: any) {
    console.error('POST /api/sauvegarde/manuelle:', e)
    return NextResponse.json({ error: e.message || 'Erreur lors de la création de la sauvegarde.' }, { status: 500 })
  }
}
