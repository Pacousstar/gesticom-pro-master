import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { comptabiliserVente } from '@/lib/comptabilisation'
import { getSession } from '@/lib/auth'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Route de maintenance désactivée en production.' }, { status: 403 })
  }
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const logs: string[] = ['🏁 DÉMARRAGE DE LA RÉCONCILIATION COMPTABLE DES VENTES']

  try {
    // 1. Récupérer toutes les ventes validées
    const ventes = await prisma.vente.findMany({
      where: { statut: { in: ['VALIDE', 'VALIDEE'] } },
      include: {
        lignes: true,
        reglements: {
          select: { modePaiement: true, montant: true }
        }
      }
    })

    logs.push(`${ventes.length} ventes à examiner.`)

    let totalRepares = 0
    let totalIgnorees = 0

    for (const v of ventes) {
      // Vérifier si toutes les écritures (Vente, Stock, Frais, Règlements) sont présentes et équilibrées (Point 4 Audit)
      const ecritures = await prisma.ecritureComptable.findMany({
        where: { 
          referenceId: v.id, 
          referenceType: { in: ['VENTE', 'VENTE_STOCK', 'VENTE_FRAIS', 'VENTE_REGLEMENT'] } 
        }
      })

      const totalDebit = ecritures.reduce((acc, e) => acc + e.debit, 0)
      const totalCredit = ecritures.reduce((acc, e) => acc + e.credit, 0)
      
      // La réconciliation vérifie maintenant :
      // 1. L'existence d'écritures
      // 2. L'équilibre Débit/Crédit (Double Entrée)
      // 3. La cohérence avec le montant TTC de la vente
      const estEquilibre = ecritures.length > 0 && Math.abs(totalDebit - totalCredit) < 1
      const montantCoherent = ecritures.some(e => e.referenceType === 'VENTE' && Math.abs(e.debit - v.montantTotal) < 1)
      
      const aReparer = !estEquilibre || !montantCoherent

      if (aReparer) {
        // RECOMPTABILISATION CHIRURGICALE
        // La fonction comptabiliserVente nettoie déjà les anciennes écritures ORPHÉLINES ou INCORRECTES
        await comptabiliserVente({
          venteId: v.id,
          numeroVente: v.numero,
          date: v.date,
          montantTotal: v.montantTotal,
          modePaiement: v.modePaiement,
          clientId: v.clientId,
          entiteId: v.entiteId,
          utilisateurId: v.utilisateurId,
          magasinId: v.magasinId,
          fraisApproche: v.fraisApproche,
          reglements: v.reglements.map(r => ({ mode: r.modePaiement, montant: r.montant })),
          lignes: v.lignes.map(l => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            coutUnitaire: l.coutUnitaire,
            tva: l.tva,
            remise: l.remise
          }))
        })
        
        totalRepares++
        logs.push(`✅ Régularisée : ${v.numero} (${v.montantTotal} F)`)
      } else {
        totalIgnorees++
      }
    }

    logs.push(`\n--- RÉSUMÉ ---`)
    logs.push(`Ventes traitées : ${totalRepares}`)
    logs.push(`Ventes déjà correctes : ${totalIgnorees}`)
    logs.push('🌟 RÉCONCILIATION TERMINÉE AVEC SUCCÈS.')

    return NextResponse.json({ success: true, logs })
  } catch (error: any) {
    console.error('Erreur réconciliation:', error)
    return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 })
  }
}
