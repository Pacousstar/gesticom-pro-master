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
      // Vérifier s'il y a des anomalies
      const ecritures = await prisma.ecritureComptable.findMany({
        where: { referenceType: 'VENTE', referenceId: v.id }
      })

      const totalDebit = ecritures.reduce((acc, e) => acc + e.debit, 0)
      const aReparer = ecritures.length === 0 || Math.abs(totalDebit - v.montantTotal) > 1

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
