import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { planCompteSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
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
  } catch (e) {
    await apiCatch(e, 'api/plan-comptes')
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
    const result = validateApiRequest(planCompteSchema, body)
    if (!result.success) return result.response
    const data = result.data

    const compte = await prisma.planCompte.create({
      data: { numero: data.numero, libelle: data.libelle, classe: data.classe, type: data.type, actif: true },
    })

    return NextResponse.json(compte)
  } catch (e: any) {
    await apiCatch(e, 'api/plan-comptes')
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
