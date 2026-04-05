import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = session.entiteId
  const typeRecherche = request.nextUrl.searchParams.get('type') // "CLIENT" | "FOURNISSEUR"

  try {
    if (typeRecherche === 'CLIENT') {
      const clients = await prisma.client.findMany({
        where: { actif: true },
        select: {
          id: true,
          code: true,
          nom: true,
          type: true,
          soldeInitial: true,
          avoirInitial: true,
          ventes: {
            where: {
              statut: { in: ['VALIDE', 'VALIDEE'] },
              ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
            },
            select: { montantTotal: true, montantPaye: true }
          },
          reglements: {
            where: {
              ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
                utilisateur: { entiteId }
              } : {}),
            },
            select: { montant: true }
          }
        }
      })

      const report = clients.map(c => {
        const totalDu = c.ventes.reduce((acc, v) => acc + (v.montantTotal || 0), 0)
        // La dette tient compte de montantPaye sur les factures de ventes
        const totalPayeFactures = c.ventes.reduce((acc, v) => acc + (v.montantPaye || 0), 0)
        const totalPaye = totalPayeFactures
        
        // Solde = (Dette Factures + Solde Initial) - (Total Règlements + Avoir Initial)
        const solde = (totalDu + (c.soldeInitial || 0)) - (totalPaye + (c.avoirInitial || 0))
        
        return {
          id: c.id,
          code: c.code,
          nom: c.nom,
          type: c.type,
          totalDu: totalDu + (c.soldeInitial || 0),
          totalPaye: totalPaye + (c.avoirInitial || 0),
          solde
        }
      }).filter(c => Math.abs(c.solde) > 0.01)

      return NextResponse.json(report)
    } else {
      const fournisseurs = await prisma.fournisseur.findMany({
        where: { actif: true },
        select: {
          id: true,
          code: true,
          nom: true,
          soldeInitial: true,
          avoirInitial: true,
          achats: {
            where: {
              ...(entiteId && session.role !== 'SUPER_ADMIN' ? { entiteId } : {}),
            },
            select: { montantTotal: true, montantPaye: true }
          },
          reglements: {
            where: {
              ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
                utilisateur: { entiteId }
              } : {}),
            },
            select: { montant: true }
          }
        }
      })

      const report = fournisseurs.map(f => {
        const totalDu = f.achats.reduce((acc, a) => acc + (a.montantTotal || 0), 0)
        const totalPayeFactures = f.achats.reduce((acc, a) => acc + (a.montantPaye || 0), 0)
        // Les règlements isolés non liés à une facture ne doivent pas dédoubler le montant payé d'une facture existante
        const totalPaye = totalPayeFactures
        
        // Solde = (Dette Factures + Solde Initial) - (Total Règlements + Avoir Initial)
        const solde = (totalDu + (f.soldeInitial || 0)) - (totalPaye + (f.avoirInitial || 0))
        
        return {
          id: f.id,
          code: f.code,
          nom: f.nom,
          totalDu: totalDu + (f.soldeInitial || 0),
          totalPaye: totalPaye + (f.avoirInitial || 0),
          solde
        }
      }).filter(f => Math.abs(f.solde) > 0.01)

      return NextResponse.json(report)
    }
  } catch (error) {
    console.error('Erreur Rapport Soldes:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des soldes' }, { status: 500 })
  }
}
