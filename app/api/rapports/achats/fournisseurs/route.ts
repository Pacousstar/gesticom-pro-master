import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'rapports:view')
    if (forbidden) return forbidden

    try {
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start') ?? searchParams.get('dateDebut')
        const end = searchParams.get('end') ?? searchParams.get('dateFin')
        
        const entiteId = session.entiteId
        const where: any = { 
            statut: { in: ['VALIDE', 'VALIDEE'] } 
        }

        if (entiteId && session.role !== 'SUPER_ADMIN') {
            where.entiteId = entiteId
        }

        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            where.date = { gte: new Date(start), lte: endDate }
        }

        const fournisseurWhere: any = session.role !== 'SUPER_ADMIN' && entiteId ? { entiteId } : {}
        const fournisseurs = await prisma.fournisseur.findMany({
            where: fournisseurWhere,
            select: { id: true, code: true, nom: true, telephone: true }
        })
        const fournisseurMap = new Map(fournisseurs.map(f => [f.id, f]))

        const achats = await prisma.achat.findMany({
            where,
            include: {
                reglements: { select: { id: true, modePaiement: true } },
                ReglementAchatLigne: { select: { reglementId: true, montant: true } },
            }
        })

        const groupMap = new Map<string, { fournisseurId: number | null; fournisseurLibre: string | null; montantTotal: number; montantPaye: number; nombreAchats: number }>()

        for (const a of achats) {
            const creditReglementIds = new Set(
                (a.reglements || [])
                    .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
                    .map(r => r.id)
            )
            const totalLignePaye = (a.ReglementAchatLigne || [])
                .filter(l => !creditReglementIds.has(l.reglementId))
                .reduce((s, l) => s + (l.montant || 0), 0)
            const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (a.montantPaye || 0)

            const key = a.fournisseurId ? `f${a.fournisseurId}` : `l${a.fournisseurLibre || ''}`
            if (!groupMap.has(key)) {
                groupMap.set(key, { fournisseurId: a.fournisseurId, fournisseurLibre: a.fournisseurLibre, montantTotal: 0, montantPaye: 0, nombreAchats: 0 })
            }
            const g = groupMap.get(key)!
            g.montantTotal += a.montantTotal || 0
            g.montantPaye += realMontantPaye
            g.nombreAchats++
        }

        const data = Array.from(groupMap.values()).map(a => {
            let nom = a.fournisseurLibre || 'Fournisseur Divers'
            if (a.fournisseurId && fournisseurMap.has(a.fournisseurId)) {
                nom = fournisseurMap.get(a.fournisseurId)!.nom
            }
            const total = a.montantTotal
            const paye = a.montantPaye
            return {
                fournisseurId: a.fournisseurId,
                fournisseur: nom,
                code: a.fournisseurId && fournisseurMap.has(a.fournisseurId) ? fournisseurMap.get(a.fournisseurId)!.code : null,
                montantTotal: total,
                montantPaye: paye,
                resteAPayer: total - paye,
                nombreAchats: a.nombreAchats,
            }
        })

        const aggregated = Array.from(data.reduce((acc, curr) => {
            const existing = acc.get(curr.fournisseur)
            if (existing) {
                existing.montantTotal += curr.montantTotal
                existing.montantPaye += curr.montantPaye
                existing.resteAPayer += curr.resteAPayer
                existing.nombreAchats += curr.nombreAchats
            } else {
                acc.set(curr.fournisseur, { ...curr })
            }
            return acc
        }, new Map<string, typeof data[0]>()).values())

        aggregated.sort((a, b) => b.montantTotal - a.montantTotal)

        return NextResponse.json(aggregated, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        await apiCatch(error, 'api/rapports/achats/fournisseurs')
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
