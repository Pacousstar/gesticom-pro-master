import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { prisma } from '@/lib/db'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: {
      magasin: { select: { id: true, code: true, nom: true } },
      entite: { select: { id: true, code: true, nom: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  if (!charge) {
    return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })
  }

  // Sécurité Multi-Entité
  const entiteId = await getEntiteId(session)
  if (session.role !== 'SUPER_ADMIN' && charge.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  return NextResponse.json(charge)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const oldCharge = await prisma.charge.findUnique({ where: { id } })
    if (!oldCharge) return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })
    
    // Sécurité Multi-Entité
    if (session.role !== 'SUPER_ADMIN' && oldCharge.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    const body = await request.json()
    const updateData: {
      date?: Date
      magasinId?: number | null
      type?: string
      rubrique?: string
      beneficiaire?: string | null
      montant?: number
      observation?: string | null
    } = {}

    if (body.date) updateData.date = new Date(body.date)
    if (body.beneficiaire !== undefined) {
      updateData.beneficiaire = body.beneficiaire ? String(body.beneficiaire).trim() : null
    }
    if (body.magasinId !== undefined) {
      updateData.magasinId = body.magasinId != null ? Number(body.magasinId) : null
      if (updateData.magasinId != null) {
        const magasin = await prisma.magasin.findUnique({ where: { id: updateData.magasinId } })
        if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      }
    }
    if (body.type && ['FIXE', 'VARIABLE'].includes(String(body.type).toUpperCase())) {
      updateData.type = String(body.type).toUpperCase()
    }
    if (body.rubrique != null) updateData.rubrique = String(body.rubrique).trim()
    if (body.montant != null) updateData.montant = Math.max(0, Number(body.montant))
    if (body.observation !== undefined) updateData.observation = body.observation ? String(body.observation).trim() : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const charge = await prisma.charge.update({
      where: { id },
      data: updateData,
      include: {
        magasin: { select: { code: true, nom: true } },
        entite: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(charge)
  } catch (e) {
    console.error('PATCH /api/charges/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  // Note: Autorisation étendue aux ADMIN pour suppression "à souhait"
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Droits insuffisants pour supprimer une charge.' }, { status: 403 })
  }

  try {
    const id = Number((await params).id)
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const charge = await prisma.charge.findUnique({ where: { id } })
    if (!charge) return NextResponse.json({ error: 'Charge introuvable.' }, { status: 404 })

    // Sécurité Multi-Entité
    if (session.role !== 'SUPER_ADMIN' && charge.entiteId !== entiteId) {
       return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    await deleteEcrituresByReference('CHARGE', id)
    await prisma.charge.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/charges/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
