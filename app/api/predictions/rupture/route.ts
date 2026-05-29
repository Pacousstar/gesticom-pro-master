import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(req: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const authError = requirePermission(session, 'stocks:view')
    if (authError) return authError

    const entiteId = await getEntiteId(session)
    if (!entiteId || entiteId <= 0) {
      console.warn('[predictions] Aucune entité valide trouvée')
      return NextResponse.json({ error: 'Aucune entité associée à cet utilisateur' }, { status: 403 })
    }
    const entiteCondition = { entiteId }

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // 1. Obtenir les ventes des 30 derniers jours par produit (filtré par entité)
        const ventesGroups = await prisma.venteLigne.groupBy({
            by: ['produitId'],
            _sum: {
                quantite: true,
            },
            where: {
                vente: {
                    date: {
                        gte: thirtyDaysAgo,
                    },
                    statut: 'VALIDEE',
                    ...entiteCondition,
                },
            },
        })

        const produitIdsAvecVentes = ventesGroups.map(v => v.produitId)

        // 2. Récupérer uniquement les produits qui ont eu des ventes OU qui sont en stock
        // Cela réduit drastiquement la charge pour les gros catalogues (filtré par entité)
        const produits = await prisma.produit.findMany({
            where: {
                actif: true,
                entiteId: entiteId || undefined,
                OR: [
                    { id: { in: produitIdsAvecVentes } },
                    { stocks: { some: { quantite: { gt: 0 }, ...entiteCondition } } }
                ]
            },
            include: {
                stocks: {
                    where: entiteCondition
                },
            }
        })

        const predictions = produits.map((p) => {
            const stockTotal = p.stocks.reduce((sum, s) => sum + s.quantite, 0)
            const ventesModule = ventesGroups.find((v) => v.produitId === p.id)
            const totalVenduSur30j = ventesModule?._sum.quantite || 0

            const velociteJour = totalVenduSur30j / 30

            let joursRestants = -1
            if (velociteJour > 0) {
                joursRestants = Math.floor(stockTotal / velociteJour)
            } else if (stockTotal === 0) {
                joursRestants = 0
            }

            return {
                produitId: p.id,
                code: p.code,
                designation: p.designation,
                stockTotal,
                velociteJour,
                joursRestants,
            }
        }).filter(p => p.joursRestants !== -1 && p.joursRestants <= 14)
            .sort((a, b) => a.joursRestants - b.joursRestants)

        return NextResponse.json(predictions, {
          headers: { 'Cache-Control': 'no-store, max-age=0' },
        })
    } catch (error: any) {
        console.error('❌ Erreur API predictions rupture:', error.message, error.stack)
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
    }
}
