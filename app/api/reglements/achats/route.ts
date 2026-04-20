import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { estModeEspeces } from '@/lib/caisse'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const achatId = body.achatId ? Number(body.achatId) : null
    const fournisseurId = body.fournisseurId ? Number(body.fournisseurId) : null
    const montant = Math.max(0, Number(body.montant))
    const modePaiement = body.modePaiement || 'ESPECES'
    const observation = body.observation || (achatId ? `Règlement achat` : `Acompte fournisseur`)

    const dateStr = body.date || null
    let dateReglement = new Date()
    if (dateStr) {
      try {
        const [y, m, d] = dateStr.split('-').map(Number)
        const now = new Date()
        const tempDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
        if (!isNaN(tempDate.getTime())) dateReglement = tempDate
      } catch (e) {}
    }

    if (!montant || (!achatId && !fournisseurId)) {
      return NextResponse.json({ error: 'Montant et (Achat ou Fournisseur) requis.' }, { status: 400 })
    }

    if (modePaiement === 'ESPECES' && !body.magasinId) {
      return NextResponse.json({ error: 'Le choix du point de vente (Caisse) est obligatoire pour un règlement en espèces.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const res = await prisma.$transaction(async (tx: any) => {
      // --- VERROU SÉMANTIQUE (Idempotence) ---
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await tx.reglementAchat.findFirst({
        where: {
          achatId,
          fournisseurId,
          montant,
          utilisateurId: session.userId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
        throw new Error('DOUBLE_TRANSACTION: Ce règlement achat semble être un doublon.')
      }

      const a = achatId ? await tx.achat.findUnique({ where: { id: achatId } }) : null
      if (a && a.entiteId !== entiteId) {
        throw new Error('Accès refusé à cette facture (entité différente).')
      }
      const targetFournisseurId = achatId ? a?.fournisseurId : fournisseurId
      if (!targetFournisseurId) throw new Error('Fournisseur introuvable')

      const fournisseur = await tx.fournisseur.findUnique({
        where: { id: targetFournisseurId },
        select: { id: true, entiteId: true }
      })
      if (!fournisseur) throw new Error('Fournisseur introuvable')
      if (fournisseur.entiteId && fournisseur.entiteId !== entiteId) {
        throw new Error('Accès refusé à ce fournisseur (entité différente).')
      }

      if (achatId && a) {
        const resteAPayer = Math.max(0, (a.montantTotal || 0) - (a.montantPaye || 0))
        if (montant - resteAPayer > 0.01) {
          throw new Error(`Paiement invalide: le montant (${montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
        }
      }

      const reglement = await tx.reglementAchat.create({
        data: {
          achatId,
          fournisseurId: targetFournisseurId,
          entiteId,
          montant,
          modePaiement,
          utilisateurId: session.userId,
          observation,
          date: dateReglement
        }
      })

      if (achatId && a) {
        const nouveauMontantPaye = Math.min(a.montantTotal, (a.montantPaye || 0) + montant)
        const nouveauStatutPaiement = nouveauMontantPaye >= a.montantTotal - 0.01 ? 'PAYE' : 'PARTIEL'
        await tx.achat.update({
          where: { id: achatId },
          data: { montantPaye: nouveauMontantPaye, statutPaiement: nouveauStatutPaiement }
        })
      }

      // ✅ COMPTEUR CAISSE GLOBAL
      if (estModeEspeces(modePaiement)) {
        await tx.caisse.create({
          data: {
            magasinId: Number(body.magasinId) || 1,
            entiteId,
            utilisateurId: session.userId,
            montant,
            type: 'SORTIE',
            motif: `Règlement Achat : ${observation}`,
            date: dateReglement
          }
        })
      } else {
        // ✅ SYNCHRO BANQUE : Sortie de fonds
        const { enregistrerOperationBancaire, estModeBanque } = await import('@/lib/banque')
        if (estModeBanque(modePaiement)) {
          await enregistrerOperationBancaire({
            banqueId: body.banqueId ? Number(body.banqueId) : null,
            entiteId,
            date: dateReglement,
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Règlement Achat ${a?.numero || ''} - ${observation}`,
            montant,
            utilisateurId: session.userId,
            reference: a?.numero || `PAY-${Date.now()}`,
            observation: `Paiement via ${modePaiement}`
          }, tx)
        }
      }

      // ✅ COMPTABILISATION
      await comptabiliserReglementAchat({
        reglementId: reglement.id,
        achatId: achatId || 0,
        numeroAchat: a?.numero || `AC-FOURN-${targetFournisseurId}`,
        date: dateReglement,
        montant,
        modePaiement,
        entiteId,
        utilisateurId: session.userId,
        magasinId: Number(body.magasinId) || 1
      }, tx)

      return reglement
    })

    revalidatePath('/dashboard/achats')
    revalidatePath('/dashboard/fournisseurs')
    
    return NextResponse.json(res)
  } catch (error: any) {
    console.error('Erreur Règlement Achat:', error)
    if (error.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Ce règlement achat a déjà été enregistré (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
