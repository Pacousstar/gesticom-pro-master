import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'archives:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    const list = await prisma.archiveSoldeClient.findMany({
      where: { entiteId },
      take: 10000,
      orderBy: { dateArchive: 'desc' },
      include: {
        client: { select: { nom: true } },
        utilisateur: { select: { nom: true } }
      }
    })
    
    const filtered = q
      ? list.filter(
          (a) =>
            (a.client?.nom || '').toLowerCase().includes(q) ||
            (a.clientLibre || '').toLowerCase().includes(q)
        )
      : list

    const data: any[] = filtered.map((a) => ({
      'Date Archive': new Date(a.dateArchive).toLocaleDateString('fr-FR'),
      'Client / Tiers': a.client?.nom || a.clientLibre || '—',
      'Montant (FCFA)': a.montant,
      'Opérateur': a.utilisateur?.nom || '—',
      'Observation': a.observation || ''
    }))

    const totalMontant = filtered.reduce((s, a) => s + a.montant, 0)
    data.push(
      { 'Date Archive': '', 'Client / Tiers': '', 'Montant (FCFA)': '', 'Opérateur': '', 'Observation': '' },
      { 'Date Archive': '', 'Client / Tiers': '', 'Montant (FCFA)': '', 'Opérateur': '', 'Observation': '' },
      { 'Date Archive': '', 'Client / Tiers': '', 'Montant (FCFA)': totalMontant, 'Opérateur': '', 'Observation': '' },
    )

    const buf = await rowsToBuffer(data as any[], 'Archives_Soldes')
    const filename = `archives-soldes-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/archives/clients/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
