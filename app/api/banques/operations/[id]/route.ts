import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { deleteEcrituresByReference } from '@/lib/delete-ecritures'
import { verifierCloture } from '@/lib/cloture'
import { estTypeOperationBanqueEntree } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  const op = await prisma.operationBancaire.findUnique({
    where: { id },
    include: {
      banque: { select: { id: true, numero: true, nomBanque: true, libelle: true, entiteId: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })
  if (!op) return NextResponse.json({ error: 'Opération bancaire introuvable.' }, { status: 404 })

  if (session.role !== 'SUPER_ADMIN') {
    const entiteId = await getEntiteId(session)
    if (op.banque.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }
  }

  return NextResponse.json(op)
}

/** Suppression définitive (Super Admin uniquement). Supprime les écritures comptables et recalcule le solde du compte. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Seul le Super Administrateur ou l\'Administrateur peut supprimer une opération bancaire.' }, { status: 403 })
  }

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Id invalide.' }, { status: 400 })
  }

  try {
    const op = await prisma.operationBancaire.findUnique({
      where: { id },
      include: { banque: true },
    })
    if (!op) return NextResponse.json({ error: 'Opération bancaire introuvable.' }, { status: 404 })

    // RB6: Vérifier la clôture comptable avant suppression
    await verifierCloture(op.date, session)

    // RB6: Encapsuler dans une transaction pour atomicité
    await prisma.$transaction(async (tx) => {
      await deleteEcrituresByReference('BANQUE', id, tx)

      const isEntree = estTypeOperationBanqueEntree(op.type)
      const reverse = isEntree ? -op.montant : op.montant

      await tx.banque.update({
        where: { id: op.banqueId },
        data: { soldeActuel: { increment: reverse } },
      })

      await tx.operationBancaire.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    await apiCatch(e, 'api/banques/operations/[id]')
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur.' }, { status: 500 })
  }
}