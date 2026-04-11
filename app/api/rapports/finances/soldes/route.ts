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
        // Correction : On utilise la somme de TOUS les règlements (y compris les acomptes)
        const totalPayeComplet = c.reglements.reduce((acc, r) => acc + (r.montant || 0), 0)
        
        // Solde = (Dette Factures + Solde Initial) - (Total Règlements + Avoir Initial)
        const totalFactures = totalDu + (c.soldeInitial || 0)
        const totalEncaisse = totalPayeComplet + (c.avoirInitial || 0)
        const solde = totalFactures - totalEncaisse
        
        return {
          id: c.id,
          code: c.code,
          nom: c.nom,
          type: c.type,
          totalDu: totalFactures,
          totalPaye: totalEncaisse,
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
        // Correction : Utiliser la somme réelle de tous les règlements fournisseurs
        const totalPayeComplet = f.reglements.reduce((acc, r) => acc + (r.montant || 0), 0)
        
        // Solde = (Dette Factures + Solde Initial) - (Total Règlements + Avoir Initial)
        const totalFactures = totalDu + (f.soldeInitial || 0)
        const totalDecaisse = totalPayeComplet + (f.avoirInitial || 0)
        const solde = totalFactures - totalDecaisse
        
        return {
          id: f.id,
          code: f.code,
          nom: f.nom,
          totalDu: totalFactures,
          totalPaye: totalDecaisse,
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
