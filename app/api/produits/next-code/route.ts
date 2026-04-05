import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/produits/next-code?categorie=BOISSONS
 * Retourne un code suggéré pour un nouveau produit de la catégorie donnée,
 * basé sur les codes existants de la même catégorie (ex. BOIS-001, BOIS-002 → BOIS-003).
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const categorie = String(request.nextUrl.searchParams.get('categorie') || '').trim() || 'DIVERS'

  const produits = await prisma.produit.findMany({
    where: { categorie },
    select: { code: true },
    orderBy: { code: 'asc' },
  })

  const prefix = categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'DIVE'
  let maxNum = 0
  for (const p of produits) {
    const code = p.code.toUpperCase()
    const match = code.match(/^([A-Za-z\-]*)(\d+)$/)
    if (match) {
      const num = parseInt(match[2], 10)
      if (!Number.isNaN(num)) maxNum = Math.max(maxNum, num)
    }
  }
  const nextCode = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`

  return NextResponse.json({ nextCode, categorie })
}
