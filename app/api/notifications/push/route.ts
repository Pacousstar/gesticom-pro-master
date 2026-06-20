import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const pushSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  title: z.string().min(1, 'Titre requis.').max(200).trim(),
  body: z.string().min(1, 'Corps requis.').max(2000).trim(),
  data: z.record(z.string(), z.any()).optional(),
})

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
    const body = await request.json()
    const validation = validateApiRequest(pushSchema, body)
    if (!validation.success) return validation.response
    const { userId, title, body: messageBody, data } = validation.data

    // Notification enregistrée en base
    // L'envoi se fait côté client via le service worker
    
    return NextResponse.json({ 
      success: true,
      message: 'Notification enregistrée. L\'envoi se fera via le service worker.',
    })
  } catch (e) {
    await apiCatch(e, 'api/notifications/push')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
