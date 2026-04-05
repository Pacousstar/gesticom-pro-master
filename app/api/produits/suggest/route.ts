import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/produits/suggest?designation=xxx
 * À partir de la désignation (ou début de désignation), retourne un code et une catégorie
 * suggérés en s'appuyant sur les produits dont la désignation est proche en base.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const designation = String(request.nextUrl.searchParams.get('designation') || '').trim()
  if (designation.length < 2) {
    return NextResponse.json({ code: null, categorie: null })
  }

  try {
    const term = designation.slice(0, 50).replace(/%/g, '')
    const pattern = '%' + term.toLowerCase() + '%'
    const similaires = await prisma.$queryRaw<
      { code: string; designation: string | null; categorie: string | null }[]
    >`
      SELECT code, designation, categorie FROM Produit
      WHERE actif = 1 AND LOWER(designation) LIKE ${pattern}
      LIMIT 100
    `

    if (similaires.length === 0) {
      return NextResponse.json({ code: null, categorie: null })
    }

    // Catégorie la plus fréquente parmi les produits similaires
    const countByCat: Record<string, number> = {}
    for (const p of similaires) {
      const c = (p.categorie ?? '').trim() || 'DIVERS'
      countByCat[c] = (countByCat[c] ?? 0) + 1
    }
    const categorie =
      Object.entries(countByCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'DIVERS'

    // Code suggéré : prochain code pour cette catégorie (même logique que next-code)
    const prefix = categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'DIVE'
    const produitsCat = await prisma.produit.findMany({
      where: { categorie, actif: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    })
    let maxNum = 0
    for (const p of produitsCat) {
      const code = p.code.toUpperCase()
      const match = code.match(/^([A-Za-z\-]*)(\d+)$/)
      if (match) {
        const num = parseInt(match[2], 10)
        if (!Number.isNaN(num)) maxNum = Math.max(maxNum, num)
      }
    }
    const code = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`

    return NextResponse.json({ code, categorie })
  } catch (e) {
    console.error('GET /api/produits/suggest:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
