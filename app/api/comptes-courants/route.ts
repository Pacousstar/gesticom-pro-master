import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { validateApiRequest } from '@/lib/validation-helpers'
import { compteCourantSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)

  const comptes = await prisma.compteCourant.findMany({
    where: { entiteId, actif: true },
    include: {
      client: { select: { id: true, nom: true, telephone: true, ncc: true } },
      fournisseur: { select: { id: true, nom: true, telephone: true, ncc: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = await Promise.all(comptes.map(async (cc) => {
    const solde = await calculerSolde(cc.clientId, cc.fournisseurId)
    return { ...cc, solde }
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:create')
  if (forbidden) return forbidden

  const body = await request.json()
  const result = validateApiRequest(compteCourantSchema, body)
  if (!result.success) return result.response
  const data = result.data

  const entiteId = await getEntiteId(session)

  const count = await prisma.compteCourant.count()
  const code = `CC-${String(count + 1).padStart(3, '0')}`

  const compte = await prisma.compteCourant.create({
    data: { code, nom: data.nom, ncc: data.ncc ?? null, entiteId, clientId: data.clientId ?? null, fournisseurId: data.fournisseurId ?? null },
    include: {
      client: { select: { id: true, nom: true, telephone: true } },
      fournisseur: { select: { id: true, nom: true, telephone: true } },
    },
  })

  return NextResponse.json(compte)
}

async function calculerSolde(clientId: number | null, fournisseurId: number | null): Promise<number> {
  let totalAchats = 0
  let totalPaiements = 0
  let totalVentes = 0
  let totalEncaissements = 0

  if (fournisseurId) {
    const achats = await prisma.achat.aggregate({
      where: { fournisseurId, statut: { not: 'ANNULEE' } },
      _sum: { montantTotal: true },
    })
    totalAchats = achats._sum.montantTotal || 0

    const paiements = await prisma.reglementAchat.aggregate({
      where: { fournisseurId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      _sum: { montant: true },
    })
    totalPaiements = paiements._sum.montant || 0
  }

  if (clientId) {
    const ventes = await prisma.vente.aggregate({
      where: { clientId, statut: { not: 'ANNULEE' } },
      _sum: { montantTotal: true },
    })
    totalVentes = ventes._sum.montantTotal || 0

    const encaissements = await prisma.reglementVente.aggregate({
      where: { clientId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      _sum: { montant: true },
    })
    totalEncaissements = encaissements._sum.montant || 0
  }

  // Solde = créances nettes - dettes nettes
  // Positif = on a une créance nette (il nous doit)
  // Négatif = on a une dette nette (on lui doit)
  const creanceNette = totalVentes - totalEncaissements
  const detteNette = totalAchats - totalPaiements
  return creanceNette - detteNette
}
