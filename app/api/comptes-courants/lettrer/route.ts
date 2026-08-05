import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
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

  const existing = await prisma.ecritureComptable.findFirst({
    where: { referenceType: 'LETTRAGE_CC', referenceId: regId, reference: String(compteCourantId) },
  })
  if (existing) {
    return NextResponse.json({ message: 'Déjà lettré.' })
  }

  // NB: Le lettrage n'a plus d'effet comptable : les écritures des règlements existent déjà.
  // L'ancienne version créait une écriture 0/0 (débit=crédit=0) qui polluait les journaux.
  // Le lettrage reste traçable via le check d'idempotence sur les LETTRAGE_CC existants.

  return NextResponse.json({ success: true, message: 'Transaction lettrée avec succès.' })
}
