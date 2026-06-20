import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:view')
  if (forbidden) return forbidden

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const clientId = request.nextUrl.searchParams.get('clientId')

  const where: any = {
    statut: { in: ['VALIDE', 'VALIDEE'] }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (clientId) {
    where.clientId = Number(clientId)
  }

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }

  try {
    const ventes = await prisma.vente.findMany({
      where,
      include: {
        client: { select: { nom: true, telephone: true, pointsFidelite: true } },
        reglements: { select: { id: true, modePaiement: true } },
        ReglementVenteLigne: { select: { reglementId: true, montant: true } },
      }
    })

    const groupMap = new Map<string, {
      clientId: number | null
      clientLibre: string | null
      nom: string
      telephone: string
      pointsFidelite: number
      nombreVentes: number
      caTotal: number
      totalPaye: number
    }>()

    for (const v of ventes) {
      const creditReglementIds = new Set(
        (v.reglements || [])
          .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
          .map(r => r.id)
      )
      const totalLignePaye = (v.ReglementVenteLigne || [])
        .filter(l => !creditReglementIds.has(l.reglementId))
        .reduce((s, l) => s + (l.montant || 0), 0)
      const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (v.montantPaye || 0)

      const key = v.clientId ? `c${v.clientId}` : `l${v.clientLibre || ''}`
      if (!groupMap.has(key)) {
        let nom = v.clientLibre || 'Client Divers'
        let telephone = ''
        let pointsFidelite = 0
        if (v.client) {
          nom = v.client.nom
          telephone = v.client.telephone || ''
          pointsFidelite = v.client.pointsFidelite || 0
        }
        groupMap.set(key, { clientId: v.clientId, clientLibre: v.clientLibre, nom, telephone, pointsFidelite, nombreVentes: 0, caTotal: 0, totalPaye: 0 })
      }
      const g = groupMap.get(key)!
      g.nombreVentes++
      g.caTotal += v.montantTotal || 0
      g.totalPaye += realMontantPaye
    }

    const detailedStats = Array.from(groupMap.values())
      .map(item => ({
        clientId: item.clientId,
        nom: item.nom,
        telephone: item.telephone,
        pointsFidelite: item.pointsFidelite,
        nombreVentes: item.nombreVentes,
        caTotal: item.caTotal,
        totalPaye: item.totalPaye,
        soldeDu: item.caTotal - item.totalPaye
      }))
      .sort((a, b) => b.caTotal - a.caTotal)

    return NextResponse.json(detailedStats)
  } catch (error) {
    await apiCatch(error, 'api/rapports/ventes/clients')
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
