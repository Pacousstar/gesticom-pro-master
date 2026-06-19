import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'commandes:create')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  try {
    const body = await request.json()
    const { magasinId, lignes } = body

    if (!magasinId) return NextResponse.json({ error: 'Magasin requis.' }, { status: 400 })
    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne requise.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)

    const produits = await prisma.produit.findMany({
      where: { id: { in: lignes.map((l: any) => Number(l.produitId)) }, entiteId },
      include: { fournisseur: { select: { id: true, nom: true } } },
    })

    const produitsMap = new Map(produits.map(p => [p.id, p]))

    const grouped = new Map<number | null, typeof lignes>()
    for (const l of lignes) {
      const p = produitsMap.get(Number(l.produitId))
      const fId = p?.fournisseurId ?? null
      if (!grouped.has(fId)) grouped.set(fId, [])
      grouped.get(fId)!.push(l)
    }

    const now = new Date()
    const year = now.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)
    const existingCount = await prisma.commandeFournisseur.count({
      where: { date: { gte: startOfYear, lte: endOfYear }, entiteId },
    })

    const created: any[] = []
    let counter = existingCount

    for (const [fournisseurId, lignesGroupe] of grouped) {
      counter++
      const fournisseur = fournisseurId
        ? produitsMap.get(lignesGroupe[0].produitId)?.fournisseur
        : null

      const montantTotal = lignesGroupe.reduce((s, l: any) => s + (Number(l.montant) || 0), 0)

      const commande = await prisma.commandeFournisseur.create({
        data: {
          numero: `BC-${year}-${String(counter).padStart(3, '0')}`,
          date: now,
          fournisseurId: fournisseurId ?? null,
          magasinId: Number(magasinId),
          entiteId,
          utilisateurId: session.userId,
          montantTotal,
          statut: 'BROUILLON',
          observation: `Généré automatiquement depuis le réapro (${new Date().toLocaleDateString('fr-FR')})`,
          lignes: {
            create: lignesGroupe.map((l: any) => ({
              produitId: Number(l.produitId),
              designation: l.designation || '',
              quantite: Number(l.quantite),
              prixUnitaire: Number(l.prixUnitaire) || 0,
              tva: Number(l.tva) || 0,
              remise: Number(l.remise) || 0,
              montant: Number(l.montant) || 0,
            })),
          },
        },
        include: { lignes: true, fournisseur: { select: { nom: true } } },
      })

      created.push(commande)
    }

    return NextResponse.json({ commandes: created, count: created.length })
  } catch (e) {
    console.error('POST /api/reapro/generer-bons:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
