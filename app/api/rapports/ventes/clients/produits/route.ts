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
        const clientId = searchParams.get('clientId')

        const where: any = { vente: { statut: { in: ['VALIDE', 'VALIDEE'] } } }
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.vente.date = { gte: new Date(start), lte: endDate }
        }
        if (clientId) {
            where.vente.clientId = parseInt(clientId)
        }

        const ventesLignes = await prisma.venteLigne.groupBy({
            by: ['produitId', 'designation'],
            where,
            _sum: { quantite: true, montant: true }
        })

        const data = ventesLignes.map(v => ({
            produit: v.designation,
            quantiteVendue: v._sum.quantite || 0,
            chiffreAffaires: v._sum.montant || 0,
        })).sort((a, b) => b.chiffreAffaires - a.chiffreAffaires)

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API produits par client:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
