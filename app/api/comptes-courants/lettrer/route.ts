import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { validateApiRequest } from '@/lib/validation-helpers'
import { lettrageSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  const body = await request.json()
  const validation = validateApiRequest(lettrageSchema, body)
  if (!validation.success) return validation.response
  const { compteCourantId, transactionId } = validation.data
  if (!compteCourantId || !transactionId) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
  }

  const refType = transactionId.startsWith('REG-ACHAT-') ? 'REGLEMENT_ACHAT'
    : transactionId.startsWith('REG-VENTE-') ? 'REGLEMENT_VENTE'
    : null

  if (!refType) {
    return NextResponse.json({ error: 'Type de transaction non supporté pour le lettrage.' }, { status: 400 })
  }

  const regId = Number(transactionId.split('-').pop())
  if (!Number.isInteger(regId) || regId < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const entiteId = await getEntiteId(session)

  const existing = await prisma.ecritureComptable.findFirst({
    where: { referenceType: 'LETTRAGE_CC', referenceId: regId, reference: String(compteCourantId) },
  })
  if (existing) {
    return NextResponse.json({ message: 'Déjà lettré.' })
  }

  const journal = await prisma.journal.findFirst({ where: { code: 'OD' } })
  if (!journal) return NextResponse.json({ error: 'Journal OD introuvable.' }, { status: 500 })

  const compte = await prisma.planCompte.findFirst({ where: { numero: '455' } })
  if (!compte) return NextResponse.json({ error: 'Compte 455 introuvable.' }, { status: 500 })

  await prisma.ecritureComptable.create({
    data: {
      numero: `LETT-CC-${compteCourantId}-${Date.now()}`,
      date: new Date(),
      journalId: journal.id,
      compteId: compte.id,
      libelle: `Lettrage règlement #${regId} - Compte courant #${compteCourantId}`,
      debit: 0,
      credit: 0,
      referenceType: 'LETTRAGE_CC',
      referenceId: regId,
      reference: String(compteCourantId),
      utilisateurId: session.userId,
      entiteId,
    },
  })

  return NextResponse.json({ success: true, message: 'Transaction lettrée avec succès.' })
}
