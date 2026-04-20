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
        const fournisseurId = searchParams.get('fournisseurId')

        const where: any = { achat: { statut: 'VALIDEE' } }
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.achat.date = { gte: new Date(start), lte: endDate }
        }
        if (fournisseurId) {
            where.achat.fournisseurId = parseInt(fournisseurId)
        }

        const achatsLignes = await prisma.achatLigne.groupBy({
            by: ['produitId', 'designation'],
            where,
            _sum: { quantite: true, montant: true }
        })

        const data = achatsLignes.map(a => ({
            produit: a.designation,
            quantiteAchetee: a._sum.quantite || 0,
            montantAchat: a._sum.montant || 0,
        })).sort((a, b) => b.montantAchat - a.montantAchat)

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API produits par fournisseur:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
