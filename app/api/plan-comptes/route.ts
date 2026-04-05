import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const classe = request.nextUrl.searchParams.get('classe')?.trim()
  const type = request.nextUrl.searchParams.get('type')?.trim()

  const where: {
    actif?: boolean
    classe?: string
    type?: string
    OR?: Array<{ numero?: { contains: string }; libelle?: { contains: string } }>
  } = { actif: true }

  if (classe) where.classe = classe
  if (type) where.type = type

  if (q) {
    where.OR = [
      { numero: { contains: q } },
      { libelle: { contains: q } },
    ]
  }

  const comptes = await prisma.planCompte.findMany({
    where,
    orderBy: [{ classe: 'asc' }, { numero: 'asc' }],
  })

  return NextResponse.json(comptes)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const numero = String(body?.numero || '').trim()
    const libelle = String(body?.libelle || '').trim()
    const classe = String(body?.classe || '').trim()
    const type = ['ACTIF', 'PASSIF', 'CHARGES', 'PRODUITS'].includes(String(body?.type || '').toUpperCase())
      ? String(body.type).toUpperCase()
      : 'CHARGES'

    if (!numero || !libelle || !classe) {
      return NextResponse.json({ error: 'Numéro, libellé et classe requis.' }, { status: 400 })
    }

    const compte = await prisma.planCompte.create({
      data: { numero, libelle, classe, type, actif: true },
    })

    return NextResponse.json(compte)
  } catch (e: any) {
    console.error('POST /api/plan-comptes:', e)
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
