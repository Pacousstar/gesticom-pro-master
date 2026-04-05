import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const code = String(body?.code || '').trim().toUpperCase()
    const libelle = String(body?.libelle || '').trim()
    const type = ['ACHATS', 'VENTES', 'BANQUE', 'CAISSE', 'OD'].includes(String(body?.type || '').toUpperCase())
      ? String(body.type).toUpperCase()
      : 'OD'

    if (!code || !libelle) {
      return NextResponse.json({ error: 'Code et libellé requis.' }, { status: 400 })
    }

    const journal = await prisma.journal.create({
      data: { code, libelle, type, actif: true },
    })

    return NextResponse.json(journal)
  } catch (e: any) {
    console.error('POST /api/journaux:', e)
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce code de journal existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
