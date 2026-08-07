import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserReglementVente, comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse, calculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { getEntiteId } from '@/lib/get-entite-id'
import { requireAnyPermission } from '@/lib/require-role'
import { reglementCompteCourantSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'
import { enregistrerOperationBancaire, calculerSoldeBanque } from '@/lib/banque'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requireAnyPermission(session, ['comptabilite:view', 'clients:edit', 'fournisseurs:edit', 'ventes:create'])
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = validateApiRequest(reglementCompteCourantSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const { compteCourantId, montant, modePaiement, clientId, fournisseurId, magasinId, banqueId } = v
    const observationSaisie = v.observation?.trim() || ''
    const payeDepuisCaisse = v.payeDepuisCaisse === true
    const payeDepuisBanque = v.payeDepuisBanque === true

    const estRetrait = montant < 0
    const montantFinal = Math.round(Math.abs(montant))
    const observationReglement = estRetrait
      ? `Retrait CC - ${observationSaisie}`
      : `Règlement rapide depuis Compte Courant${observationSaisie ? ` - ${observationSaisie}` : ''}`

    if (payeDepuisCaisse && !magasinId) {
      return NextResponse.json({ error: 'Le choix du point de vente (Caisse) est obligatoire.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    // Compte courant optionnel : résolu via clientId/fournisseurId si possible, sinon toléré
    // (les comptes courants mathématiques des pages soldes/[id] n'ont pas forcément de rangée CompteCourant).
    let cc: { id: number; entiteId: number; code?: string | null; nom?: string | null } | null = null
    if (compteCourantId) {
      const found = await prisma.compteCourant.findUnique({ where: { id: Number(compteCourantId) } })
      if (!found || found.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Compte courant introuvable.' }, { status: 404 })
      }
      cc = found
    } else if (clientId) {
      cc = await prisma.compteCourant.findFirst({ where: { clientId: Number(clientId), entiteId } })
    } else if (fournisseurId) {
      cc = await prisma.compteCourant.findFirst({ where: { fournisseurId: Number(fournisseurId), entiteId } })
    }
    const ccRefId = cc ? cc.id : 0
    const ccRef = ccRefId ? `#${ccRefId}` : ''
    const dateReglement = v.date ? new Date(v.date) : new Date()

    // Client : règlement normal => argent ENTRANT (ENTREE / REGLEMENT_CLIENT),
    // retrait (montant négatif) => argent SORTANT (SORTIE / RETRAIT).
    // Fournisseur : règlement normal => argent SORTANT (SORTIE / REGLEMENT_FOURNISSEUR),
    // retrait (montant négatif) => argent ENTRANT (ENTREE / DEPOT).
    const motifCaisseClient = estRetrait ? 'SORTIE' : 'ENTREE'
    const motifCaisseFournisseur = estRetrait ? 'ENTREE' : 'SORTIE'
    const typeBanqueClient = estRetrait ? 'RETRAIT' : 'REGLEMENT_CLIENT'
    const typeBanqueFournisseur = estRetrait ? 'DEPOT' : 'REGLEMENT_FOURNISSEUR'
    const paiementDirect = !payeDepuisCaisse && !payeDepuisBanque

    const res = await prisma.$transaction(async (tx: any) => {
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)

      if (clientId) {
        // Contrôle du solde de caisse avant une SORTIE (retrait client via caisse) :
        // la caisse ne doit pas devenir négative.
        if (estRetrait && payeDepuisCaisse && estModeEspeces(modePaiement)) {
          const soldeCaisse = await calculerSoldeCaisse(magasinId!, tx)
          if (soldeCaisse < montantFinal) {
            throw new Error(`CAISSE_INSUFFISANTE:${soldeCaisse}:${montantFinal}`)
          }
        }

        // Contrôle du solde bancaire avant un RETRAIT (retrait client via banque) :
        // le compte ne doit pas devenir négatif.
        if (estRetrait && payeDepuisBanque) {
          const soldeBanque = await calculerSoldeBanque(banqueId, entiteId, tx)
          if (soldeBanque < montantFinal) {
            throw new Error(`BANQUE_INSUFFISANTE:${soldeBanque}:${montantFinal}`)
          }
        }

        const isDuplicate = await tx.reglementVente.findFirst({
          where: {
            clientId, montant: montantFinal,
            utilisateurId: session.userId,
            createdAt: { gte: fifteenSecondsAgo },
            observation: { contains: estRetrait ? 'Retrait CC' : 'Compte Courant' },
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
            date: dateReglement,
            utilisateurId: session.userId,
            observation: observationReglement,
          },
        })

        if (payeDepuisCaisse && estModeEspeces(modePaiement)) {
          const client = await tx.client.findUnique({ where: { id: clientId }, select: { nom: true } })
          await enregistrerMouvementCaisse({
            magasinId: magasinId!,
            type: motifCaisseClient as 'ENTREE' | 'SORTIE',
            motif: `REGLEMENT:${reglement.id} ${estRetrait ? 'Retrait' : 'Règlement'} CC Client ${client?.nom || ''}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
            date: dateReglement,
          }, tx)
          await recalculerSoldeCaisse(magasinId!, tx)
        }
        if (payeDepuisBanque) {
          await enregistrerOperationBancaire({
            banqueId,
            entiteId,
            date: dateReglement,
            type: typeBanqueClient,
            libelle: `${estRetrait ? 'Retrait' : 'Règlement'} CC Client ${ccRef}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `REGLEMENT_${reglement.id}`,
            beneficiaire: undefined,
            observation: observationReglement,
          }, tx)
        }

        await comptabiliserReglementVente({
          reglementId: reglement.id,
          venteId: null,
          numeroVente: `CC-CLI-${clientId}`,
          date: reglement.date,
          montant: montantFinal,
          modePaiement,
          utilisateurId: session.userId,
          entiteId,
          forcerCompteClient: true,
          banqueId: payeDepuisBanque ? banqueId : null,
          estRetrait,
        }, tx)

        return reglement
      }

      if (fournisseurId) {
        const isDuplicate = await tx.reglementAchat.findFirst({
          where: {
            fournisseurId, montant: montantFinal,
            utilisateurId: session.userId,
            createdAt: { gte: fifteenSecondsAgo },
            observation: { contains: estRetrait ? 'Retrait CC' : 'Compte Courant' },
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
            date: dateReglement,
            utilisateurId: session.userId,
            observation: observationReglement,
          },
        })

        if (payeDepuisCaisse && estModeEspeces(modePaiement)) {
          const fournisseur = await tx.fournisseur.findUnique({ where: { id: fournisseurId }, select: { nom: true } })
          await enregistrerMouvementCaisse({
            magasinId: magasinId!,
            type: motifCaisseFournisseur as 'ENTREE' | 'SORTIE',
            motif: `REGLEMENT:${reglement.id} ${estRetrait ? 'Retrait' : 'Règlement'} CC Fournisseur ${fournisseur?.nom || ''}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            entiteId,
            date: dateReglement,
          }, tx)
          await recalculerSoldeCaisse(magasinId!, tx)
        }
        if (payeDepuisBanque) {
          await enregistrerOperationBancaire({
            banqueId,
            entiteId,
            date: dateReglement,
            type: typeBanqueFournisseur,
            libelle: `${estRetrait ? 'Retrait' : 'Règlement'} CC Fournisseur ${ccRef}`,
            montant: montantFinal,
            utilisateurId: session.userId,
            reference: `REGLEMENT_${reglement.id}`,
            beneficiaire: undefined,
            observation: observationReglement,
          }, tx)
        }

        await comptabiliserReglementAchat({
          reglementId: reglement.id,
          achatId: null,
          numeroAchat: `CC-FOURN-${fournisseurId}`,
          date: reglement.date,
          montant: montantFinal,
          modePaiement,
          utilisateurId: session.userId,
          entiteId,
          paiementDirect,
          banqueId: payeDepuisBanque ? banqueId : null,
          estRetrait,
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
    if (error.message?.includes('CAISSE_INSUFFISANTE:')) {
      const [, solde, montant] = error.message.split(':')
      return NextResponse.json({
        error: `Caisse insuffisante : solde disponible ${Number(solde).toLocaleString('fr-FR')} FCFA, retrait de ${Number(montant).toLocaleString('fr-FR')} FCFA impossible.`,
        code: 'CAISSE_INSUFFISANTE',
      }, { status: 400 })
    }
    if (error.message?.includes('BANQUE_INSUFFISANTE:')) {
      const [, solde, montant] = error.message.split(':')
      return NextResponse.json({
        error: `Solde bancaire insuffisant : disponible ${Number(solde).toLocaleString('fr-FR')} FCFA, retrait de ${Number(montant).toLocaleString('fr-FR')} FCFA impossible.`,
        code: 'BANQUE_INSUFFISANTE',
      }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
