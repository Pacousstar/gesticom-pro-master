import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const entiteId = await getEntiteId(session)
  const magasinId = searchParams.get('magasinId') ? Number(searchParams.get('magasinId')) : undefined
  const categorie = searchParams.get('categorie') || undefined
  const fournisseurId = searchParams.get('fournisseurId') ? Number(searchParams.get('fournisseurId')) : undefined
  const search = searchParams.get('search')?.trim() || ''

  const produits = await prisma.produit.findMany({
    where: {
      entiteId,
      actif: true,
      ...(categorie ? { categorie } : {}),
      ...(fournisseurId ? { fournisseurId } : {}),
      ...(search ? {
        OR: [
          { code: { contains: search } },
          { designation: { contains: search } },
        ]
      } : {}),
    },
    include: {
      stocks: true,
      fournisseur: { select: { id: true, nom: true } },
      ventesLignes: {
        select: { quantite: true, vente: { select: { date: true } } },
        orderBy: { vente: { date: 'desc' } },
        take: 90,
      },
    },
  })

  const suggestions = produits.map(p => {
    const stockTotal = p.stocks.reduce((s, st) => s + st.quantite, 0)
    const stockParMagasin = magasinId
      ? { [magasinId]: p.stocks.find(st => st.magasinId === magasinId)?.quantite ?? 0 }
      : Object.fromEntries(p.stocks.map(st => [st.magasinId, st.quantite]))

    const stock = magasinId ? (stockParMagasin[magasinId] ?? 0) : stockTotal
    const seuil = p.seuilMin ?? 5

    if (stock > seuil) return null

    const ventes30j = p.ventesLignes
      .filter(l => {
        const diff = Date.now() - new Date(l.vente.date).getTime()
        return diff <= 30 * 24 * 60 * 60 * 1000
      })
      .reduce((s, l) => s + l.quantite, 0)

    const moyenneQuotidienne = ventes30j / 30
    const delaiReappro = 7
    const quantiteSuggeree = Math.max(
      Math.ceil(moyenneQuotidienne * delaiReappro * 1.5),
      seuil * 2 - stock,
      1
    )

    return {
      produitId: p.id,
      code: p.code,
      designation: p.designation,
      categorie: p.categorie,
      stock,
      seuil,
      stockParMagasin,
      prixAchat: p.prixAchat ?? 0,
      fournisseur: p.fournisseur,
      ventes30j,
      moyenneQuotidienne: Math.round(moyenneQuotidienne * 100) / 100,
      quantiteSuggeree,
      coutEstime: Math.round((p.prixAchat ?? 0) * quantiteSuggeree),
    }
  }).filter((s): s is NonNullable<typeof s> => s !== null)

  const magasins = await prisma.magasin.findMany({
    where: { entiteId },
    select: { id: true, code: true, nom: true },
  })

  const categories = [...new Set(produits.map(p => p.categorie).filter(Boolean))]

  return NextResponse.json({
    suggestions,
    magasins,
    categories,
    totalSousSeuil: suggestions.length,
    coutTotalEstime: suggestions.reduce((s, sg) => s + sg.coutEstime, 0),
    quantiteTotalSuggeree: suggestions.reduce((s, sg) => s + sg.quantiteSuggeree, 0),
  })
}
