import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserReglementVente, comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { reglementCompteCourantSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'
import { enregistrerOperationBancaire } from '@/lib/banque'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = validateApiRequest(reglementCompteCourantSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const { compteCourantId, montant, modePaiement, clientId, fournisseurId, magasinId, banqueId } = v
    const payeDepuisCaisse = v.payeDepuisCaisse === true
    const payeDepuisBanque = v.payeDepuisBanque === true

    if (payeDepuisCaisse && !magasinId) {
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
            magasinId: magasinId!,
            type: 'ENTREE',
            motif: `REGLEMENT:${reglement.id} Règlement CC Client ${client?.nom || ''}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
          }, tx)
          await recalculerSoldeCaisse(magasinId!, tx)
        }
        if (payeDepuisBanque) {
          await enregistrerOperationBancaire({
            banqueId,
            entiteId,
            date: new Date(),
            type: 'REGLEMENT_CLIENT',
            libelle: `Règlement CC Client #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `REGLEMENT_${reglement.id}`,
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
            magasinId: magasinId!,
            type: 'SORTIE',
            motif: `REGLEMENT:${reglement.id} Règlement CC Fournisseur ${fournisseur?.nom || ''}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
          }, tx)
          await recalculerSoldeCaisse(magasinId!, tx)
        }
        if (payeDepuisBanque) {
          await enregistrerOperationBancaire({
            banqueId,
            entiteId,
            date: new Date(),
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Règlement CC Fournisseur #${compteCourantId}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `REGLEMENT_${reglement.id}`,
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

        return NextResponse.json(res)
  } catch (error: any) {
    await apiCatch(error, 'api/comptes-courants/reglement')
    if (error.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ error: 'Doublon bloqué.', code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
