import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const authError = requirePermission(session, 'fournisseurs:edit')
  if (authError) return authError

  try {
    const id = (await params).id
    const fournisseurId = Number(id)

    if (Number.isNaN(fournisseurId)) {
      return NextResponse.json({ error: 'ID fournisseur invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { montant, modePaiement, magasinId, banqueId, date } = body

    if (!montant || montant <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    if (!modePaiement) {
      return NextResponse.json({ error: 'Mode de paiement requis' }, { status: 400 })
    }

    // CREDIT = dette à terme, ne peut pas être un règlement
    if (String(modePaiement).toUpperCase() === 'CREDIT') {
      return NextResponse.json({ error: 'Le mode CREDIT représente une dette à terme, pas un règlement.' }, { status: 400 })
    }

    if (estModeEspeces(modePaiement) && !magasinId) {
      return NextResponse.json({ error: 'Magasin requis pour un paiement en espèces.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const dateReglement = date ? new Date(date) : new Date()

    const result = await prisma.$transaction(async (tx: any) => {
      const fournisseur = await tx.fournisseur.findUnique({
        where: { id: fournisseurId },
        select: { id: true, nom: true }
      })
      if (!fournisseur) throw new Error('Fournisseur introuvable')

      const reglement = await tx.reglementAchat.create({
        data: {
          fournisseurId,
          montant,
          modePaiement: modePaiement,
          date: dateReglement,
          statut: 'VALIDE',
          entiteId,
          utilisateurId: session.userId,
        },
      })

      const achatsNonSoldes = await tx.achat.findMany({
        where: {
          fournisseurId,
          entiteId,
          statut: { in: ['VALIDEE', 'VALIDE'] },
          statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
        },
        orderBy: { date: 'asc' },
        select: { id: true, montantTotal: true, montantPaye: true, ReglementAchatLigne: { select: { montant: true } } },
      })

      let resteAPayer = montant

      for (const achat of achatsNonSoldes) {
        if (resteAPayer <= 0) break

        const totalLignePaye = (achat.ReglementAchatLigne as any[] || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const realMontantPaye = Math.max(totalLignePaye, achat.montantPaye || 0)
        const montantDu = (achat.montantTotal || 0) - realMontantPaye
        const montantARegler = Math.min(montantDu, resteAPayer)

        if (montantARegler > 0) {
          const nouveauPaye = realMontantPaye + montantARegler
          const nouveauStatut = nouveauPaye >= (achat.montantTotal || 0) ? 'PAYE' : 'PARTIEL'

          await tx.achat.update({
            where: { id: achat.id },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauStatut,
            },
          })

          await tx.reglementAchatLigne.create({
            data: {
              reglementId: reglement.id,
              achatId: achat.id,
              montant: montantARegler,
            },
          })

          resteAPayer -= montantARegler
        }
      }

      const tousAchatsFournisseur = await tx.achat.findMany({
        where: { fournisseurId, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        select: { id: true, montantTotal: true }
      })

      for (const a of tousAchatsFournisseur) {
        const [lignes, directRegs] = await Promise.all([
          tx.reglementAchatLigne.findMany({
            where: { achatId: a.id },
            select: { montant: true }
          }),
          tx.reglementAchat.aggregate({
            where: { achatId: a.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
            _sum: { montant: true }
          })
        ])
        const totalFromLignes = lignes.reduce((sum: number, l: any) => sum + (l.montant || 0), 0)
        const totalFromDirect = directRegs._sum?.montant || 0
        const totalPaye = Math.max(totalFromLignes, totalFromDirect)
        const nouveauStatut = totalPaye >= a.montantTotal ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'

        await tx.achat.update({
          where: { id: a.id },
          data: { montantPaye: totalPaye, statutPaiement: nouveauStatut }
        })
      }

      if (estModeEspeces(modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId: Number(magasinId),
          type: 'SORTIE',
          motif: `Paiement fournisseur : ${fournisseur.nom || ''}`,
          montant,
          utilisateurId: session.userId,
          entiteId,
          date: dateReglement,
        }, tx)
        await recalculerSoldeCaisse(Number(magasinId), tx)
      } else {
        const { enregistrerOperationBancaire, estModeBanque } = await import('@/lib/banque')
        if (estModeBanque(modePaiement)) {
          await enregistrerOperationBancaire({
            banqueId: banqueId ? Number(banqueId) : null,
            entiteId,
            date: dateReglement,
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Paiement fournisseur ${fournisseur.nom || ''}`,
            montant,
            utilisateurId: session.userId,
            reference: `CC-FOURN-${fournisseurId}-${Date.now()}`,
            beneficiaire: fournisseur.nom || null,
            observation: `Paiement via ${modePaiement}`
          }, tx)
        } else {
          console.warn(`[paiement fournisseur] Mode de paiement non géré pour trésorerie: ${modePaiement}`)
        }
      }

      return reglement
    }, { timeout: 20000 })

    return NextResponse.json({ success: true, reglementId: result.id })
  } catch (error) {
    console.error('POST /api/fournisseurs/[id]/compte-courant/paiement:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}