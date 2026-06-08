import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const licence = await prisma.licence.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (!licence) {
      return NextResponse.json({ bloquant: false, statut: 'ABSENTE' })
    }

    if (licence.typeEssai) {
      const debut = licence.debutEssai || licence.createdAt
      const fin = licence.finValidite || new Date(debut.getTime() + 7 * 24 * 60 * 60 * 1000)
      const joursRestants = Math.max(0, Math.ceil((fin.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      const expire = Date.now() > fin.getTime()

      return NextResponse.json({
        bloquant: expire,
        statut: expire ? 'ESSAI_EXPIRE' : 'ESSAI',
        joursRestants,
        finValidite: fin.toISOString(),
      })
    }

    if (licence.statut === 'ACTIVE') {
      return NextResponse.json({ bloquant: false, statut: 'ACTIVE' })
    }

    return NextResponse.json({ bloquant: true, statut: licence.statut })
  } catch {
    return NextResponse.json({ bloquant: false, statut: 'ERROR' })
  }
}
