import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { requireRole, ROLES_ADMIN } from '@/lib/require-role'
import { initialiserComptabilite } from '@/lib/comptabilisation'

/**
 * POST /api/comptabilite/init — Initialise le plan de comptes et les journaux par défaut
 */
export async function POST() {
  const session = await getSession()
  const forbidden = requireRole(session, ROLES_ADMIN)
  if (forbidden) return forbidden

  try {
    await initialiserComptabilite()
    return NextResponse.json({ 
      success: true, 
      message: 'Plan de comptes et journaux initialisés avec succès.' 
    })
  } catch (e) {
    console.error('POST /api/comptabilite/init:', e)
    const errorMsg = e instanceof Error ? e.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: 'Erreur lors de l\'initialisation.', details: errorMsg },
      { status: 500 }
    )
  }
}
