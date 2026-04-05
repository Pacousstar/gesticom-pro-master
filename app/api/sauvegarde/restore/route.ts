import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { restoreSchema } from '@/lib/validations'
import fs from 'fs'
import path from 'path'
import { getDatabaseFilePath, getBackupDir } from '@/lib/sauvegarde-db'

/**
 * POST /api/sauvegarde/restore — Restaure la base à partir d'une sauvegarde.
 * Body: { name: "gesticom-backup-2025-01-30-120000.db" }
 * Attention : la base peut être verrouillée par l'application ; en cas d'échec, redémarrer l'app puis réessayer ou restaurer manuellement.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => ({}))
    const parsed = restoreSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Nom de sauvegarde invalide.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const { name } = parsed.data

    const dbPath = getDatabaseFilePath()
    if (!dbPath) {
      return NextResponse.json(
        { error: 'Chemin de la base de données introuvable.' },
        { status: 500 }
      )
    }

    const backupDir = getBackupDir()
    if (!backupDir || !fs.existsSync(backupDir)) {
      return NextResponse.json({ error: 'Dossier de sauvegarde introuvable.' }, { status: 404 })
    }

    const backupPath = path.join(backupDir, name)
    if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
      return NextResponse.json({ error: 'Sauvegarde introuvable.' }, { status: 404 })
    }

    try {
      fs.copyFileSync(backupPath, dbPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isLocked = /EBUSY|EPERM|locked|in use/i.test(msg)
      return NextResponse.json(
        {
          error: isLocked
            ? 'Impossible d\'écrire la base (fichier en cours d\'utilisation). Fermez l\'application, remplacez manuellement le fichier .db par la sauvegarde, puis relancez.'
            : 'Erreur lors de la restauration : ' + msg,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Base restaurée. Redémarrez l\'application pour utiliser la base restaurée.',
    })
  } catch (e) {
    console.error('POST /api/sauvegarde/restore:', e)
    return NextResponse.json(
      { error: 'Erreur lors de la restauration.' },
      { status: 500 }
    )
  }
}
