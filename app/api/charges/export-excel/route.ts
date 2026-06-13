import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'charges:view')
  if (authError) return authError

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()
    const rubriqueParam = request.nextUrl.searchParams.get('rubrique')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()

    const where: any = {}
    
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.entiteId = session.entiteId
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (typeParam && ['FIXE', 'VARIABLE'].includes(typeParam)) {
      where.type = typeParam
    }

    if (rubriqueParam) {
      where.rubrique = rubriqueParam
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) {
        where.magasinId = magId
      }
    }

    const charges = await prisma.charge.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const data: any[] = charges.map((c) => ({
      Date: new Date(c.date).toLocaleDateString('fr-FR'),
      Rubrique: c.rubrique,
      Magasin: c.magasin ? `${c.magasin.code} - ${c.magasin.nom}` : '—',
      Montant: c.montant,
      Observation: c.observation || '',
      Utilisateur: c.utilisateur.nom,
    }))

    const totalMontant = charges.reduce((s, c) => s + c.montant, 0)
    data.push(
      { Date: '', Rubrique: '', Magasin: '', Montant: '', Observation: '', Utilisateur: '' },
      { Date: '', Rubrique: '', Magasin: '', Montant: '', Observation: '', Utilisateur: '' },
      { Date: 'Total', Rubrique: '', Magasin: '', Montant: totalMontant, Observation: '', Utilisateur: '' },
    )

    const buf = await rowsToBuffer(data as any[], 'Charges')
    const filename = `charges-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('GET /api/charges/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
