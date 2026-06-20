import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { lettrageSchema } from '@/lib/validations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'ventes:edit')
  if (authError) return authError

  const clientId = Number((await params).id)
  if (!Number.isInteger(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'ID client invalide.' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const validation = validateApiRequest(lettrageSchema, body)
    if (!validation.success) return validation.response
    const reglementIds: number[] = body.reglementIds || []

    if (!reglementIds.length) {
      return NextResponse.json({ error: 'Sélectionnez au moins un règlement.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const reglements = await tx.reglementVente.findMany({
        where: { id: { in: reglementIds }, clientId, entiteId, venteId: null },
        include: { ReglementVenteLigne: { select: { montant: true } } }
      })

      if (!reglements.length) throw new Error('Aucun règlement disponible trouvé.')

      let totalPool = 0
      const pool: { id: number; restant: number }[] = []

      for (const r of reglements) {
        const dejaAlloue = (r.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const restant = Math.max(0, r.montant - dejaAlloue)
        if (restant > 0.01) {
          totalPool += restant
          pool.push({ id: r.id, restant })
        }
      }

      if (totalPool <= 0.01) throw new Error('Aucun montant disponible dans les règlements sélectionnés.')

      const ventes = await tx.vente.findMany({
        where: {
          clientId,
          entiteId,
          statut: { in: ['VALIDE', 'VALIDEE'] },
          statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
        },
        orderBy: { date: 'asc' },
        select: { id: true, montantTotal: true, montantPaye: true, numero: true, ReglementVenteLigne: { select: { montant: true } } }
      })

      if (!ventes.length) throw new Error('Aucune facture impayée trouvée pour ce client.')

      let resteAPooler = totalPool
      const allocations: { reglementId: number; venteId: number; montant: number }[] = []

      for (const vente of ventes) {
        if (resteAPooler <= 0.01) break

        const totalLignePaye = (vente.ReglementVenteLigne || []).reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const montantDu = Math.max(0, (vente.montantTotal || 0) - totalLignePaye)
        const montantARegler = Math.min(montantDu, resteAPooler)

        if (montantARegler <= 0.01) continue

        let aAllouer = montantARegler
        for (const p of pool) {
          if (aAllouer <= 0.01) break
          if (p.restant <= 0.01) continue

          const part = Math.min(p.restant, aAllouer)
          allocations.push({ reglementId: p.id, venteId: vente.id, montant: part })
          p.restant -= part
          aAllouer -= part
        }

        const nouveauPaye = totalLignePaye + montantARegler
        const nouveauStatut = nouveauPaye >= (vente.montantTotal || 0) - 0.01 ? 'PAYE' : 'PARTIEL'

        await tx.vente.update({
          where: { id: vente.id },
          data: { montantPaye: nouveauPaye, statutPaiement: nouveauStatut }
        })

        resteAPooler -= montantARegler
      }

      for (const alloc of allocations) {
        const exists = await tx.reglementVenteLigne.findFirst({
          where: { reglementId: alloc.reglementId, venteId: alloc.venteId }
        })
        if (!exists) {
          await tx.reglementVenteLigne.create({ data: alloc })
        }
      }

      for (const p of pool) {
        const reg = reglements.find(r => r.id === p.id)
        if (reg && p.restant < reg.montant) {
          if (!reg.venteId) {
            await tx.reglementVente.update({
              where: { id: p.id },
              data: { venteId: allocations.find(a => a.reglementId === p.id)?.venteId || null }
            })
          }
        }
      }

      return { totalAlloue: totalPool - resteAPooler, reste: Math.max(0, resteAPooler), facturesReglees: [...new Set(allocations.map(a => a.venteId))].length }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    await apiCatch(e, 'api/clients/[id]/regroupement-lettrage')
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
