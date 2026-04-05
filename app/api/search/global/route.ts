import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const [produits, ventes, achats, clients, fournisseurs] = await Promise.all([
      // Recherche Produits
      prisma.produit.findMany({
        where: {
          OR: [
            { designation: { contains: q } },
            { code: { contains: q } }
          ]
        },
        take: 5,
        select: { id: true, designation: true, code: true }
      }),
      // Recherche Ventes
      prisma.vente.findMany({
        where: { numero: { contains: q } },
        take: 5,
        select: { id: true, numero: true, clientLibre: true, client: { select: { nom: true } } }
      }),
      // Recherche Achats
      prisma.achat.findMany({
        where: { numero: { contains: q } },
        take: 5,
        select: { id: true, numero: true, fournisseur: { select: { nom: true } } }
      }),
      // Recherche Clients
      prisma.client.findMany({
        where: {
          OR: [
            { nom: { contains: q } },
            { code: { contains: q } }
          ]
        },
        take: 5,
        select: { id: true, nom: true, code: true }
      }),
      // Recherche Fournisseurs
      prisma.fournisseur.findMany({
        where: {
          OR: [
            { nom: { contains: q } },
            { code: { contains: q } }
          ]
        },
        take: 5,
        select: { id: true, nom: true, code: true }
      })
    ])

    const results = [
      ...produits.map(p => ({ type: 'PRODUIT', title: p.designation, subtitle: p.code, link: `/dashboard/rapports-inventaire/produit-historique/${p.id}` })),
      ...ventes.map(v => ({ type: 'VENTE', title: `Vente ${v.numero}`, subtitle: v.client?.nom || v.clientLibre, link: `/dashboard/ventes` })),
      ...achats.map(a => ({ type: 'ACHAT', title: `Achat ${a.numero}`, subtitle: a.fournisseur?.nom || 'N/A', link: `/dashboard/achats` })),
      ...clients.map(c => ({ type: 'CLIENT', title: c.nom, subtitle: c.code, link: `/dashboard/clients/soldes/${c.id}` })),
      ...fournisseurs.map(f => ({ type: 'FOURNISSEUR', title: f.nom, subtitle: f.code, link: `/dashboard/fournisseurs/soldes/${f.id}` }))
    ]

    return NextResponse.json({ results })
  } catch (e: any) {
    console.error('Search API Error:', e)
    return NextResponse.json({ error: 'Erreur recherche' }, { status: 500 })
  }
}
