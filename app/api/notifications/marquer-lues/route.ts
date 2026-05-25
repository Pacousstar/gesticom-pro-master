import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'notifications:write')
  if (authError) return authError

  try {
    const { id } = await request.json()
    
    if (id) {
      await prisma.systemAlerte.updateMany({
        where: { id, entiteId: session.entiteId },
        data: { lu: true }
      })
    } else {
      await prisma.systemAlerte.updateMany({
        where: { entiteId: session.entiteId ?? 1, lu: false },
        data: { lu: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur Marquage Notifications:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
