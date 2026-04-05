import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getProduitsEnAlerte } from '@/lib/intelligence'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  try {
    const alertes = await getProduitsEnAlerte()
    return NextResponse.json(alertes)
  } catch (e) {
    console.error('API Alertes Stock:', e)
    return NextResponse.json({ error: 'Erreur lors de la récupération des alertes' }, { status: 500 })
  }
}
