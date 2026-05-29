import { prisma } from './db'

/**
 * Calcule l'autonomie restante d'un produit en jours
 * @param produitId ID du produit
 * @param entiteId ID de l'entité pour filtrer (optionnel)
 * @returns jours d'autonomie (Infinity si aucune vente)
 */
export async function calculerAutonomieStock(produitId: number, entiteId?: number): Promise<{
    stockActuel: number,
    vitesseVenteQuotidienne: number,
    joursRestants: number,
    enAlerte: boolean
}> {
    const joursAnalyse = 30
    const dateSeuil = new Date()
    dateSeuil.setDate(dateSeuil.getDate() - joursAnalyse)

    const whereStock: any = { produitId }
    if (entiteId) whereStock.entiteId = entiteId

    const stocks = await prisma.stock.findMany({
        where: whereStock
    })
    const stockActuel = stocks.reduce((acc, s) => acc + s.quantite, 0)

    const whereVente: any = {
        produitId,
        vente: {
            date: { gte: dateSeuil },
            statut: 'VALIDEE'
        }
    }
    if (entiteId) {
        whereVente.vente.entiteId = entiteId
    }

    const ventesLignes = await prisma.venteLigne.findMany({
        where: whereVente,
        select: { quantite: true }
    })

    const totalVendu = ventesLignes.reduce((acc, l) => acc + l.quantite, 0)
    const vitesseVenteQuotidienne = totalVendu / joursAnalyse

    let joursRestants = Infinity
    if (vitesseVenteQuotidienne > 0) {
        joursRestants = stockActuel / vitesseVenteQuotidienne
    }

    return {
        stockActuel,
        vitesseVenteQuotidienne,
        joursRestants: Math.round(joursRestants * 10) / 10,
        enAlerte: joursRestants <= 10 && vitesseVenteQuotidienne > 0
    }
}

/**
 * Récupère la liste des produits en risque de rupture
 */
export async function getProduitsEnAlerte(entiteId?: number) {
    const whereProduit: any = { actif: true }
    const produits = await prisma.produit.findMany({
        where: whereProduit,
        select: { id: true, designation: true, code: true }
    })

    const produitIds = produits.map(p => p.id)
    if (produitIds.length === 0) return []

    const stockWhere: any = { produitId: { in: produitIds } }
    if (entiteId) stockWhere.entiteId = entiteId

    const allStocks = await prisma.stock.groupBy({
        by: ['produitId'],
        where: stockWhere,
        _sum: { quantite: true }
    })

    const dateSeuil = new Date()
    dateSeuil.setDate(dateSeuil.getDate() - 30)

    const venteWhere: any = {
        produitId: { in: produitIds },
        vente: {
            date: { gte: dateSeuil },
            statut: 'VALIDEE'
        }
    }
    if (entiteId) {
        venteWhere.vente.entiteId = entiteId
    }

    const allVentes = await prisma.venteLigne.groupBy({
        by: ['produitId'],
        where: venteWhere,
        _sum: { quantite: true }
    })

    const stockMap = new Map(allStocks.map(s => [s.produitId, s._sum.quantite || 0]))
    const venteMap = new Map(allVentes.map(v => [v.produitId, v._sum.quantite || 0]))

    const alertes = []
    for (const p of produits) {
        const stockActuel = stockMap.get(p.id) || 0
        const totalVendu = venteMap.get(p.id) || 0
        const vitesseVenteQuotidienne = totalVendu / 30

        let joursRestants = Infinity
        if (vitesseVenteQuotidienne > 0) {
            joursRestants = stockActuel / vitesseVenteQuotidienne
        }

        const enAlerte = joursRestants <= 10 && vitesseVenteQuotidienne > 0

        if (enAlerte) {
            alertes.push({
                ...p,
                stockActuel,
                vitesseVenteQuotidienne,
                joursRestants: Math.round(joursRestants * 10) / 10,
                enAlerte
            })
        }
    }

    return alertes.sort((a, b) => a.joursRestants - b.joursRestants)
}
