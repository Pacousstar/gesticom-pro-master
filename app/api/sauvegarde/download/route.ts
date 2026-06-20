import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import fs from 'fs'
import path from 'path'
import { getBackupDir, BACKUP_PREFIX, BACKUP_EXT } from '@/lib/sauvegarde-db'
import { apiCatch } from '@/lib/log-error'

function isValidBackupName(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXT)
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'sauvegardes:view')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name || !isValidBackupName(name)) {
    return NextResponse.json({ error: 'Nom de sauvegarde invalide.' }, { status: 400 })
  }

  const backupDir = getBackupDir()
  if (!backupDir || !fs.existsSync(backupDir)) {
    return NextResponse.json({ error: 'Dossier de sauvegarde introuvable.' }, { status: 404 })
  }

  const filePath = path.join(/*turbopackIgnore: true*/ backupDir, name)
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
    await apiCatch(e, 'api/sauvegarde/download')
    return NextResponse.json({ error: 'Erreur lors de la lecture du fichier.' }, { status: 500 })
  }
}
