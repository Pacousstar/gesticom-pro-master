import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const maintenanceEnabled = process.env.ENABLE_DANGEROUS_MAINTENANCE === 'true'
  if (process.env.NODE_ENV === 'production' && !maintenanceEnabled) {
    return NextResponse.json({ error: 'Route de maintenance désactivée en production.' }, { status: 403 })
  }
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  }

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  const results = {
    ventesLignesCreees: 0,
    achatsLignesCreees: 0,
    ventesRecalculees: 0,
    achatsRecalcules: 0,
    montantPayeCorrige: 0,
    errors: [] as string[],
  }

  try {
    const reglementsVenteSansLigne = await prisma.reglementVente.findMany({
      where: {
        venteId: { not: null },
        entiteId,
        statut: { in: ['VALIDE', 'VALIDEE'] },
        ReglementVenteLigne: { none: {} },
      },
      select: { id: true, venteId: true, montant: true },
    })

    for (const reg of reglementsVenteSansLigne) {
      try {
        await prisma.reglementVenteLigne.create({
          data: { reglementId: reg.id, venteId: reg.venteId!, montant: reg.montant },
        })
        results.ventesLignesCreees++
      } catch (e: any) {
        results.errors.push(`ReglementVente ${reg.id}: ${e.message}`)
      }
    }

    const reglementsAchatSansLigne = await prisma.reglementAchat.findMany({
      where: {
        achatId: { not: null },
        entiteId,
        statut: { in: ['VALIDE', 'VALIDEE'] },
        ReglementAchatLigne: { none: {} },
      },
      select: { id: true, achatId: true, montant: true },
    })

    for (const reg of reglementsAchatSansLigne) {
      try {
        await prisma.reglementAchatLigne.create({
          data: { reglementId: reg.id, achatId: reg.achatId!, montant: reg.montant },
        })
        results.achatsLignesCreees++
      } catch (e: any) {
        results.errors.push(`ReglementAchat ${reg.id}: ${e.message}`)
      }
    }

    const ventes = await prisma.vente.findMany({
      where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true },
    })

    for (const v of ventes) {
      try {
        const [lignes, directRegs] = await Promise.all([
          prisma.reglementVenteLigne.aggregate({
            where: { venteId: v.id },
            _sum: { montant: true },
          }),
          prisma.reglementVente.aggregate({
            where: { venteId: v.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
            _sum: { montant: true },
          }),
        ])

        const totalFromLignes = lignes._sum?.montant || 0
        const totalFromDirect = directRegs._sum?.montant || 0
        const totalPaye = Math.max(totalFromLignes, totalFromDirect)
        const ancienPaye = v.montantPaye || 0

        const nouveauStatut =
          totalPaye >= v.montantTotal - 0.5 ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'

        if (Math.abs(totalPaye - ancienPaye) > 0.5) {
          await prisma.vente.update({
            where: { id: v.id },
            data: { montantPaye: totalPaye, statutPaiement: nouveauStatut },
          })
          results.ventesRecalculees++
          results.montantPayeCorrige += Math.abs(totalPaye - ancienPaye)
        }
      } catch (e: any) {
        results.errors.push(`Vente ${v.id}: ${e.message}`)
      }
    }

    const achats = await prisma.achat.findMany({
      where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
      select: { id: true, montantTotal: true, montantPaye: true },
    })

    for (const a of achats) {
      try {
        const [lignes, directRegs] = await Promise.all([
          prisma.reglementAchatLigne.aggregate({
            where: { achatId: a.id },
            _sum: { montant: true },
          }),
          prisma.reglementAchat.aggregate({
            where: { achatId: a.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
            _sum: { montant: true },
          }),
        ])

        const totalFromLignes = lignes._sum?.montant || 0
        const totalFromDirect = directRegs._sum?.montant || 0
        const totalPaye = Math.max(totalFromLignes, totalFromDirect)
        const ancienPaye = a.montantPaye || 0

        const nouveauStatut =
          totalPaye >= a.montantTotal - 0.5 ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'

        if (Math.abs(totalPaye - ancienPaye) > 0.5) {
          await prisma.achat.update({
            where: { id: a.id },
            data: { montantPaye: totalPaye, statutPaiement: nouveauStatut },
          })
          results.achatsRecalcules++
          results.montantPayeCorrige += Math.abs(totalPaye - ancienPaye)
        }
      } catch (e: any) {
        results.errors.push(`Achat ${a.id}: ${e.message}`)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Synchronisation terminée : ${results.ventesLignesCreees} lignes vente créées, ${results.achatsLignesCreees} lignes achat créées, ${results.ventesRecalculees} ventes corrigées, ${results.achatsRecalcules} achats corrigés, ${results.montantPayeCorrige} F d'écart résolu.`,
      results,
    })
  } catch (error: any) {
    console.error('Sync Paiements Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la synchronisation.', details: error.message }, { status: 500 })
  }
}