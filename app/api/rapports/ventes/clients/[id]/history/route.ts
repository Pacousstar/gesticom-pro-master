import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'rapports:view')
    if (forbidden) return forbidden

    try {
        const id = (await params).id
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        const entiteId = session.entiteId
        const where: any = { statut: { in: ['VALIDEE', 'VALIDE'] } }
        if (entiteId && session.role !== 'SUPER_ADMIN') {
            where.entiteId = entiteId
        }
        if (id !== 'null' && id !== 'undefined') {
            where.clientId = Number(id)
        } else {
            return NextResponse.json({ error: 'ID Client requis pour l\'historique' }, { status: 400 })
        }

        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const ventes = await prisma.vente.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                magasin: { select: { nom: true } },
                lignes: {
                    include: {
                        produit: {
                            select: {
                                designation: true,
                                code: true
                            }
                        }
                    }
                },
                reglements: { select: { id: true, modePaiement: true } },
                ReglementVenteLigne: { select: { reglementId: true, montant: true } },
            }
        })

        const formatted = ventes.map(v => {
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
                ...v,
                montantPaye: realMontantPaye,
                reglements: undefined,
                ReglementVenteLigne: undefined,
            }
        })

        return NextResponse.json(formatted, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        await apiCatch(error, 'api/rapports/ventes/clients/[id]/history')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
