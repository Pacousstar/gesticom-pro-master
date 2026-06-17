import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entiteId = await getEntiteId(session)

  const clients = await prisma.client.findMany({
    where: { entiteId, actif: true },
    select: { id: true, nom: true, telephone: true, ncc: true },
  })
  const fournisseurs = await prisma.fournisseur.findMany({
    where: { entiteId, actif: true },
    select: { id: true, nom: true, telephone: true, ncc: true },
  })

  const existingLinks = await prisma.compteCourant.findMany({
    where: { entiteId, actif: true },
    select: { clientId: true, fournisseurId: true },
  })
  const linkedClientIds = new Set(existingLinks.map(l => l.clientId).filter(Boolean) as number[])
  const linkedFournisseurIds = new Set(existingLinks.map(l => l.fournisseurId).filter(Boolean) as number[])

  const matches: {
    clientId: number
    clientNom: string
    fournisseurId: number
    fournisseurNom: string
    type: string
  }[] = []

  const body = await request.json().catch(() => ({}))
  const forceRefresh = body.force === true

  for (const c of clients) {
    if (!forceRefresh && linkedClientIds.has(c.id)) continue
    if (!c.ncc && !c.telephone) continue

    for (const f of fournisseurs) {
      if (!forceRefresh && linkedFournisseurIds.has(f.id)) continue

      if (c.ncc && f.ncc && c.ncc === f.ncc) {
        matches.push({ clientId: c.id, clientNom: c.nom, fournisseurId: f.id, fournisseurNom: f.nom, type: 'NCC' })
      } else if (c.telephone && f.telephone && c.telephone === f.telephone) {
        matches.push({ clientId: c.id, clientNom: c.nom, fournisseurId: f.id, fournisseurNom: f.nom, type: 'TELEPHONE' })
      }
    }
  }

  // Dédupliquer sur les paires déjà liées manuellement
  const seen = new Set<string>()
  const uniqueMatches = matches.filter(m => {
    const key = `${m.clientId}-${m.fournisseurId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json(uniqueMatches)
}
