import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/require-role'
import { MODES_INSTALLATION } from '@/lib/enums-commerce'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const p = await prisma.parametre.findFirst()
  return NextResponse.json({ modeInstallation: p?.modeInstallation || 'MODE_1' })
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requireRole(session, ['SUPER_ADMIN', 'ADMIN'])
  if (forbidden) return forbidden

  const { modeInstallation } = await request.json()
  if (!modeInstallation || !MODES_INSTALLATION.includes(modeInstallation)) {
    return NextResponse.json({ error: 'Mode d\'installation invalide' }, { status: 400 })
  }

  const p = await prisma.parametre.findFirst()
  if (!p) {
    await prisma.parametre.create({ data: { modeInstallation } })
  } else {
    await prisma.parametre.update({ where: { id: p.id }, data: { modeInstallation } })
  }

  return NextResponse.json({ modeInstallation })
}
