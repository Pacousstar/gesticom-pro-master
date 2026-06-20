import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const forbidden = requirePermission(session, 'rapports:view')
    if (forbidden) return forbidden

    try {
        const id = (await params).id
        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')

        if (id === 'null' || id === 'undefined' || Number.isNaN(Number(id))) {
            return NextResponse.json({ error: 'ID Fournisseur requis pour l\'historique' }, { status: 400 })
        }

        const fournisseurId = Number(id)
        const tier = await prisma.fournisseur.findUnique({
            where: { id: fournisseurId },
            select: { id: true, nom: true, code: true },
        })
        if (!tier) {
            return NextResponse.json([], { headers: { 'Cache-Control': 'no-store, max-age=0' } })
        }

        const entiteCur = await getEntiteId(session)

        const conditions: any[] = [
          { statut: { in: ['VALIDE', 'VALIDEE'] } }
        ]

        // Condition fournisseur
        if (tier.nom) {
            conditions.push({
                OR: [
                    { fournisseurId },
                    { fournisseurLibre: tier.nom.trim() }
                ]
            })
        } else {
            conditions.push({ fournisseurId })
        }

        // Condition entité
        if (entiteCur > 0) {
            conditions.push({ entiteId: entiteCur })
        }

        // Condition dates
        if (start && end) {
            const endDate = new Date(end)
            endDate.setHours(23, 59, 59, 999)
            conditions.push({ date: { gte: new Date(start), lte: endDate } })
        }

        const where = { AND: conditions }

        const achats = await prisma.achat.findMany({
            where,
            orderBy: { date: 'desc' },
            select: {
                id: true,
                numero: true,
                date: true,
                montantTotal: true,
                montantPaye: true,
                modePaiement: true,
                statut: true,
                statutPaiement: true,
                magasin: { select: { nom: true } },
                lignes: {
                    select: {
                        designation: true,
                        quantite: true,
                        prixUnitaire: true,
                    }
                },
                reglements: { select: { id: true, modePaiement: true } },
                ReglementAchatLigne: { select: { reglementId: true, montant: true } },
            }
        })

        const formatted = achats.map(a => {
            const creditReglementIds = new Set(
                (a.reglements || [])
                    .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
                    .map(r => r.id)
            )
            const totalLignePaye = (a.ReglementAchatLigne || [])
                .filter(l => !creditReglementIds.has(l.reglementId))
                .reduce((s, l) => s + (l.montant || 0), 0)
            const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (a.montantPaye || 0)

            return {
                id: a.id,
                numero: a.numero,
                date: a.date,
                montantTotal: a.montantTotal,
                montantPaye: realMontantPaye,
                modePaiement: a.modePaiement,
                statut: a.statut,
                statutPaiement: a.statutPaiement,
                magasin: a.magasin,
                lignes: a.lignes,
            }
        })

        return NextResponse.json(formatted, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        })
    } catch (error) {
        await apiCatch(error, 'api/rapports/achats/fournisseurs/[id]/history')
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
