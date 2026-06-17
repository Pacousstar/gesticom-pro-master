import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserReglementVente, comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const { compteCourantId, montant, modePaiement, clientId, fournisseurId } = body
    const payeDepuisCaisse = body.payeDepuisCaisse === true
    const payeDepuisBanque = body.payeDepuisBanque === true

    if (!compteCourantId || !montant || montant <= 0 || !modePaiement) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
    }

    if (payeDepuisCaisse && !body.magasinId) {
      return NextResponse.json({ error: 'Le choix du point de vente (Caisse) est obligatoire.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    const cc = await prisma.compteCourant.findUnique({ where: { id: Number(compteCourantId) } })
    if (!cc || cc.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Compte courant introuvable.' }, { status: 404 })
    }

    const montantFinal = Math.round(montant)
    const paiementDirect = !payeDepuisCaisse && !payeDepuisBanque

    const res = await prisma.$transaction(async (tx: any) => {
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)

      if (clientId) {
        const isDuplicate = await tx.reglementVente.findFirst({
          where: {
            clientId, montant: montantFinal,
            utilisateurId: session.userId,
            createdAt: { gte: fifteenSecondsAgo },
            observation: { contains: 'Règlement rapide depuis Compte Courant' },
          },
          select: { id: true },
        })
        if (isDuplicate) throw new Error('DOUBLE_TRANSACTION')

        const reglement = await tx.reglementVente.create({
          data: {
            venteId: null,
            clientId,
            entiteId,
            montant: montantFinal,
            modePaiement,
            statut: 'VALIDE',
            date: new Date(),
            utilisateurId: session.userId,
            observation: `Règlement rapide depuis Compte Courant`,
          },
        })

        if (payeDepuisCaisse && estModeEspeces(modePaiement)) {
          const client = await tx.client.findUnique({ where: { id: clientId }, select: { nom: true } })
          await enregistrerMouvementCaisse({
            magasinId: Number(body.magasinId),
            type: 'ENTREE',
            motif: `Règlement CC Client ${client?.nom || ''} #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
          }, tx)
          await recalculerSoldeCaisse(Number(body.magasinId), tx)
        }
        if (payeDepuisBanque) {
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
          await enregistrerOperationBancaire({
            banqueId: body.banqueId ? Number(body.banqueId) : null,
            entiteId,
            type: 'REGLEMENT_CLIENT',
            libelle: `Règlement CC Client #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `CC-${compteCourantId}`,
            beneficiaire: undefined,
            observation: `Paiement via ${modePaiement}`,
          }, tx)
        }

        await comptabiliserReglementVente({
          reglementId: reglement.id,
          venteId: null,
          numeroVente: `CC-CLI-${clientId}`,
          date: new Date(),
          montant: montantFinal,
          modePaiement,
          utilisateurId: session.userId,
          entiteId,
          estAcompte: true,
        }, tx)

        return reglement
      }

      if (fournisseurId) {
        const isDuplicate = await tx.reglementAchat.findFirst({
          where: {
            fournisseurId, montant: montantFinal,
            utilisateurId: session.userId,
            createdAt: { gte: fifteenSecondsAgo },
            observation: { contains: 'Règlement rapide depuis Compte Courant' },
          },
          select: { id: true },
        })
        if (isDuplicate) throw new Error('DOUBLE_TRANSACTION')

        const reglement = await tx.reglementAchat.create({
          data: {
            achatId: null,
            fournisseurId,
            entiteId,
            montant: montantFinal,
            modePaiement,
            statut: 'VALIDE',
            date: new Date(),
            utilisateurId: session.userId,
            observation: `Règlement rapide depuis Compte Courant`,
          },
        })

        if (payeDepuisCaisse && estModeEspeces(modePaiement)) {
          const fournisseur = await tx.fournisseur.findUnique({ where: { id: fournisseurId }, select: { nom: true } })
          await enregistrerMouvementCaisse({
            magasinId: Number(body.magasinId),
            type: 'SORTIE',
            motif: `Règlement CC Fournisseur ${fournisseur?.nom || ''} #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
          }, tx)
          await recalculerSoldeCaisse(Number(body.magasinId), tx)
        }
        if (payeDepuisBanque) {
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
          await enregistrerOperationBancaire({
            banqueId: body.banqueId ? Number(body.banqueId) : null,
            entiteId,
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Règlement CC Fournisseur #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `CC-${compteCourantId}`,
            beneficiaire: undefined,
            observation: `Paiement via ${modePaiement}`,
          }, tx)
        }

        await comptabiliserReglementAchat({
          reglementId: reglement.id,
          achatId: null,
          numeroAchat: `CC-FOURN-${fournisseurId}`,
          date: new Date(),
          montant: montantFinal,
          modePaiement,
          utilisateurId: session.userId,
          entiteId,
          paiementDirect,
        }, tx)

        return reglement
      }

      throw new Error('Aucun client ou fournisseur lié.')
    }, { timeout: 20000 })

    revalidatePath('/dashboard/comptes-courants')
    return NextResponse.json(res)
  } catch (error: any) {
    console.error('Erreur Règlement CC:', error)
    if (error.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ error: 'Doublon bloqué.', code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
