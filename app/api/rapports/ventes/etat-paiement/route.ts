import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'rapports:view')
    if (forbidden) return forbidden

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start') ?? searchParams.get('dateDebut')
        const end = searchParams.get('end') ?? searchParams.get('dateFin')

        const entiteId = session.entiteId
        const where: any = { statut: { in: ['VALIDE', 'VALIDEE'] } }
        if (entiteId && session.role !== 'SUPER_ADMIN') {
            where.entiteId = entiteId
        }
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const clients = await prisma.client.findMany({ select: { id: true, code: true, nom: true, telephone: true } })
        const clientMap = new Map(clients.map(c => [c.id, c]))

        const ventes = await prisma.vente.findMany({
            where,
            include: {
                reglements: { select: { id: true, modePaiement: true } },
                ReglementVenteLigne: { select: { reglementId: true, montant: true } },
            }
        })

        const groupMap = new Map<string, { clientId: number | null; clientLibre: string | null; montantTotal: number; montantPaye: number; nombreVentes: number }>()

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
                groupMap.set(key, { clientId: v.clientId, clientLibre: v.clientLibre, montantTotal: 0, montantPaye: 0, nombreVentes: 0 })
            }
            const g = groupMap.get(key)!
            g.montantTotal += v.montantTotal || 0
            g.montantPaye += realMontantPaye
            g.nombreVentes++
        }

        const data = Array.from(groupMap.values()).map(v => {
            let nom = v.clientLibre || 'Client Comptoir'
            if (v.clientId && clientMap.has(v.clientId)) {
                nom = clientMap.get(v.clientId)!.nom
            }
            const total = v.montantTotal
            const paye = v.montantPaye
            return {
                clientId: v.clientId,
                client: nom,
                code: v.clientId && clientMap.has(v.clientId) ? clientMap.get(v.clientId)!.code : null,
                montantTotal: total,
                montantPaye: paye,
                resteAPayer: total - paye,
                nombreVentes: v.nombreVentes,
            }
        })

        const aggregated = Array.from(data.reduce((acc, curr) => {
            const existing = acc.get(curr.client)
            if (existing) {
                existing.montantTotal += curr.montantTotal
                existing.montantPaye += curr.montantPaye
                existing.resteAPayer += curr.resteAPayer
                existing.nombreVentes += curr.nombreVentes
            } else {
                acc.set(curr.client, { ...curr })
            }
            return acc
        }, new Map<string, typeof data[0]>()).values())

        aggregated.sort((a, b) => b.montantTotal - a.montantTotal)

        return NextResponse.json(aggregated, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API rapports paiement ventes:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
