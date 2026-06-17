import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { compteCourantId, transactionId } = body
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

  const existing = await prisma.ecritureComptable.findFirst({
    where: { referenceType: 'LETTRAGE_CC', referenceId: regId, reference: String(compteCourantId) },
  })
  if (existing) {
    return NextResponse.json({ message: 'Déjà lettré.' })
  }

  await prisma.ecritureComptable.create({
    data: {
      date: new Date(),
      libelle: `Lettrage règlement #${regId} - Compte courant #${compteCourantId}`,
      debit: 0,
      credit: 0,
      referenceType: 'LETTRAGE_CC',
      referenceId: regId,
      reference: String(compteCourantId),
    },
  })

  return NextResponse.json({ success: true, message: 'Transaction lettrée avec succès.' })
}
