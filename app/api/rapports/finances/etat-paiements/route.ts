import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  const type = request.nextUrl.searchParams.get('type') // 'ACHAT' ou 'VENTE'
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const filter = request.nextUrl.searchParams.get('filter') // 'TOUT', 'SOLDER', 'NON_SOLDER'

  const dateFilter = dateDebut && dateFin ? {
    gte: new Date(dateDebut + 'T00:00:00'),
    lte: new Date(dateFin + 'T23:59:59'),
  } : undefined

  if (type === 'ACHAT') {
    const forbidden = requirePermission(session, 'achats:view')
    if (forbidden) return forbidden

    const where: any = {
      date: dateFilter,
    }
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) where.entiteId = session.entiteId
    if (filter === 'NON_SOLDER') where.statutPaiement = { in: ['PARTIEL', 'CREDIT'] }
    if (filter === 'SOLDER') where.statutPaiement = 'PAYE'

    const achats = await prisma.achat.findMany({
      where,
      include: { fournisseur: { select: { nom: true } } },
      orderBy: { date: 'desc' }
    })
    
    return NextResponse.json(achats.map(a => ({
      id: a.id,
      numero: a.numero,
      date: a.date,
      tier: a.fournisseur?.nom || a.fournisseurLibre || 'Divers',
      montantTotal: a.montantTotal,
      montantPaye: a.montantPaye,
      solde: Math.max(0, (a.montantTotal || 0) - (a.montantPaye || 0)),
      statut: a.statutPaiement
    })))
  } else {
    // VENTES par défaut
    const forbidden = requirePermission(session, 'ventes:view')
    if (forbidden) return forbidden

    const where: any = {
      date: dateFilter,
      statut: { in: ['VALIDE', 'VALIDEE'] }
    }
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) where.entiteId = session.entiteId
    if (filter === 'NON_SOLDER') where.statutPaiement = { in: ['PARTIEL', 'CREDIT'] }
    if (filter === 'SOLDER') where.statutPaiement = 'PAYE'

    const ventes = await prisma.vente.findMany({
      where,
      include: { client: { select: { nom: true } } },
      orderBy: { date: 'desc' }
    })

    return NextResponse.json(ventes.map(v => ({
      id: v.id,
      numero: v.numero,
      date: v.date,
      tier: v.client?.nom || v.clientLibre || 'Divers',
      montantTotal: v.montantTotal,
      montantPaye: v.montantPaye,
      solde: v.montantTotal - (v.montantPaye || 0),
      statut: v.statutPaiement
    })))
  }
}
