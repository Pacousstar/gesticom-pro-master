import { prisma } from './db'

/**
 * Calcule l'autonomie restante d'un produit en jours
 * @param produitId ID du produit
 * @returns jours d'autonomie (Infinity si aucune vente)
 */
export async function calculerAutonomieStock(produitId: number): Promise<{
    stockActuel: number,
    vitesseVenteQuotidienne: number,
    joursRestants: number,
    enAlerte: boolean
}> {
    const joursAnalyse = 30
    const dateSeuil = new Date()
    dateSeuil.setDate(dateSeuil.getDate() - joursAnalyse)

    // 1. Récupérer le stock global actuel
    const stocks = await prisma.stock.findMany({
        where: { produitId }
    })
    const stockActuel = stocks.reduce((acc, s) => acc + s.quantite, 0)

    // 2. Calculer le total vendu sur les 30 derniers jours
    const ventesLignes = await prisma.venteLigne.findMany({
        where: {
            produitId,
            vente: {
                date: { gte: dateSeuil },
                statut: 'VALIDEE'
            }
        },
        select: { quantite: true }
    })

    const totalVendu = ventesLignes.reduce((acc, l) => acc + l.quantite, 0)
    const vitesseVenteQuotidienne = totalVendu / joursAnalyse

    // 3. Calculer les jours restants
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
export async function getProduitsEnAlerte() {
    const produits = await prisma.produit.findMany({
        where: { actif: true },
        select: { id: true, designation: true, code: true }
    })

    const alertes = []
    for (const p of produits) {
        const stats = await calculerAutonomieStock(p.id)
        if (stats.enAlerte) {
            alertes.push({
                ...p,
                ...stats
            })
        }
    }

    return alertes.sort((a, b) => a.joursRestants - b.joursRestants)
}
