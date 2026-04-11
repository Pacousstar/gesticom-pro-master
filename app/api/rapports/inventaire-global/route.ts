import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    try {
        const searchParams = request.nextUrl.searchParams
        const entiteId = await getEntiteId(session)
        const whereBase: any = {}

        // Filtrage par entité (support SUPER_ADMIN)
        if (session.role === 'SUPER_ADMIN') {
            const entiteIdFromParams = searchParams.get('entiteId')?.trim()
            if (entiteIdFromParams) {
                whereBase.entiteId = Number(entiteIdFromParams)
            } else if (entiteId > 0) {
                whereBase.entiteId = entiteId
            }
        } else if (entiteId > 0) {
            whereBase.entiteId = entiteId
        }

        const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
        const date = new Date(dateStr)
        const start = new Date(dateStr + 'T00:00:00')
        const end = new Date(dateStr + 'T23:59:59')

        const wherePeriode = { ...whereBase, date: { gte: start, lte: end } }

        // 1. Ventes par mode de paiement
        const ventesParMode = await prisma.vente.groupBy({
            by: ['modePaiement'],
            where: { ...wherePeriode, statut: 'VALIDEE' },
            _sum: { montantTotal: true, montantPaye: true }
        })

        // 2. Mouvements de stock valorisés
        const mouvements = await prisma.mouvement.findMany({
            where: wherePeriode,
            include: {
                produit: { select: { designation: true, prixAchat: true, pamp: true, prixVente: true } }
            }
        })

        const stockEntree = mouvements.filter(m => m.type === 'ENTREE').reduce((acc, m) => {
            const prixRevient = m.produit.pamp && m.produit.pamp > 0 ? m.produit.pamp : (m.produit.prixAchat || 0)
            return acc + (m.quantite * prixRevient)
        }, 0)
        const stockSortie = mouvements.filter(m => m.type === 'SORTIE').reduce((acc, m) => acc + (m.quantite * (m.produit.prixVente || 0)), 0)

        // 3. Synthèse Trésorerie (Caisse / Banque)
        const transactionsCaisse = await prisma.caisse.groupBy({
            by: ['type'],
            where: wherePeriode,
            _sum: { montant: true }
        })

        return NextResponse.json({
            date: dateStr,
            ventes: ventesParMode.map(v => ({
                mode: v.modePaiement,
                total: v._sum.montantTotal || 0,
                encaisse: v._sum.montantPaye || 0,
                credit: (v._sum.montantTotal || 0) - (v._sum.montantPaye || 0)
            })),
            stock: {
                valeurEntree: stockEntree,
                valeurSortie: stockSortie,
                nbMouvements: mouvements.length
            },
            tresorerie: {
                entrees: transactionsCaisse.find(t => t.type === 'ENTREE')?._sum.montant || 0,
                sorties: transactionsCaisse.find(t => t.type === 'SORTIE')?._sum.montant || 0
            }
        })
    } catch (error) {
        console.error('Erreur API inventaire journalier:', error)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
