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

  const ecriture = await prisma.ecritureComptable.findUnique({
    where: { id },
    include: {
      journal: { select: { code: true, libelle: true } },
      compte: { select: { numero: true, libelle: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  if (!ecriture) return NextResponse.json({ error: 'Écriture introuvable.' }, { status: 404 })
  return NextResponse.json(ecriture)
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
    const updateData: {
      date?: Date
      journalId?: number
      piece?: string | null
      libelle?: string
      compteId?: number
      debit?: number
      credit?: number
      reference?: string | null
      referenceType?: string | null
      referenceId?: number | null
    } = {}

    if (body.date) updateData.date = new Date(body.date)
    if (body.journalId != null) {
      const jId = Number(body.journalId)
      if (Number.isInteger(jId) && jId > 0) {
        const journal = await prisma.journal.findUnique({ where: { id: jId } })
        if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 400 })
        updateData.journalId = jId
      }
    }
    if (body.piece !== undefined) updateData.piece = body.piece ? String(body.piece).trim() || null : null
    if (body.libelle != null) updateData.libelle = String(body.libelle).trim()
    if (body.compteId != null) {
      const cId = Number(body.compteId)
      if (Number.isInteger(cId) && cId > 0) {
        const compte = await prisma.planCompte.findUnique({ where: { id: cId } })
        if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 })
        updateData.compteId = cId
      }
    }
    if (body.debit != null) updateData.debit = Math.max(0, Number(body.debit))
    if (body.credit != null) updateData.credit = Math.max(0, Number(body.credit))

    // Validation : débit ou crédit doit être > 0, pas les deux
    if (updateData.debit !== undefined && updateData.credit !== undefined) {
      if (updateData.debit === 0 && updateData.credit === 0) {
        return NextResponse.json({ error: 'Débit ou crédit doit être supérieur à 0.' }, { status: 400 })
      }
      if (updateData.debit > 0 && updateData.credit > 0) {
        return NextResponse.json({ error: 'Une écriture ne peut avoir à la fois un débit et un crédit.' }, { status: 400 })
      }
    }

    if (body.reference !== undefined) updateData.reference = body.reference ? String(body.reference).trim() || null : null
    if (body.referenceType !== undefined) updateData.referenceType = body.referenceType ? String(body.referenceType).trim() || null : null
    if (body.referenceId !== undefined) updateData.referenceId = body.referenceId != null ? Number(body.referenceId) : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour.' }, { status: 400 })
    }

    const ecriture = await prisma.ecritureComptable.update({
      where: { id },
      data: updateData,
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(ecriture)
  } catch (e) {
    console.error('PATCH /api/ecritures/[id]:', e)
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
    await prisma.ecritureComptable.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/ecritures/[id]:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
