import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const { id } = await request.json()
    
    if (id) {
      await prisma.systemAlerte.update({
        where: { id },
        data: { lu: true }
      })
    } else {
      // Marquer tout comme lu pour l'entité
      await prisma.systemAlerte.updateMany({
        where: { entiteId: session.entiteId || 1, lu: false },
        data: { lu: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur Marquage Notifications:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
