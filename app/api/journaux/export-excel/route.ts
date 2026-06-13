import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:export')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    const where: { type?: string; entiteId?: number } = { entiteId }
    if (typeParam && ['ACHATS', 'VENTES', 'BANQUE', 'CAISSE', 'OD'].includes(typeParam)) {
      where.type = typeParam
    }

    const journaux = await prisma.journal.findMany({
      where,
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        libelle: true,
        type: true,
        actif: true,
      },
    })

    const rows: any[] = journaux.map((j) => ({
      Code: j.code,
      Libellé: j.libelle,
      Type: j.type,
      Statut: j.actif ? 'Actif' : 'Inactif',
    }))

    if (rows.length > 0) {
      rows.push({ Code: '', Libellé: '', Type: 'Total journaux', Statut: rows.length })
    }

    const buf = await rowsToBuffer(rows as any[], 'Journaux')
    const filename = `journaux_${new Date().toISOString().slice(0, 10)}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('Export Excel journaux:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
