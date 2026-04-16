import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:view')
  if (forbidden) return forbidden

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const clientId = request.nextUrl.searchParams.get('clientId')

  const where: any = {
    vente: {
      statut: 'VALIDEE'
    }
  }

  if (dateDebut && dateFin) {
    where.vente.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (clientId) {
    where.vente.clientId = Number(clientId)
  }

  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.vente.entiteId = session.entiteId
  }

  try {
    // Récupérer toutes les lignes de vente validées avec leur coût unitaire historique
    const lignes = await prisma.venteLigne.findMany({
      where: {
        vente: {
          statut: 'VALIDEE',
          ...(dateDebut && dateFin ? {
            date: {
              gte: new Date(dateDebut + 'T00:00:00'),
              lte: new Date(dateFin + 'T23:59:59'),
            }
          } : {}),
          ...(clientId ? { clientId: Number(clientId) } : {}),
          ...(session.role !== 'SUPER_ADMIN' && session.entiteId ? { entiteId: session.entiteId } : {})
        }
      },
      include: {
        produit: {
          select: {
            code: true,
            designation: true,
            categorie: true
          }
        }
      }
    })

    // Aggréger par produit
    const stats: Record<number, any> = {}

    lignes.forEach((l) => {
      const pId = l.produitId
      if (!stats[pId]) {
        stats[pId] = {
          produitId: pId,
          code: l.produit?.code || '—',
          designation: l.designation,
          categorie: l.produit?.categorie || 'S/C',
          quantiteTotale: 0,
          caTotal: 0,
          coutTotal: 0,
          nombreTransactions: 0
        }
      }

      const q = l.quantite
      const pu = l.prixUnitaire
      const remiseLigne = l.remise || 0
      const cu = l.coutUnitaire || 0 
      
      stats[pId].quantiteTotale += q
      stats[pId].caTotal += (q * pu) - remiseLigne
      stats[pId].coutTotal += q * cu
      stats[pId].nombreTransactions += 1
    })

    const result = Object.values(stats).map((item: any) => ({
      ...item,
      margeBrute: item.caTotal - item.coutTotal,
      tauxMarge: item.caTotal > 0 ? ((item.caTotal - item.coutTotal) / item.caTotal) * 100 : 0
    })).sort((a, b) => b.caTotal - a.caTotal)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erreur Rapport CA Produits:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
