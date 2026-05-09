import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const dbCats = await prisma.produit.groupBy({
      by: ['categorie'],
      where: { actif: true, entiteId },
    })
    const set = new Set<string>()
    for (const r of dbCats) {
      const c = (r.categorie ?? '').trim()
      if (c) set.add(c)
    }
    const list = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'))
    if (!list.includes('DIVERS')) list.unshift('DIVERS')
    return NextResponse.json(list)
  } catch (e) {
    console.error('GET /api/produits/categories:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}