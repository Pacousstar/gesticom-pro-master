import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        const where: any = { statut: 'VALIDEE' }
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const utilisateurs = await prisma.utilisateur.findMany({ select: { id: true, nom: true } })
        const userMap = new Map(utilisateurs.map(u => [u.id, u.nom]))

        const ventes = await prisma.vente.groupBy({
            by: ['utilisateurId'],
            where,
            _sum: { montantTotal: true },
            _count: { id: true }
        })

        const data = ventes.map(v => ({
            vendeur: userMap.get(v.utilisateurId) || 'Inconnu',
            chiffreAffaires: v._sum.montantTotal || 0,
            nombreVentes: v._count.id,
            panierMoyen: v._count.id > 0 ? (v._sum.montantTotal || 0) / v._count.id : 0
        })).sort((a, b) => b.chiffreAffaires - (a.chiffreAffaires || 0))

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        console.error('Erreur API vendeurs:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
