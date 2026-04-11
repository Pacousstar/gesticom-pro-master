import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserReglementVente } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, estModeEspeces } from '@/lib/caisse'

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

    const entiteId = session.entiteId || 1

    // Transaction Prisma
    const res = await prisma.$transaction(async (tx: any) => {
      const v = venteId ? await tx.vente.findUnique({ where: { id: venteId } }) : null
      const targetClientId = venteId ? v?.clientId : clientId
      if (!targetClientId) throw new Error('Client introuvable')

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
        const nouveauMontantPaye = (v.montantPaye || 0) + montant
        const nouveauStatutPaiement = nouveauMontantPaye >= v.montantTotal - 0.01 ? 'PAYE' : 'PARTIEL'
        await tx.vente.update({
          where: { id: venteId },
          data: { montantPaye: nouveauMontantPaye, statutPaiement: nouveauStatutPaiement }
        })
      }

      // Points de fidélité
      await tx.client.update({
        where: { id: targetClientId },
        data: { pointsFidelite: { increment: Math.floor(montant) } }
      })

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
      }

      // ✅ COMPTABILISATION
      await comptabiliserReglementVente({
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
  } catch (error) {
    console.error('Erreur Règlement Vente:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
