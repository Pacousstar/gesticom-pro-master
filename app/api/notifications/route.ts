import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    // Récupérer les notifications : stocks faibles, ventes récentes, etc.
    const notifications: Array<{
      id: string
      type: 'STOCK_FAIBLE' | 'VENTE_RECENTE' | 'ALERTE'
      titre: string
      message: string
      date: string
      lien?: string
      lu: boolean
    }> = []

    // 1. Stocks faibles
    const stocksFaibles = await prisma.stock.findMany({
      where: {
        produit: { actif: true },
      },
      include: {
        produit: {
          select: {
            id: true,
            code: true,
            designation: true,
            seuilMin: true,
          },
        },
        magasin: {
          select: {
            id: true,
            code: true,
            nom: true,
          },
        },
      },
      take: 10,
    })

    for (const stock of stocksFaibles) {
      if (stock.quantite < stock.produit.seuilMin) {
        notifications.push({
          id: `stock-${stock.id}`,
          type: 'STOCK_FAIBLE',
          titre: 'Stock faible',
          message: `${stock.produit.code} - ${stock.produit.designation} (${stock.magasin.code}) : ${stock.quantite} < ${stock.produit.seuilMin}`,
          date: new Date().toISOString(),
          lien: `/dashboard/stock?magasinId=${stock.magasinId}`,
          lu: false,
        })
      }
    }

    // 2. Ventes récentes (dernières 24h)
    const dateHier = new Date()
    dateHier.setHours(dateHier.getHours() - 24)

    const ventesRecentes = await prisma.vente.findMany({
      where: {
        date: { gte: dateHier },
        statut: 'VALIDEE',
      },
      include: {
        magasin: {
          select: {
            code: true,
            nom: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 5,
    })

    for (const vente of ventesRecentes) {
      notifications.push({
        id: `vente-${vente.id}`,
        type: 'VENTE_RECENTE',
        titre: 'Nouvelle vente',
        message: `Vente ${vente.numero} - ${vente.magasin?.code || 'N/A'} : ${vente.montantTotal.toFixed(0)} FCFA`,
        date: vente.date.toISOString(),
        lien: `/dashboard/ventes`,
        lu: false,
      })
    }

    // Trier par date (plus récentes en premier)
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Limiter à 20 notifications
    const notificationsLimitees = notifications.slice(0, 20)

    const nonLues = notificationsLimitees.filter((n) => !n.lu).length

    return NextResponse.json({
      notifications: notificationsLimitees,
      nonLues,
    })
  } catch (e) {
    console.error('GET /api/notifications:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
