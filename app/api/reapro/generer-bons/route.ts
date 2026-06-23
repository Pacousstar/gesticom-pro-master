import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { reaproSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'commandes:create')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  try {
    const body = await request.json()
    const vres = validateApiRequest(reaproSchema, body)
    if (!vres.success) return vres.response
    const { magasinId, lignes } = vres.data

    const entiteId = await getEntiteId(session)

    const produits = await prisma.produit.findMany({
      where: { id: { in: lignes.map(l => l.produitId) }, entiteId },
      include: { fournisseur: { select: { id: true, nom: true } } },
    })

    const produitsMap = new Map(produits.map(p => [p.id, p]))

    const grouped = new Map<number | null, typeof lignes>()
    for (const l of lignes) {
      const p = produitsMap.get(l.produitId)
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

      const montantTotal = lignesGroupe.reduce((s, l) => s + l.montant, 0)

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
            create: lignesGroupe.map(l => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              tva: l.tva,
              remise: l.remise,
              montant: l.montant,
            })),
          },
        },
        include: { lignes: true, fournisseur: { select: { nom: true } } },
      })

      created.push(commande)
    }

    return NextResponse.json({ commandes: created, count: created.length })
  } catch (e) {
    await apiCatch(e, 'api/reapro/generer-bons')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
