import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  return NextResponse.json({
    userId: session.userId,
    login: session.login,
    nom: session.nom,
    role: session.role,
    entiteId: session.entiteId,
    permissions: session.permissions,
  })
}
