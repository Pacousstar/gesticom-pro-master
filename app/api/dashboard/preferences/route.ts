import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

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
        console.error('Erreur parse widgets:', e)
        widgets = null
      }
    }

    return NextResponse.json({
      widgets,
      periode: preference.periode || '30',
    })
  } catch (e) {
    console.error('GET /api/dashboard/preferences:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const { widgets: widgetsInput, periode } = body

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
        console.error('Erreur parse widgets:', e)
        widgets = null
      }
    }
    
    return NextResponse.json({
      widgets,
      periode: preference.periode || '30',
    })
  } catch (e) {
    console.error('POST /api/dashboard/preferences:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
