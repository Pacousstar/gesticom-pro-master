import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const type = request.nextUrl.searchParams.get('type')
    const where = type ? { type, actif: true } : { actif: true }
    
    const templates = await prisma.printTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (e) {
    console.error('GET /api/print-templates:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const body = await request.json()
    const { type, nom, logo, enTete, piedDePage, variables, actif } = body

    if (!type || !nom) {
      return NextResponse.json({ error: 'Type et nom requis.' }, { status: 400 })
    }

    const template = await prisma.printTemplate.create({
      data: {
        type,
        nom,
        logo: logo || null,
        enTete: enTete || null,
        piedDePage: piedDePage || null,
        variables: variables ? JSON.stringify(variables) : null,
        actif: actif !== false,
      },
    })

    return NextResponse.json(template)
  } catch (e) {
    console.error('POST /api/print-templates:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
