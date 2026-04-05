import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const entite = await prisma.entite.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        nom: true,
        type: true,
        localisation: true,
        active: true,
      },
    })

    if (!entite) {
      return NextResponse.json({ error: 'Entité introuvable.' }, { status: 404 })
    }

    return NextResponse.json(entite)
  } catch (e) {
    console.error('GET /api/entites/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  const authError = requireRole(session, [...ROLES_ADMIN])
  if (authError) return authError

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    const body = await request.json()
    const code = body?.code?.trim().toUpperCase()
    const nom = body?.nom?.trim()
    const type = body?.type?.trim()
    const localisation = body?.localisation?.trim()
    const active = body?.active

    if (!code || !nom || !type) {
      return NextResponse.json({ error: 'Code, nom et type requis.' }, { status: 400 })
    }

    // Vérifier si le code existe déjà pour une autre entité
    const existant = await prisma.entite.findFirst({
      where: { code, id: { not: id } },
    })
    if (existant) {
      return NextResponse.json({ error: `Le code "${code}" existe déjà.` }, { status: 400 })
    }

    const entite = await prisma.entite.update({
      where: { id },
      data: {
        code,
        nom,
        type,
        localisation: localisation || '-',
        active: active !== undefined ? active : true,
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
    console.error('PATCH /api/entites/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Seul un SUPER_ADMIN peut supprimer une entité.' }, { status: 403 })
  }

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
    }

    // Vérifier s'il y a des utilisateurs ou magasins liés
    const [utilisateurs, magasins] = await Promise.all([
      prisma.utilisateur.count({ where: { entiteId: id } }),
      prisma.magasin.count({ where: { entiteId: id } }),
    ])

    if (utilisateurs > 0 || magasins > 0) {
      return NextResponse.json({
        error: `Impossible de supprimer cette entité : ${utilisateurs} utilisateur(s) et ${magasins} magasin(s) y sont liés.`,
      }, { status: 400 })
    }

    await prisma.entite.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/entites/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
