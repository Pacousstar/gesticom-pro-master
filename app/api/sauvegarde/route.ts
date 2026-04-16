import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listBackups } from '@/lib/sauvegarde-db'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'

/**
 * GET /api/sauvegarde — Liste les sauvegardes (réservé aux rôles admin).
 */
export async function GET() {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    const backups = listBackups()
    return NextResponse.json({ backups })
  } catch (e) {
    console.error('GET /api/sauvegarde:', e)
    return NextResponse.json({ error: 'Erreur lors de la lecture des sauvegardes.' }, { status: 500 })
  }
}

/**
 * POST /api/sauvegarde — Crée une nouvelle sauvegarde immédiate.
 */
export async function POST() {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    const { createBackup } = await import('@/lib/sauvegarde-db')
    const name = await createBackup()
    return NextResponse.json({ success: true, name })
  } catch (e) {
    console.error('POST /api/sauvegarde:', e)
    return NextResponse.json({ error: 'Erreur lors de la création de la sauvegarde.' }, { status: 500 })
  }
}
