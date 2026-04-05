import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const entiteId = session.entiteId
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  const typeRecherche = request.nextUrl.searchParams.get('type') // "CLIENT" | "FOURNISSEUR"

  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: 'Période requise' }, { status: 400 })
  }

  const deb = new Date(dateDebut + 'T00:00:00')
  const fin = new Date(dateFin + 'T23:59:59')

  try {
    if (typeRecherche === 'CLIENT') {
      const summary = await prisma.reglementVente.groupBy({
        by: ['modePaiement'],
        where: {
          date: { gte: deb, lte: fin },
          // Filtrage par entité via la vente ou l'utilisateur créateur (plus sûr)
          // Note: Si venteId est null, on se rabat sur le magasin du règlement via l'utilisateur
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
            utilisateur: { entiteId }
          } : {}),
        },
        _sum: { montant: true },
        _count: { id: true }
      })

      const transactions = await prisma.reglementVente.findMany({
        where: {
          date: { gte: deb, lte: fin },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
            utilisateur: { entiteId }
          } : {}),
        },
        include: { 
          client: { select: { nom: true } },
          vente: { select: { numero: true } }
        },
        orderBy: { date: 'desc' }
      })

      // Formater pour garder la compatibilité avec le frontend
      const formattedSummary = summary.map(s => ({
        modePaiement: s.modePaiement,
        _sum: { montantPaye: s._sum.montant },
        _count: { id: s._count.id }
      }))

      const formattedTransactions = transactions.map(t => ({
        id: t.id,
        date: t.date,
        montantPaye: t.montant,
        modePaiement: t.modePaiement,
        client: { nom: t.client?.nom || 'Client Inconnu' },
        numero: t.vente?.numero || 'ACOMPTE LIBRE',
        observation: t.observation
      }))

      return NextResponse.json({ summary: formattedSummary, transactions: formattedTransactions })
    } else {
      const summary = await prisma.reglementAchat.groupBy({
        by: ['modePaiement'],
        where: {
          date: { gte: deb, lte: fin },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
            utilisateur: { entiteId }
          } : {}),
        },
        _sum: { montant: true },
        _count: { id: true }
      })

      const transactions = await prisma.reglementAchat.findMany({
        where: {
          date: { gte: deb, lte: fin },
          ...(entiteId && session.role !== 'SUPER_ADMIN' ? {
            utilisateur: { entiteId }
          } : {}),
        },
        include: { 
          fournisseur: { select: { nom: true } },
          achat: { select: { numero: true } }
        },
        orderBy: { date: 'desc' }
      })

       const formattedSummary = summary.map(s => ({
        modePaiement: s.modePaiement,
        _sum: { montantPaye: s._sum.montant },
        _count: { id: s._count.id }
      }))

      const formattedTransactions = transactions.map(t => ({
        id: t.id,
        date: t.date,
        montantPaye: t.montant,
        modePaiement: t.modePaiement,
        fournisseur: { nom: t.fournisseur?.nom || 'Fournisseur Inconnu' },
        numero: t.achat?.numero || 'Paiement Libre',
        observation: t.observation
      }))

      return NextResponse.json({ summary: formattedSummary, transactions: formattedTransactions })
    }
  } catch (error) {
    console.error('Erreur Rapport Paiements:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des paiements' }, { status: 500 })
  }
}
