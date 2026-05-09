import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  const designation = String(request.nextUrl.searchParams.get('designation') || '').trim()
  if (designation.length < 2) {
    return NextResponse.json({ code: null, categorie: null })
  }

  try {
    const term = designation.slice(0, 50).replace(/%/g, '').replace(/'/g, "''")
    const safeTerm = `%${term.toLowerCase()}%`

    const similaires = await prisma.$queryRaw<
      { code: string; designation: string | null; categorie: string | null }[]
    >`
      SELECT code, designation, categorie FROM Produit
      WHERE actif = 1 AND entiteId = ${entiteId}
        AND LOWER(designation) LIKE ${safeTerm}
      LIMIT 100
    `

    if (similaires.length === 0) {
      return NextResponse.json({ code: null, categorie: null })
    }

    const countByCat: Record<string, number> = {}
    for (const p of similaires) {
      const c = (p.categorie ?? '').trim() || 'DIVERS'
      countByCat[c] = (countByCat[c] ?? 0) + 1
    }
    const categorie =
      Object.entries(countByCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'DIVERS'

    const prefix = (categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'DIVE').replace(/[^A-Z0-9-]/g, '')
    const produitsCat = await prisma.produit.findMany({
      where: { categorie, actif: true, entiteId },
      select: { code: true },
      orderBy: { code: 'asc' },
    })
    let maxNum = 0
    for (const p of produitsCat) {
      const code = p.code.toUpperCase()
      const match = code.match(/^([A-Za-z-]*)(\d+)$/)
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