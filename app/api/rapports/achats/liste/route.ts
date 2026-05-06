import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = await getEntiteId(session)
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
    entiteId,
    statut: { in: ['VALIDE', 'VALIDEE'] },
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
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    })

    const formatted = achats.map(a => ({
      id: a.id,
      numero: a.numero,
      date: a.date,
      fournisseur: a.fournisseur?.nom || a.fournisseurLibre || 'Fournisseur Inconnu',
      montantTotal: a.montantTotal,
      montantPaye: a.montantPaye,
      statutPaiement: a.statutPaiement,
      modePaiement: a.modePaiement,
      acheteur: a.utilisateur?.nom || 'Inconnu',
      magasin: a.magasin.nom,
      produits: a.lignes.map(l => l.designation).join(', ')
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('GET /api/rapports/achats/liste:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
