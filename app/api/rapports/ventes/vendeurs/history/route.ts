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
        const vendeur = searchParams.get('vendeur')
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        if (!vendeur) {
            return NextResponse.json({ error: 'Paramètre vendeur requis' }, { status: 400 })
        }

        const entiteId = session.entiteId
        const where: any = { statut: { in: ['VALIDEE', 'VALIDE'] } }
        if (entiteId && session.role !== 'SUPER_ADMIN') {
            where.entiteId = entiteId
        }

        if (vendeur === 'Inconnu') {
            where.utilisateurId = null
        } else {
            const user = await prisma.utilisateur.findFirst({
                where: { nom: vendeur },
                select: { id: true }
            })
            if (!user) {
                return NextResponse.json({ error: 'Vendeur introuvable' }, { status: 404 })
            }
            where.utilisateurId = user.id
        }

        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const ventes = await prisma.vente.findMany({
            where,
            orderBy: { date: 'desc' },
            select: {
                id: true,
                numero: true,
                date: true,
                montantTotal: true,
                montantPaye: true,
                statutPaiement: true,
                modePaiement: true,
                client: { select: { nom: true } },
                clientLibre: true,
                magasin: { select: { nom: true } },
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
                id: v.id,
                numero: v.numero,
                date: v.date,
                montantTotal: v.montantTotal,
                montantPaye: realMontantPaye,
                statutPaiement: v.statutPaiement,
                modePaiement: v.modePaiement,
                client: v.client,
                clientLibre: v.clientLibre,
                magasin: v.magasin,
            }
        })

        return NextResponse.json(formatted, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        await apiCatch(error, 'api/rapports/ventes/vendeurs/history')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
