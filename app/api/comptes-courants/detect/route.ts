import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

function normaliserNom(nom: string): string {
  return nom.trim().toLowerCase().replace(/\s+/g, ' ')
}

function nomsProches(a: string, b: string): boolean {
  const na = normaliserNom(a)
  const nb = normaliserNom(b)
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError
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
  const linkedPairs = new Set(existingLinks.map(l => `${l.clientId ?? 0}-${l.fournisseurId ?? 0}`))

  const matches: {
    clientId: number
    clientNom: string
    fournisseurId: number
    fournisseurNom: string
    type: string
  }[] = []

  for (const c of clients) {
    if (!c.ncc && !c.telephone && !c.nom) continue

    for (const f of fournisseurs) {
      const pairKey = `${c.id}-${f.id}`
      if (linkedPairs.has(pairKey)) continue

      if (c.ncc && f.ncc && c.ncc === f.ncc) {
        matches.push({ clientId: c.id, clientNom: c.nom, fournisseurId: f.id, fournisseurNom: f.nom, type: 'NCC' })
      } else if (c.telephone && f.telephone && c.telephone === f.telephone) {
        matches.push({ clientId: c.id, clientNom: c.nom, fournisseurId: f.id, fournisseurNom: f.nom, type: 'TÉLÉPHONE' })
      } else if (nomsProches(c.nom, f.nom)) {
        matches.push({ clientId: c.id, clientNom: c.nom, fournisseurId: f.id, fournisseurNom: f.nom, type: 'NOM' })
      }
    }
  }

  return NextResponse.json(matches)
}
