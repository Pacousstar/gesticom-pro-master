import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { comptabiliserOperationBancaire } from '@/lib/comptabilisation'
import { verifierCloture } from '@/lib/cloture'
import { requirePermission } from '@/lib/require-role'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:create')
  if (authError) return authError

  try {
    const entiteId = await getEntiteId(session)
    const { rapprochement } = await request.json()
    const { banqueId, reglementId, type, libelle, montant, date } = rapprochement

    if (!banqueId || !reglementId || !type) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // RB3: Vérifier que la banque appartient à l'entité de l'utilisateur
    const banque = await prisma.banque.findUnique({ where: { id: Number(banqueId) } })
    if (!banque) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }
    if (session.role !== 'SUPER_ADMIN' && banque.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // RB6: Vérifier la clôture comptable
    await verifierCloture(new Date(date), session)

    // RB2 + RB7 + RB8: Transaction atomique avec registerOperationBancaire
    const result = await prisma.$transaction(async (tx) => {
      // 1. Marquer le règlement comme rapproché
      if (type === 'VENTE') {
        await tx.reglementVente.update({
          where: { id: reglementId },
          data: { rapproche: true }
        })
      } else if (type === 'ACHAT') {
        await tx.reglementAchat.update({
          where: { id: reglementId },
          data: { rapproche: true }
        })
      }

      // 2. Vérifier si une opération similaire existe déjà pour éviter les doublons
      const typeOpBancaire = type === 'VENTE' ? 'VIREMENT_ENTRANT' : 'VIREMENT_SORTANT'
      const exists = await tx.operationBancaire.findFirst({
        where: {
          banqueId: Number(banqueId),
          type: typeOpBancaire,
          reference: `RAP-${reglementId}`
        }
      })

      if (exists) {
        return { success: true, existing: true }
      }

      // RB2: Utiliser enregistrerOperationBancaire (montant toujours positif, direction via type)
      const operation = await enregistrerOperationBancaire({
        banqueId: Number(banqueId),
        entiteId: banque.entiteId,
        date: new Date(date),
        type: typeOpBancaire,
        libelle: `Rapprochement: ${libelle}`,
        montant: Math.abs(Number(montant)),
        utilisateurId: session.userId,
        reference: `RAP-${reglementId}`
      }, tx)

      if (!operation) {
        throw new Error('Erreur lors de l\'enregistrement de l\'opération de rapprochement.')
      }

      // RB8: Comptabiliser l'opération de rapprochement
      await comptabiliserOperationBancaire({
        operationId: operation.id,
        banqueId: Number(banqueId),
        date: new Date(date),
        type: typeOpBancaire,
        montant: Math.abs(Number(montant)),
        libelle: `Rapprochement: ${libelle}`,
        compteId: banque.compteId,
        utilisateurId: session.userId,
        entiteId: banque.entiteId,
      }, tx)

      return { success: true, operationId: operation.id }
    }, { timeout: 20000 })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Save Rapprochement Error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 })
  }
}