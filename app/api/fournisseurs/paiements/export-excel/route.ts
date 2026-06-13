import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'fournisseurs:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  const where: any = {}

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.achat = { entiteId: session.entiteId }
  } else if(entiteId) {
      where.achat = { entiteId }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  try {
    const paiements = await prisma.reglementAchat.findMany({
      where,
      take: 10000,
      include: {
        fournisseur: { select: { nom: true } },
        achat: { select: { numero: true } },
      },
      orderBy: { date: 'desc' },
    })

    const rows: any[] = []
    let totalMontant = 0

    for (const p of paiements) {
      totalMontant += p.montant
      rows.push({
        Date: p.date.toISOString().slice(0, 10),
        Fournisseur: p.fournisseur?.nom || '—',
        Mode: p.modePaiement,
        Référence: p.achat?.numero || p.observation || 'Règlement Compte',
        Montant: p.montant
      })
    }

    if (rows.length > 0) {
      rows.push({
        Date: 'TOTAL',
        Fournisseur: '',
        Mode: '',
        Référence: '',
        Montant: totalMontant
      })
    }

    const buf = await rowsToBuffer(rows as any[], 'Paiements Fournisseurs')
    const filename = `paiements_fournisseurs_${dateDebut || 'init'}_${dateFin || 'fin'}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('Export Excel Paiements Fournisseurs:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
