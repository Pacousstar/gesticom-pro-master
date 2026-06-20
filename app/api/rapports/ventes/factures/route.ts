import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    
    const forbidden = requirePermission(session, 'rapports:view')
    if (forbidden) return forbidden

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start') ?? searchParams.get('dateDebut')
        const end = searchParams.get('end') ?? searchParams.get('dateFin')
        const clientId = searchParams.get('clientId')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

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
        if (clientId) {
            where.clientId = parseInt(clientId)
        }

        const [ventes, total] = await Promise.all([
            prisma.vente.findMany({
                where,
                include: {
                    client: { select: { nom: true, code: true } },
                    reglements: { select: { id: true, modePaiement: true } },
                    ReglementVenteLigne: { select: { reglementId: true, montant: true } },
                },
                orderBy: { date: 'desc' },
                skip,
                take: limit
            }),
            prisma.vente.count({ where })
        ])

        const data = ventes.map(v => {
            const creditReglementIds = new Set(
                (v.reglements || [])
                    .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
                    .map(r => r.id)
            )
            const totalLignePaye = (v.ReglementVenteLigne || [])
                .filter(l => !creditReglementIds.has(l.reglementId))
                .reduce((s, l) => s + (l.montant || 0), 0)
            const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (v.montantPaye || 0)

            return {
                id: v.id,
                numero: v.numero,
                date: v.date,
                client: v.client?.nom || v.clientLibre || 'Client Comptoir',
                clientCode: v.client?.code || null,
                montantTotal: v.montantTotal,
                montantPaye: realMontantPaye,
                resteAPayer: Math.max(0, (v.montantTotal || 0) - realMontantPaye),
                statutPaiement: v.statutPaiement
            }
        })

        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        await apiCatch(error, 'api/rapports/ventes/factures')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
