import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const tous = request.nextUrl.searchParams.get('tous') === '1'
  const where: { actif?: boolean; entiteId?: number } = {}
  
  if (!tous) {
    where.actif = true
  }
  
  // Filtrer par entité de la session (sauf SUPER_ADMIN qui voit tout)
  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)

    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    const nom = String(body?.nom ?? '').trim()
    const localisation = String(body?.localisation ?? '').trim()

    if (!code) return NextResponse.json({ error: 'Code requis.' }, { status: 400 })
    if (!nom) return NextResponse.json({ error: 'Nom requis.' }, { status: 400 })

    const existant = await prisma.magasin.findUnique({ where: { code } })
    if (existant) return NextResponse.json({ error: `Le code "${code}" existe déjà.` }, { status: 400 })

    const magasin = await prisma.magasin.create({
        data: { code, nom, localisation: localisation || '-', entiteId: entiteId, actif: true },
      select: { id: true, code: true, nom: true, localisation: true, actif: true },
    })
    return NextResponse.json(magasin)
  } catch (e) {
    console.error('POST /api/magasins:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
