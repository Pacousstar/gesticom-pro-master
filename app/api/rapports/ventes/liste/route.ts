import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')
  const dateFin = searchParams.get('dateFin')

  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'Les dates de début et de fin sont requises.' }, { status: 400 })
  }

  const dateDebutParsed = new Date(dateDebut + 'T00:00:00')
  const dateFinParsed = new Date(dateFin + 'T23:59:59')
  if (isNaN(dateDebutParsed.getTime()) || isNaN(dateFinParsed.getTime())) {
    return NextResponse.json({ error: 'Format de date invalide.' }, { status: 400 })
  }
  if (dateDebutParsed > dateFinParsed) {
    return NextResponse.json({ error: 'La date de début doit être antérieure à la date de fin.' }, { status: 400 })
  }

  const where: any = {
    entiteId,
    statut: { in: ['VALIDE', 'VALIDEE'] },
    date: {
      gte: dateDebutParsed,
      lte: dateFinParsed,
    },
  }

  try {
    const ventes = await prisma.vente.findMany({
      where,
      include: {
        client: { select: { nom: true, code: true } },
        utilisateur: { select: { nom: true } },
        magasin: { select: { nom: true } },
        lignes: { select: { designation: true } },
        reglements: { select: { id: true, modePaiement: true } },
        ReglementVenteLigne: { select: { reglementId: true, montant: true } },
      },
      orderBy: { date: 'desc' },
    })

    const formatted = ventes.map(v => {
      const creditReglementIds = new Set(
        (v.reglements || [])
          .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
          .map(r => r.id)
      )
      const totalLignePaye = (v.ReglementVenteLigne || [])
        .filter(l => !creditReglementIds.has(l.reglementId))
        .reduce((s, l) => s + (l.montant || 0), 0)
      const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (v.montantPaye || 0)

      return {
        id: v.id,
        numero: v.numero,
        date: v.date,
        client: v.client?.nom || v.clientLibre || 'Client Comptant',
        montantTotal: v.montantTotal,
        montantPaye: realMontantPaye,
        statutPaiement: v.statutPaiement,
        modePaiement: v.modePaiement,
        vendeur: v.utilisateur?.nom || 'Inconnu',
        magasin: v.magasin.nom,
        produits: v.lignes.map(l => l.designation).join(', ')
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('GET /api/rapports/ventes/liste:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}