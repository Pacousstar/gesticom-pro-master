import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, estModeEspeces } from '@/lib/caisse'

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

    const entiteId = session.entiteId || 1

    const res = await prisma.$transaction(async (tx: any) => {
      const a = achatId ? await tx.achat.findUnique({ where: { id: achatId } }) : null
      const targetFournisseurId = achatId ? a?.fournisseurId : fournisseurId
      if (!targetFournisseurId) throw new Error('Fournisseur introuvable')

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
        const nouveauMontantPaye = (a.montantPaye || 0) + montant
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
      }

      // ✅ COMPTABILISATION
      await comptabiliserReglementAchat({
        achatId: achatId || 0,
        numeroAchat: a?.numero || String(achatId || 'LIBRE'),
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
  } catch (error) {
    console.error('Erreur Règlement Achat:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
