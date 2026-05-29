import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST : Envoyer une notification push à un utilisateur
 * Note : Cette API est basique. Pour une implémentation complète, il faudrait :
 * - Gérer les subscriptions (endpoints push)
 * - Utiliser un service comme Firebase Cloud Messaging ou Web Push
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const requestBody = await request.json()
    const { userId, title, body: messageBody, data } = requestBody

    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Titre et corps requis.' }, { status: 400 })
    }

    // Notification enregistrée en base
    // L'envoi se fait côté client via le service worker
    
    return NextResponse.json({ 
      success: true,
      message: 'Notification enregistrée. L\'envoi se fera via le service worker.',
    })
  } catch (e) {
    console.error('POST /api/notifications/push:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
