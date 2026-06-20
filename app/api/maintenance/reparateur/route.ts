import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole } from '@/lib/require-role'
import { repairCaisseIntegrity, repairStockIntegrity, repairBankIntegrity } from '@/lib/repair'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const repairSchema = z.object({
  caisse: z.boolean().optional().default(true),
  stock: z.boolean().optional().default(true),
  bank: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const forbidden = requireRole(session, ['SUPER_ADMIN'])
  if (forbidden) return forbidden

  try {
    const body = await request.json().catch(() => ({}))
    const validation = validateApiRequest(repairSchema, body)
    if (!validation.success) return validation.response
    const { caisse: repairCaisse, stock: repairStock, bank: repairBank } = validation.data

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
    await apiCatch(error, 'api/maintenance/reparateur')
    return NextResponse.json({ error: 'Erreur lors de la réparation.' }, { status: 500 })
  }
}