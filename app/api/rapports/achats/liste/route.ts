import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const forbidden = requirePermission(session, 'rapports:view')
  if (forbidden) return forbidden

  const entiteIdFilter = await getEntiteIdOrAll(session)
  const searchParams = request.nextUrl.searchParams
  const dateDebut = searchParams.get('dateDebut')?.trim()
  const dateFin = searchParams.get('dateFin')?.trim()

  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'Dates de début et fin requises.' }, { status: 400 })
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateDebut) || !dateRegex.test(dateFin)) {
    return NextResponse.json({ error: 'Format de date invalide. Utilisez YYYY-MM-DD.' }, { status: 400 })
  }

  if (new Date(dateDebut) > new Date(dateFin)) {
    return NextResponse.json({ error: 'La date de début doit être antérieure à la date de fin.' }, { status: 400 })
  }

  const where: any = {
    statut: { in: ['VALIDE', 'VALIDEE'] },
  }

  // Filtrage par entité (support SUPER_ADMIN)
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else {
    const entiteIdFromParams = searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }

  where.date = {
    gte: new Date(dateDebut + 'T00:00:00'),
    lte: new Date(dateFin + 'T23:59:59'),
  }

  try {
    const achats = await prisma.achat.findMany({
      where,
      include: {
        fournisseur: { select: { nom: true, code: true } },
        utilisateur: { select: { nom: true } },
        magasin: { select: { nom: true } },
        lignes: { select: { designation: true } },
        reglements: { select: { id: true, modePaiement: true } },
        ReglementAchatLigne: { select: { reglementId: true, montant: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
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
        fournisseur: a.fournisseur?.nom || a.fournisseurLibre || 'Fournisseur Inconnu',
        montantTotal: a.montantTotal,
        montantPaye: realMontantPaye,
        statutPaiement: a.statutPaiement,
        modePaiement: a.modePaiement,
        acheteur: a.utilisateur?.nom || 'Inconnu',
        magasin: a.magasin.nom,
        produits: a.lignes.map(l => l.designation).join(', ')
      }
    })

    return NextResponse.json(formatted)
  } catch (error) {
    await apiCatch(error, 'api/rapports/achats/liste')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
