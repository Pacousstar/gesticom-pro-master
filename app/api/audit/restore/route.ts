import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction, getIpAddress } from '@/lib/audit'
import { comptabiliserVente } from '@/lib/comptabilisation'

/**
 * API DE RESTAURATION GRANULAIRE (SNAPSHOT 2.0)
 * Permet de reconstruire une entité supprimée à partir de son archive JSON dans le log d'audit.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Accès restreint au Super Administrateur.' }, { status: 403 })
  }

  try {
    const { logId } = await request.json()
    if (!logId) return NextResponse.json({ error: 'ID de log requis.' }, { status: 400 })

    const log = await prisma.auditLog.findUnique({
      where: { id: Number(logId) }
    })

    if (!log || !log.details) {
      return NextResponse.json({ error: 'Log introuvable ou vide.' }, { status: 404 })
    }

    const data = JSON.parse(log.details)
    const type = log.type
    const action = log.action

    if (action !== 'SUPPRESSION' || type !== 'VENTE') {
      return NextResponse.json({ error: 'Seules les suppressions de ventes sont restaurables pour le moment.' }, { status: 400 })
    }

    // --- LOGIQUE DE RESTAURATION VENTE ---
    const checkExistant = await prisma.vente.findUnique({ where: { numero: data.numero } })
    if (checkExistant) {
      return NextResponse.json({ error: `La facture ${data.numero} existe déjà dans le système. Restauration impossible.` }, { status: 409 })
    }

    const restoredVente = await prisma.$transaction(async (tx) => {
      // 1. Re-créer la vente de base
      const v = await tx.vente.create({
        data: {
          numero: data.numero,
          date: new Date(data.date),
          magasinId: data.magasinId,
          entiteId: data.entiteId,
          utilisateurId: data.utilisateurId,
          clientId: data.clientId,
          clientLibre: data.clientLibre,
          montantTotal: data.montantTotal,
          fraisApproche: data.fraisApproche,
          remiseGlobale: data.remiseGlobale,
          montantPaye: data.montantPaye,
          statutPaiement: data.statutPaiement,
          modePaiement: data.modePaiement,
          pointsGagnes: data.pointsGagnes,
          statut: data.statut,
          observation: `[RESTORED] ${data.observation || ''}`,
          numeroBon: data.numeroBon,
          dateOperation: new Date(data.dateOperation || data.date),
          lignes: {
            create: data.lignes.map((l: any) => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              coutUnitaire: l.coutUnitaire,
              tva: l.tva,
              remise: l.remise,
              montant: l.montant,
            }))
          }
        },
        include: { lignes: true }
      })

      // 2. Re-créer les règlements
      if (data.reglements && Array.isArray(data.reglements)) {
        for (const r of data.reglements) {
          await tx.reglementVente.create({
            data: {
              venteId: v.id,
              clientId: r.clientId,
              entiteId: r.entiteId,
              montant: r.montant,
              modePaiement: r.modePaiement,
              utilisateurId: r.utilisateurId,
              date: new Date(r.date),
              observation: `[RESTAURATION] ${r.observation || ''}`,
            }
          })
        }
      }

      // 3. Mise à jour des stocks et mouvements
      for (const l of v.lignes) {
        // Décrémenter car c'est une vente
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId: v.magasinId },
          data: { quantite: { decrement: l.quantite } }
        })

        await tx.mouvement.create({
          data: {
            type: 'SORTIE',
            produitId: l.produitId,
            magasinId: v.magasinId,
            entiteId: v.entiteId,
            utilisateurId: session.userId,
            quantite: l.quantite,
            dateOperation: v.date,
            observation: `Restauration Vente ${v.numero}`,
          }
        })
      }

      // 4. Re-comptabiliser (Générer les écritures manquantes)
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
        reglements: data.reglements ? data.reglements.map((r: any) => ({ mode: r.modePaiement, montant: r.montant })) : [],
        fraisApproche: v.fraisApproche,
        lignes: v.lignes
      }, tx)

      return v
    }, { timeout: 30000 })

    await logAction(
      session,
      'RESTAURATION',
      'VENTE',
      `RESTAURATION RÉUSSIE : Facture ${data.numero} reconstruite intégralement à partir du log d'audit #${logId}`,
      restoredVente.id,
      { logId, numero: data.numero },
      getIpAddress(request)
    )

    return NextResponse.json({
      success: true,
      message: `La vente ${data.numero} a été restaurée avec succès.`,
      vente: restoredVente
    })

  } catch (error: any) {
    console.error('[RESTORE ERROR]', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la restauration.',
      details: error.message 
    }, { status: 500 })
  }
}
