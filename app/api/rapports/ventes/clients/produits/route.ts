import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Vérification de la permission
    if (session.role !== 'SUPER_ADMIN' && (!session.permissions || !session.permissions.includes('rapports:view'))) {
        return NextResponse.json({ error: 'Permission insuffisante' }, { status: 403 })
    }

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')
        const clientId = searchParams.get('clientId')

        const where: any = { vente: { statut: 'VALIDEE' } }
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
