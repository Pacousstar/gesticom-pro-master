import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const tous = request.nextUrl.searchParams.get('tous') === '1'
    const entites = await prisma.entite.findMany({
      where: tous ? {} : { active: true },
      select: {
        id: true,
        code: true,
        nom: true,
        type: true,
        localisation: true,
        active: true,
      },
      orderBy: { nom: 'asc' },
    })
    return NextResponse.json(entites)
  } catch (e) {
    console.error('GET /api/entites:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const nom = String(body?.nom ?? '').trim()
    const type = String(body?.type ?? 'MAISON_MERE').trim()
    const localisation = String(body?.localisation ?? '').trim()

    if (!code) return NextResponse.json({ error: 'Code requis.' }, { status: 400 })
    if (!nom) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 })

    const existant = await prisma.entite.findUnique({ where: { code } })
    if (existant) return NextResponse.json({ error: `Le code "${code}" existe déjà.` }, { status: 400 })

    const entite = await prisma.entite.create({
      data: {
        code,
        nom,
        type: type || 'MAISON_MERE',
        localisation: localisation || '-',
        active: true,
      },
      select: {
        id: true,
        code: true,
        nom: true,
        type: true,
        localisation: true,
        active: true,
      },
    })

    return NextResponse.json(entite)
  } catch (e) {
    console.error('POST /api/entites:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
