import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  try {
    const entiteId = await getEntiteId(session)
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')
    const dateFin = request.nextUrl.searchParams.get('dateFin')

    const where: any = { entiteId: Number(entiteId), statut: 'VALIDEE' }
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    // Récupérer toutes les lignes de vente validées
    const lignes = await prisma.venteLigne.findMany({
      where: {
        vente: where
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
    const rentabilite: Record<number, any> = {}

    lignes.forEach((l) => {
      const pId = l.produitId
      if (!rentabilite[pId]) {
        rentabilite[pId] = {
          produitId: pId,
          code: l.produit.code,
          designation: l.produit.designation,
          categorie: l.produit.categorie || 'S/C',
          quantiteVendue: 0,
          chiffreAffairesHT: 0,
          coutTotalHT: 0,
          margeBrute: 0
        }
      }

      const q = l.quantite
      const pu = l.prixUnitaire
      const remiseLigne = l.remise || 0
      // Utilisation du coût unitaire historique (PAMP à la vente)
      const cu = l.coutUnitaire || 0 
      
      rentabilite[pId].quantiteVendue += q
      rentabilite[pId].chiffreAffairesHT += (q * pu) - remiseLigne
      rentabilite[pId].coutTotalHT += q * cu
    })

    const result = Object.values(rentabilite).map((item: any) => ({
      ...item,
      margeBrute: item.chiffreAffairesHT - item.coutTotalHT,
      tauxMarge: item.chiffreAffairesHT > 0 ? ((item.chiffreAffairesHT - item.coutTotalHT) / item.chiffreAffairesHT) * 100 : 0
    })).sort((a, b) => b.margeBrute - a.margeBrute)

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur lors du calcul de rentabilité' }, { status: 500 })
  }
}
