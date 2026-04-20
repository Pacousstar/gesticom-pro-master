import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserReglementVente } from '@/lib/comptabilisation'
import { estModeEspeces } from '@/lib/caisse'
import { getEntiteId } from '@/lib/get-entite-id'
import { pointsFideliteDepuisEncaissement } from '@/lib/calculs-commerciaux'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const venteId = body.venteId ? Number(body.venteId) : null
    const clientId = body.clientId ? Number(body.clientId) : (body.venteId ? null : null)
    const montant = Math.max(0, Number(body.montant))
    const modePaiement = body.modePaiement || 'ESPECES'
    const observation = body.observation || (venteId ? `Règlement vente` : `Acompte client`)
    const dateStr = body.date || null
    let dateReglement = new Date()
    if (dateStr) {
      try {
        const [y, m, d] = dateStr.split('-').map(Number)
        const now = new Date()
        // Injection de l'heure locale actuelle dans la date brute
        const tempDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
        if (!isNaN(tempDate.getTime())) {
          dateReglement = tempDate
        }
      } catch (e) {
        console.error("Date invalide reçue:", dateStr)
      }
    }

    if (!montant || (!venteId && !clientId)) {
      return NextResponse.json({ error: 'Montant et (Vente ou Client) requis.' }, { status: 400 })
    }

    if (modePaiement === 'ESPECES' && !body.magasinId) {
      return NextResponse.json({ error: 'Le choix du point de vente (Caisse) est obligatoire pour un règlement en espèces.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    // Transaction Prisma
    const res = await prisma.$transaction(async (tx: any) => {
      // --- VERROU SÉMANTIQUE (Idempotence) ---
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await tx.reglementVente.findFirst({
        where: {
          venteId,
          clientId,
          montant,
          utilisateurId: session.userId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
        throw new Error('DOUBLE_TRANSACTION: Ce règlement semble être un doublon (même montant en moins de 15s).')
      }

      const v = venteId ? await tx.vente.findUnique({ where: { id: venteId } }) : null
      if (v && v.entiteId !== entiteId) {
        throw new Error('Accès refusé à cette facture (entité différente).')
      }
      const targetClientId = venteId ? v?.clientId : clientId
      if (!targetClientId) throw new Error('Client introuvable')

      const client = await tx.client.findUnique({
        where: { id: targetClientId },
        select: { id: true, entiteId: true, code: true }
      })
      if (!client) throw new Error('Client introuvable')
      if (client.entiteId && client.entiteId !== entiteId) {
        throw new Error('Accès refusé à ce client (entité différente).')
      }

      if (venteId && v) {
        const resteAPayer = Math.max(0, (v.montantTotal || 0) - (v.montantPaye || 0))
        if (montant - resteAPayer > 0.01) {
          throw new Error(`Paiement invalide: le montant (${montant.toLocaleString()} F) dépasse le reste à payer (${resteAPayer.toLocaleString()} F).`)
        }
      }

      const reglement = await tx.reglementVente.create({
        data: {
          venteId,
          clientId: targetClientId,
          entiteId,
          montant,
          modePaiement,
          utilisateurId: session.userId,
          observation,
          date: dateReglement
        }
      })

      if (venteId && v) {
        const nouveauMontantPaye = Math.min(v.montantTotal, (v.montantPaye || 0) + montant)
        const nouveauStatutPaiement = nouveauMontantPaye >= v.montantTotal - 0.01 ? 'PAYE' : 'PARTIEL'
        await tx.vente.update({
          where: { id: venteId },
          data: { montantPaye: nouveauMontantPaye, statutPaiement: nouveauStatutPaiement }
        })
      }

      // Points de fidélité
      if (client.code !== 'PASSAGE' && client.code !== 'ANONYME') {
        await tx.client.update({
          where: { id: targetClientId },
          data: { pointsFidelite: { increment: pointsFideliteDepuisEncaissement(montant) } }
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
            type: 'ENTREE',
            motif: `Règlement : ${observation}${v?.numeroBon ? ' (BON: ' + v.numeroBon + ')' : ''}`,
            date: dateReglement
          }
        })
      } else {
        // ✅ SYNCHRO BANQUE : Mobile Money, Virement, Chèque
        const { enregistrerOperationBancaire, estModeBanque } = await import('@/lib/banque')
        if (estModeBanque(modePaiement)) {
          await enregistrerOperationBancaire({
            banqueId: body.banqueId ? Number(body.banqueId) : null,
            entiteId,
            date: dateReglement,
            type: 'REGLEMENT_CLIENT',
            libelle: `Règlement Vente ${v?.numero || ''} - ${observation}`,
            montant,
            utilisateurId: session.userId,
            reference: v?.numero || `REG-${Date.now()}`,
            observation: `Paiement via ${modePaiement}`
          }, tx)
        }
      }

      // ✅ COMPTABILISATION
      await comptabiliserReglementVente({
        reglementId: reglement.id,
        venteId: venteId || 0,
        numeroVente: v?.numero || `AC-CLI-${targetClientId}`,
        date: dateReglement,
        montant,
        modePaiement,
        entiteId,
        utilisateurId: session.userId,
        magasinId: Number(body.magasinId) || 1
      }, tx)

      return reglement
    }, { timeout: 20000 })

    revalidatePath('/dashboard/ventes')
    revalidatePath('/dashboard/clients')
    
    return NextResponse.json(res)
  } catch (error: any) {
    console.error('Erreur Règlement Vente:', error)
    if (error.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Ce règlement a déjà été enregistré (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
