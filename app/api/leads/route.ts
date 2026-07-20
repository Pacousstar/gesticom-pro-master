import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
  const { searchParams } = new URL(request.url)
  const statut = searchParams.get('statut')
  const source = searchParams.get('source')

  const where: any = { entiteId }
  if (statut) where.statut = statut
  if (source) where.source = source

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(leads)
}

export async function POST(request: NextRequest) {
  const session = await getSession()

  const body = await request.json().catch(() => ({}))
  const { nom, email, contact, domaine, message, source } = body

  if (!nom || !nom.trim()) {
    return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 })
  }

  const entiteId = session ? await getEntiteId(session) : 1

  const lead = await prisma.lead.create({
    data: {
      nom: nom.trim(),
      email: email?.trim() || null,
      contact: contact?.trim() || null,
      domaine: domaine?.trim() || null,
      message: message?.trim() || null,
      source: source || 'preinscription',
      entiteId,
    },
  })

  return NextResponse.json(lead)
}

export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { id, statut, notes, relance } = body

  if (!id) return NextResponse.json({ error: 'ID requis.' }, { status: 400 })

  const data: any = {}
  if (statut) data.statut = statut
  if (notes !== undefined) data.notes = notes
  if (relance !== undefined) {
    data.relance = relance
    data.relanceAt = relance ? new Date() : null
  }

  const lead = await prisma.lead.update({
    where: { id: Number(id) },
    data,
  })

  return NextResponse.json(lead)
}
