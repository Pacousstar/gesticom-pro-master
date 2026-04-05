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

        const where: any = {}
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const fournisseurs = await prisma.fournisseur.findMany({ select: { id: true, code: true, nom: true, telephone: true } })
        const fournisseurMap = new Map(fournisseurs.map(f => [f.id, f]))

        const achatsFournisseurInfo = await prisma.achat.groupBy({
            by: ['fournisseurId', 'fournisseurLibre'],
            where,
            _sum: { montantTotal: true, montantPaye: true },
            _count: { id: true }
        })

        const data = achatsFournisseurInfo.map(a => {
            let nom = a.fournisseurLibre || 'Fournisseur Divers'
            if (a.fournisseurId && fournisseurMap.has(a.fournisseurId)) {
                nom = fournisseurMap.get(a.fournisseurId)!.nom
            }
            const total = a._sum.montantTotal || 0
            const paye = a._sum.montantPaye || 0
            return {
                fournisseurId: a.fournisseurId,
                fournisseur: nom,
                code: a.fournisseurId && fournisseurMap.has(a.fournisseurId) ? fournisseurMap.get(a.fournisseurId)!.code : null,
                montantTotal: total,
                montantPaye: paye,
                resteAPayer: total - paye,
                nbAchats: a._count.id,
            }
        })

        const aggregated = Array.from(data.reduce((acc, curr) => {
            const existing = acc.get(curr.fournisseur)
            if (existing) {
                existing.montantTotal += curr.montantTotal
                existing.montantPaye += curr.montantPaye
                existing.resteAPayer += curr.resteAPayer
                existing.nbAchats += curr.nbAchats
            } else {
                acc.set(curr.fournisseur, { ...curr })
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
        console.error('Erreur API rapports fournisseurs:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
