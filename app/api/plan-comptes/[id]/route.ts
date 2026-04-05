import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const compte = await prisma.planCompte.findUnique({ where: { id } })
  if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 })
  return NextResponse.json(compte)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    
    if (body?.numero != null) data.numero = String(body.numero).trim()
    if (body?.libelle != null) data.libelle = String(body.libelle).trim()
    if (body?.classe != null) data.classe = String(body.classe).trim()
    if (body?.type != null && ['ACTIF', 'PASSIF', 'CHARGES', 'PRODUITS'].includes(String(body.type).toUpperCase())) {
      data.type = String(body.type).toUpperCase()
    }
    if (body?.actif !== undefined) data.actif = Boolean(body.actif)

    const compte = await prisma.planCompte.update({ where: { id }, data: data as object })
    return NextResponse.json(compte)
  } catch (e: any) {
    console.error('PATCH /api/plan-comptes/[id]:', e)
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  try {
    await prisma.planCompte.update({ where: { id }, data: { actif: false } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/plan-comptes/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
