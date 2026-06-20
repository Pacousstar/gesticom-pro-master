import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const preferencesSchema = z.object({
  widgets: z.any().optional(),
  periode: z.string().max(10).optional().default('30'),
})

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'dashboard:view')
  if (authError) return authError

  try {
    const preference = await prisma.dashboardPreference.findUnique({
      where: { utilisateurId: session.userId },
    })

    if (!preference) {
      return NextResponse.json({ widgets: null, periode: '30' })
    }

    let widgets = null
    if (preference.widgets) {
      try {
        widgets = JSON.parse(preference.widgets)
      } catch (e) {
        await apiCatch(e, 'api/dashboard/preferences')
        widgets = null
      }
    }

    return NextResponse.json({
      widgets,
      periode: preference.periode || '30',
    })
  } catch (e) {
    await apiCatch(e, 'api/dashboard/preferences')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'dashboard:view')
  if (authError) return authError

  try {
    const body = await request.json()
    const validation = validateApiRequest(preferencesSchema, body)
    if (!validation.success) return validation.response
    const data = validation.data
    const widgetsInput = data.widgets
    const periode = data.periode

    const preference = await prisma.dashboardPreference.upsert({
      where: { utilisateurId: session.userId },
      update: {
        widgets: widgetsInput ? JSON.stringify(widgetsInput) : null,
        periode: periode || '30',
      },
      create: {
        utilisateurId: session.userId,
        widgets: widgetsInput ? JSON.stringify(widgetsInput) : null,
        periode: periode || '30',
      },
    })

    let widgets = null
    if (preference.widgets) {
      try {
        widgets = JSON.parse(preference.widgets)
      } catch (e) {
        await apiCatch(e, 'api/dashboard/preferences')
        widgets = null
      }
    }
    
    return NextResponse.json({
      widgets,
      periode: preference.periode || '30',
    })
  } catch (e) {
    await apiCatch(e, 'api/dashboard/preferences')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
