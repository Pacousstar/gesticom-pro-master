import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { journalSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const type = request.nextUrl.searchParams.get('type')?.trim()

  const where: {
    actif?: boolean
    type?: string
  } = { actif: true }

  if (type) where.type = type

  const journaux = await prisma.journal.findMany({
    where,
    orderBy: { code: 'asc' },
  })

  return NextResponse.json(journaux, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
  } catch (e) {
    await apiCatch(e, 'api/journaux')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateApiRequest(journalSchema, body)
    if (!result.success) return result.response
    const data = result.data

    const journal = await prisma.journal.create({
      data: { code: data.code, libelle: data.libelle, type: data.type, actif: true },
    })

    return NextResponse.json(journal)
  } catch (e: any) {
    await apiCatch(e, 'api/journaux')
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce code de journal existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
