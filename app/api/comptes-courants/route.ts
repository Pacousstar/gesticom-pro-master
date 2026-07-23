import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { validateApiRequest } from '@/lib/validation-helpers'
import { compteCourantSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur lors du chargement des comptes courants.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const forbidden = requirePermission(session, 'achats:create')
    if (forbidden) return forbidden

    const body = await request.json()
    const result = validateApiRequest(compteCourantSchema, body)
    if (!result.success) return result.response
    const data = result.data

    const entiteId = await getEntiteId(session)

    // Nettoyer les références des anciens CC inactifs pour éviter les conflits @unique
    if (data.clientId) {
      await prisma.compteCourant.updateMany({
        where: { clientId: data.clientId, actif: false },
        data: { clientId: null },
      })
      const existant = await prisma.compteCourant.findFirst({
        where: { clientId: data.clientId, actif: true },
        select: { id: true, nom: true, code: true },
      })
      if (existant) {
        return NextResponse.json({
          error: `Ce client est déjà lié au compte courant "${existant.nom}" (${existant.code}). Modifie-le pour changer le lien.`
        }, { status: 409 })
      }
    }

    if (data.fournisseurId) {
      await prisma.compteCourant.updateMany({
        where: { fournisseurId: data.fournisseurId, actif: false },
        data: { fournisseurId: null },
      })
      const existant = await prisma.compteCourant.findFirst({
        where: { fournisseurId: data.fournisseurId, actif: true },
        select: { id: true, nom: true, code: true },
      })
      if (existant) {
        return NextResponse.json({
          error: `Ce fournisseur est déjà lié au compte courant "${existant.nom}" (${existant.code}). Modifie-le pour changer le lien.`
        }, { status: 409 })
      }
    }

    const last = await prisma.compteCourant.findFirst({ orderBy: { id: 'desc' }, select: { code: true } })
    const lastNum = last ? parseInt(last.code.replace('CC-', ''), 10) || 0 : 0
    const code = `CC-${String(lastNum + 1).padStart(3, '0')}`

    const compte = await prisma.compteCourant.create({
      data: { code, nom: data.nom, ncc: data.ncc ?? null, entiteId, clientId: data.clientId ?? null, fournisseurId: data.fournisseurId ?? null },
      include: {
        client: { select: { id: true, nom: true, telephone: true } },
        fournisseur: { select: { id: true, nom: true, telephone: true } },
      },
    })

    return NextResponse.json(compte)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Ce code ou partenaire est déjà utilisé.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur lors de la création du compte courant.' }, { status: 500 })
  }
}

async function calculerSolde(clientId: number | null, fournisseurId: number | null): Promise<number> {
  let totalAchats = 0
  let totalPaiements = 0
  let totalVentes = 0
  let totalEncaissements = 0
  let ajustement = 0

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

    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: { soldeInitial: true, avoirInitial: true }
    })
    ajustement = -(fournisseur?.soldeInitial || 0) + (fournisseur?.avoirInitial || 0)
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

    const retoursAgg = await prisma.retour.aggregate({
      where: { clientId, vente: { statut: { not: 'ANNULEE' } } },
      _sum: { montantTotal: true },
    })
    totalVentes -= retoursAgg._sum.montantTotal || 0

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { soldeInitial: true, avoirInitial: true }
    })
    ajustement = (client?.soldeInitial || 0) - (client?.avoirInitial || 0)
  }

  const creanceNette = totalVentes - totalEncaissements
  const detteNette = totalAchats - totalPaiements
  return creanceNette - detteNette + ajustement
}
