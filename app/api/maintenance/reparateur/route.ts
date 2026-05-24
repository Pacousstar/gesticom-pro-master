import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { repairCaisseIntegrity, repairStockIntegrity, repairBankIntegrity } from '@/lib/repair'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const forbidden = requireRole(session, ['SUPER_ADMIN'])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => ({}))
    const repairCaisse = body?.caisse !== false
    const repairStock = body?.stock !== false
    const repairBank = body?.bank !== false

    const results: Record<string, any> = {}

    if (repairCaisse) {
      results.caissesReparees = await repairCaisseIntegrity()
    }
    if (repairStock) {
      results.stocksReparees = await repairStockIntegrity()
    }
    if (repairBank) {
      results.banquesReparees = await repairBankIntegrity()
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (error) {
    console.error('Reparateur Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la réparation.' }, { status: 500 })
  }
}