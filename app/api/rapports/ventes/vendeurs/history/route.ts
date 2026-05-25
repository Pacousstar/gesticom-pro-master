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
        const vendeur = searchParams.get('vendeur')
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        if (!vendeur) {
            return NextResponse.json({ error: 'Paramètre vendeur requis' }, { status: 400 })
        }

        const where: any = { statut: { in: ['VALIDEE', 'VALIDE'] } }

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
            }
        })

        return NextResponse.json(ventes, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API historique vendeur:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
