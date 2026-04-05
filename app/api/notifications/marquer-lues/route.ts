import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// Les notifications sont générées dynamiquement (pas de table dédiée).
// Cet endpoint retourne simplement un succès — la logique "lu" est gérée
// côté client via localStorage pour éviter une migration de base.
export async function PATCH() {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    return NextResponse.json({ success: true, message: 'Notifications marquées comme lues.' })
}
