import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { logAction } from '@/lib/audit'
import { estTypeOperationBanqueEntree } from '@/lib/banque'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { banqueSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

  try {
    const banques = await prisma.banque.findMany({
      where: {
        actif: true,
        ...(session.role !== 'SUPER_ADMIN' && session.entiteId ? { entiteId: session.entiteId } : {}),
      },
      include: {
        compte: { select: { id: true, numero: true, libelle: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const banqueIds = banques.map(b => b.id)
    const operationAggregates = await prisma.operationBancaire.groupBy({
      by: ['banqueId'],
      where: { banqueId: { in: banqueIds } },
      _sum: { montant: true },
    })

    const typeAggregates = await prisma.operationBancaire.groupBy({
      by: ['banqueId', 'type'],
      where: { banqueId: { in: banqueIds } },
      _sum: { montant: true },
    })

    const soldeByBanque = new Map<number, number>()
    for (const b of banques) {
      soldeByBanque.set(b.id, b.soldeInitial)
    }
    for (const row of typeAggregates) {
      const current = soldeByBanque.get(row.banqueId) || 0
      if (estTypeOperationBanqueEntree(row.type)) {
        soldeByBanque.set(row.banqueId, current + (row._sum.montant || 0))
      } else {
        soldeByBanque.set(row.banqueId, current - (row._sum.montant || 0))
      }
    }

    const banquesAvecSolde = banques.map(b => ({
      ...b,
      soldeActuel: soldeByBanque.get(b.id) ?? b.soldeInitial,
    }))

    return NextResponse.json({ data: banquesAvecSolde })
  } catch (error) {
    await apiCatch(error, 'api/banques')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'banque:create')
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateApiRequest(banqueSchema, body)
    if (!result.success) return result.response
    const data = result.data

    // Vérifier si le numéro existe déjà
    const existe = await prisma.banque.findUnique({ where: { numero: data.numero } })
    if (existe) {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
    }

    // entiteId : toujours depuis l'utilisateur (éviter userId comme entiteId → FK)
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { entiteId: true },
    })
    const entiteId = user?.entiteId ?? session.entiteId
    if (!entiteId) {
      return NextResponse.json({ error: 'Aucune entité associée à votre compte.' }, { status: 400 })
    }

    // compteId : accepter id ou numéro (512, 513, 514) ; résoudre par numéro si besoin
    let compteIdFinal: number | null = null
    if (data.compteId != null) {
      const num = Number(data.compteId)
      const byId = await prisma.planCompte.findUnique({ where: { id: num }, select: { id: true } })
      if (byId) {
        compteIdFinal = byId.id
      } else {
        const byNumero = await prisma.planCompte.findFirst({
          where: { numero: String(data.compteId).trim() },
          select: { id: true },
        })
        if (byNumero) compteIdFinal = byNumero.id
      }
    }

    const banque = await prisma.banque.create({
      data: {
        numero: data.numero,
        nomBanque: data.nomBanque,
        libelle: data.libelle,
        soldeInitial: data.soldeInitial,
        soldeActuel: data.soldeInitial,
        entiteId,
        compteId: compteIdFinal,
      },
      include: {
        compte: { select: { id: true, numero: true, libelle: true } },
      },
    })

    await logAction(session, 'CREATION', 'BANQUE', `Création compte bancaire: ${data.nomBanque} - ${data.libelle}`, session.entiteId)

    return NextResponse.json(banque)
  } catch (error) {
    await apiCatch(error, 'api/banques')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
