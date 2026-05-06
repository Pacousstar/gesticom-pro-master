import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listBackups, createBackup } from '@/lib/sauvegarde-db'
import { requirePermission } from '@/lib/require-role'
import { logModification, getIpAddress } from '@/lib/audit'

export async function GET() {
  const session = await getSession()
  const authError = requirePermission(session, 'parametres:backup')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const backups = listBackups()
    return NextResponse.json({ backups })
  } catch (e) {
    console.error('GET /api/sauvegarde:', e)
    return NextResponse.json({ error: 'Erreur lors de la lecture des sauvegardes.' }, { status: 500 })
  }
}

export async function POST() {
  const session = await getSession()
  const authError = requirePermission(session, 'parametres:backup')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const name = await createBackup()
    await logModification(session, 'SAUVEGARDE', 0, `Création sauvegarde: ${name}`, {}, { name }, getIpAddress({} as any))
    return NextResponse.json({ success: true, name })
  } catch (e) {
    console.error('POST /api/sauvegarde:', e)
    return NextResponse.json({ error: 'Erreur lors de la création de la sauvegarde.' }, { status: 500 })
  }
}
