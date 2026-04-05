import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

const LIMIT = 10
const PRODUITS_LIMIT = 100 // Limite plus élevée pour les produits

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const q = String(request.nextUrl.searchParams.get('q') || '').trim()
  const typeFilter = request.nextUrl.searchParams.get('type') || 'all'

  if (!q) {
    return NextResponse.json({ produits: [], clients: [], fournisseurs: [], ventes: [] })
  }

  const entiteIdFilter = session.role !== 'SUPER_ADMIN' ? await getEntiteId(session) : null
  const queries: Promise<unknown>[] = []

  if (typeFilter === 'all' || typeFilter === 'produits') {
    queries.push(
      prisma.produit.findMany({
        where: {
          actif: true,
          OR: [
            { code: { contains: q } },
            { designation: { contains: q } },
            { categorie: { contains: q } },
          ],
        },
        orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
        take: PRODUITS_LIMIT,
        select: { id: true, code: true, designation: true, categorie: true, prixVente: true, prixAchat: true },
      })
    )
  } else {
    queries.push(Promise.resolve([]))
  }

  if (typeFilter === 'all' || typeFilter === 'clients') {
    queries.push(
      prisma.client.findMany({
        where: {
          actif: true,
          OR: [
            { nom: { contains: q } },
            { telephone: { contains: q } },
            { ncc: { contains: q } },
          ],
        },
        orderBy: { nom: 'asc' },
        take: LIMIT,
        select: { id: true, nom: true, telephone: true, type: true, ncc: true },
      })
    )
  } else {
    queries.push(Promise.resolve([]))
  }

  if (typeFilter === 'all' || typeFilter === 'fournisseurs') {
    queries.push(
      prisma.fournisseur.findMany({
        where: {
          actif: true,
          OR: [
            { nom: { contains: q } },
            { telephone: { contains: q } },
            { email: { contains: q } },
            { ncc: { contains: q } },
          ],
        },
        orderBy: { nom: 'asc' },
        take: LIMIT,
        select: { id: true, nom: true, telephone: true, email: true, ncc: true },
      })
    )
  } else {
    queries.push(Promise.resolve([]))
  }

  if (typeFilter === 'all' || typeFilter === 'ventes') {
    const whereVentes: { numero: { contains: string }; entiteId?: number } = { numero: { contains: q } }
    if (entiteIdFilter != null) whereVentes.entiteId = entiteIdFilter
    queries.push(
      prisma.vente.findMany({
        where: whereVentes,
        orderBy: { date: 'desc' },
        take: LIMIT,
        select: {
          id: true,
          numero: true,
          date: true,
          montantTotal: true,
          statut: true,
          magasin: { select: { code: true } },
        },
      })
    )
  } else {
    queries.push(Promise.resolve([]))
  }

  const [produits, clients, fournisseurs, ventes] = await Promise.all(queries)

  return NextResponse.json({ produits, clients, fournisseurs, ventes })
}
