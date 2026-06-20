import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const marquerLuesSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'notifications:write')
  if (authError) return authError

  try {
    const body = await request.json()
    const validation = validateApiRequest(marquerLuesSchema, body)
    if (!validation.success) return validation.response
    const { id } = validation.data
    
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
    await apiCatch(error, 'api/notifications/marquer-lues')
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
