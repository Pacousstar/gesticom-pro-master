import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'caisse:view')
  if (authError) return authError

  try {
    const entiteId = await getEntiteId(session)
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
    const typeParam = request.nextUrl.searchParams.get('type')?.trim()

    const where: any = {}

    // RC3 : Filtrage par entité pour empêcher la fuite de données multi-entité
    if (session.role === 'SUPER_ADMIN') {
      const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
      if (entiteIdFromParams) {
        where.magasin = { entiteId: Number(entiteIdFromParams) }
      } else if (entiteId > 0) {
        where.magasin = { entiteId }
      }
    } else if (entiteId > 0) {
      where.magasin = { entiteId }
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (magasinIdParam) {
      const magId = Number(magasinIdParam)
      if (Number.isInteger(magId) && magId > 0) where.magasinId = magId
    }

    if (typeParam && ['ENTREE', 'SORTIE'].includes(typeParam)) {
      where.type = typeParam
    }

    const operations = await prisma.caisse.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    const data = operations.map((op: any) => ({
      Date: new Date(op.date).toLocaleDateString('fr-FR'),
      Type: op.type === 'ENTREE' ? 'Entrée' : 'Sortie',
      Magasin: `${op.magasin.code} - ${op.magasin.nom}`,
      Motif: op.motif,
      Montant: op.montant,
      Utilisateur: op.utilisateur.nom,
    }))

    const totalEntree = operations
      .filter(op => op.type === 'ENTREE')
      .reduce((s, op) => s + op.montant, 0)
    const totalSortie = operations
      .filter(op => op.type === 'SORTIE')
      .reduce((s, op) => s + op.montant, 0)

    data.push(
      { Date: '', Type: '', Magasin: '', Motif: '', Montant: '', Utilisateur: '' },
      { Date: '', Type: '', Magasin: '', Motif: '', Montant: '', Utilisateur: '' },
      { Date: '', Type: 'Total entrées', Magasin: '', Motif: '', Montant: totalEntree, Utilisateur: '' },
      { Date: '', Type: 'Total sorties', Magasin: '', Motif: '', Montant: totalSortie, Utilisateur: '' },
    )

    const buf = await rowsToBuffer(data, 'Opérations caisse')
    const filename = `operations-caisse-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('GET /api/caisse/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}