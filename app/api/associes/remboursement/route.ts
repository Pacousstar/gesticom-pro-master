import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { verifierCloture } from '@/lib/cloture'
import { apiCatch } from '@/lib/log-error'
import { estModeEspeces } from '@/lib/enums-commerce'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { comptabiliserRemboursementAssocie } from '@/lib/comptabilisation'

const NUMERO_455 = '455'

async function soldeCompteAssocie(entiteId: number) {
  const compte = await prisma.planCompte.findFirst({ where: { numero: NUMERO_455 } })
  if (!compte) return { compte: null, solde: 0 }
  const [deb, cred] = await Promise.all([
    prisma.ecritureComptable.aggregate({
      where: { compteId: compte.id, entiteId },
      _sum: { debit: true },
    }),
    prisma.ecritureComptable.aggregate({
      where: { compteId: compte.id, entiteId },
      _sum: { credit: true },
    }),
  ])
  // Solde créditeur du 455 (dette de l'entité envers l'associé)
  return {
    compte,
    solde: Math.round(((cred._sum.credit || 0) - (deb._sum.debit || 0)) * 100) / 100,
  }
}

export async function GET(_request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    const { compte, solde } = await soldeCompteAssocie(entiteId)

    const historique = compte
      ? await prisma.ecritureComptable.findMany({
          where: { referenceType: 'REMB_ASSOCIE', entiteId, compteId: compte.id },
          orderBy: { date: 'desc' },
          take: 50,
          select: {
            id: true,
            date: true,
            libelle: true,
            debit: true,
            credit: true,
            piece: true,
          },
        })
      : []

    return NextResponse.json({ solde, historique })
  } catch (error) {
    await apiCatch(error, 'api/associes/remboursement')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const body = await request.json()
    const montant = Math.round(Number(body?.montant) || 0)
    const modePaiement = String(body?.modePaiement || 'ESPECES').toUpperCase()
    const magasinId = body?.magasinId ? Number(body.magasinId) : null
    const banqueId = body?.banqueId ? Number(body.banqueId) : null
    const observation = body?.observation ? String(body.observation).trim() : null

    if (montant <= 0) {
      return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 })
    }
    if (estModeEspeces(modePaiement) && !magasinId) {
      return NextResponse.json({ error: 'Le choix du point de vente (Caisse) est obligatoire.' }, { status: 400 })
    }
    if (!estModeEspeces(modePaiement) && !banqueId) {
      return NextResponse.json({ error: 'Le choix du compte bancaire est obligatoire.' }, { status: 400 })
    }

    await verifierCloture(new Date(), session)

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    const { compte, solde } = await soldeCompteAssocie(entiteId)

    if (!compte) {
      return NextResponse.json({ error: 'Compte 455 introuvable (comptabilité non initialisée).' }, { status: 500 })
    }
    if (montant > solde) {
      return NextResponse.json({
        error: `Solde du compte courant associé insuffisant : ${solde.toLocaleString('fr-FR')} F disponibles pour ${montant.toLocaleString('fr-FR')} F demandés.`,
        solde,
      }, { status: 400 })
    }

    const numero = `RA${Date.now()}`
    const referenceId = Date.now()
    const date = new Date()

    await prisma.$transaction(async (tx) => {
      if (estModeEspeces(modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId: magasinId!,
          type: 'SORTIE',
          motif: `REMBOURSEMENT ASSOCIE ${numero}${observation ? ` ${observation}` : ''}`,
          montant,
          utilisateurId: session.userId,
          entiteId,
          date,
        }, tx)
        await recalculerSoldeCaisse(magasinId!, tx)
      } else {
        await enregistrerOperationBancaire({
          banqueId: banqueId!,
          entiteId,
          date,
          type: 'RETRAIT',
          libelle: `Remboursement compte courant associé ${numero}`,
          montant,
          utilisateurId: session.userId,
          reference: `REM-${numero}`,
          beneficiaire: 'Associé',
          observation,
        }, tx)
      }

      await comptabiliserRemboursementAssocie({
        referenceId,
        numero,
        date,
        montant,
        modePaiement,
        magasinId,
        banqueId,
        utilisateurId: session.userId,
        entiteId,
      }, tx)
    }, { timeout: 20000 })

    return NextResponse.json({ success: true, numero, solde: solde - montant })
  } catch (error) {
    await apiCatch(error, 'api/associes/remboursement')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur.' }, { status: 500 })
  }
}
