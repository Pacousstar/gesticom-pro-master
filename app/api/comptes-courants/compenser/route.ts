import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const id = Number(body.id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const entiteId = await getEntiteId(session)

  const cc = await prisma.compteCourant.findUnique({
    where: { id },
    include: { client: true, fournisseur: true },
  })
  if (!cc) return NextResponse.json({ error: 'Compte courant introuvable.' }, { status: 404 })
  if (cc.entiteId !== entiteId) return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })

  const [totalAchats, totalPaiements, totalVentes, totalEncaissements] = await Promise.all([
    prisma.achat.aggregate({
      where: { fournisseurId: cc.fournisseurId!, statut: { not: 'ANNULEE' } },
      _sum: { montantTotal: true },
    }).then(r => r._sum.montantTotal || 0).catch(() => 0),
    prisma.reglementAchat.aggregate({
      where: { fournisseurId: cc.fournisseurId!, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      _sum: { montant: true },
    }).then(r => r._sum.montant || 0).catch(() => 0),
    prisma.vente.aggregate({
      where: { clientId: cc.clientId!, statut: { not: 'ANNULEE' } },
      _sum: { montantTotal: true },
    }).then(r => r._sum.montantTotal || 0).catch(() => 0),
    prisma.reglementVente.aggregate({
      where: { clientId: cc.clientId!, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      _sum: { montant: true },
    }).then(r => r._sum.montant || 0).catch(() => 0),
  ])

  const detteNette = totalAchats - totalPaiements
  const creanceNette = totalVentes - totalEncaissements
  const soldeNet = creanceNette - detteNette

  if (Math.abs(soldeNet) < 1) {
    return NextResponse.json({ message: 'Solde déjà équilibré.', soldeNet })
  }

  // Vérifier qu'une compensation n'existe pas déjà
  const existingComp = await prisma.ecritureComptable.findFirst({
    where: { referenceType: 'COMPENSATION_CC', referenceId: cc.id },
  })
  if (existingComp) {
    return NextResponse.json({
      message: `Une compensation a déjà été enregistrée pour ce compte courant (Réf: ${existingComp.reference}). Annulez-la d'abord.`,
      existingReference: existingComp.reference,
    }, { status: 409 })
  }

  // Montant compensable = min(detteNette, creanceNette)
  const montantCompensable = Math.min(detteNette, creanceNette)

  if (montantCompensable < 1) {
    // Pas de compensation possible (une seule direction)
    return NextResponse.json({
      soldeNet,
      detail: { totalAchats, totalPaiements, detteNette, totalVentes, totalEncaissements, creanceNette },
      message: `Aucune compensation possible. ${soldeNet > 0 ? `Créance nette de ${soldeNet.toLocaleString()} FCFA sur ${cc.nom}.` : `Dette nette de ${Math.abs(soldeNet).toLocaleString()} FCFA envers ${cc.nom}.`}`,
    })
  }

  // Création de l'écriture comptable de compensation
  const result = await prisma.$transaction(async (tx: any) => {
    const journalOD = await tx.journal.findFirst({ where: { code: 'OD' } })
    if (!journalOD) throw new Error('Journal OD introuvable.')

    const compteFournisseur = await tx.planCompte.findFirst({ where: { numero: '401' } })
    const compteClient = await tx.planCompte.findFirst({ where: { numero: '411' } })
    if (!compteFournisseur || !compteClient) {
      throw new Error('Comptes 401 ou 411 introuvables dans le plan comptable.')
    }

    const numeroEcriture = `COMP-CC-${cc.id}-${Date.now()}`

    // 1. Débit 401 (réduit la dette fournisseur)
    await tx.ecritureComptable.create({
      data: {
        date: new Date(),
        journalId: journalOD.id,
        piece: cc.code,
        libelle: `Compensation CC ${cc.nom}`,
        compteId: compteFournisseur.id,
        debit: montantCompensable,
        credit: 0,
        reference: numeroEcriture,
        referenceType: 'COMPENSATION_CC',
        referenceId: cc.id,
        utilisateurId: session!.userId,
        entiteId,
      },
    })

    // 2. Crédit 411 (réduit la créance client)
    await tx.ecritureComptable.create({
      data: {
        date: new Date(),
        journalId: journalOD.id,
        piece: cc.code,
        libelle: `Compensation CC ${cc.nom}`,
        compteId: compteClient.id,
        debit: 0,
        credit: montantCompensable,
        reference: numeroEcriture,
        referenceType: 'COMPENSATION_CC',
        referenceId: cc.id,
        utilisateurId: session!.userId,
        entiteId,
      },
    })

    return { numeroEcriture, montantCompensable }
  })

  return NextResponse.json({
    success: true,
    soldeNet,
    montantCompensable: result.montantCompensable,
    detail: { totalAchats, totalPaiements, detteNette, totalVentes, totalEncaissements, creanceNette },
    message: `Compensation de ${result.montantCompensable.toLocaleString()} FCFA enregistrée (Réf: ${result.numeroEcriture}). ${soldeNet > 0 ? `Reste dû par ${cc.nom} : ${soldeNet.toLocaleString()} FCFA.` : `Reste dû à ${cc.nom} : ${Math.abs(soldeNet).toLocaleString()} FCFA.`}`,
  })
}
