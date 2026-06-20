import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { logModification, getIpAddress } from '@/lib/audit'
import { magasinSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'magasins:view')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  const tous = request.nextUrl.searchParams.get('tous') === '1'
  const entiteIdFilter = await getEntiteIdOrAll(session)
  const where: any = {}
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }
  
  if (!tous) {
    where.actif = true
  }
  
  const magasins = await prisma.magasin.findMany({
    where,
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nom: true, localisation: true, actif: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json(magasins)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  const authError = requirePermission(session, 'magasins:create')
  if (authError) return authError
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })

  try {
    const body = await request.json()

    const validation = validateApiRequest(magasinSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const entiteId = await getEntiteId(session)

    const code = v.code
    const nom = v.nom
    const localisation = v.localisation ?? ''

    const existant = await prisma.magasin.findFirst({ where: { code, entiteId } })
    if (existant) return NextResponse.json({ error: `Le code "${code}" existe déjà dans votre entité.` }, { status: 400 })

    const magasin = await prisma.magasin.create({
        data: { code, nom, localisation: localisation || '-', entiteId: entiteId, actif: true },
      select: { id: true, code: true, nom: true, localisation: true, actif: true },
    })

    await logModification(session, 'MAGASIN', magasin.id, `Création magasin: ${nom} (${code})`, {}, magasin, getIpAddress(request))

    return NextResponse.json(magasin)
  } catch (e) {
    await apiCatch(e, 'api/magasins')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
