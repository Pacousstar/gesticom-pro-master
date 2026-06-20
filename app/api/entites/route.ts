import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { entiteSchema } from '@/lib/validations'

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
    await apiCatch(e, 'api/entites')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateApiRequest(entiteSchema, body)
    if (!result.success) return result.response
    const data = result.data

    const existant = await prisma.entite.findUnique({ where: { code: data.code } })
    if (existant) return NextResponse.json({ error: `Le code "${data.code}" existe déjà.` }, { status: 400 })

    const entite = await prisma.entite.create({
      data: {
        code: data.code,
        nom: data.nom,
        type: data.type,
        localisation: data.localisation,
        active: data.active ?? true,
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
    await apiCatch(e, 'api/entites')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
