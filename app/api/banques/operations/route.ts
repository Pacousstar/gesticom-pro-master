import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { comptabiliserOperationBancaire } from '@/lib/comptabilisation'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const banqueId = request.nextUrl.searchParams.get('banqueId')
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 200))

    const where: {
      banqueId?: number
      date?: { gte: Date; lte: Date }
      type?: string
    } = {}

    if (banqueId) {
      const bId = Number(banqueId)
      if (Number.isInteger(bId) && bId > 0) {
        where.banqueId = bId
      }
    }

    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    }

    if (type) {
      where.type = type
    }

    const operations = await prisma.operationBancaire.findMany({
      where,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        banque: { select: { id: true, numero: true, nomBanque: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(operations)
  } catch (error) {
    console.error('GET /api/banques/operations:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const data = await request.json()
    const { date, banqueId, type, libelle, montant, reference, beneficiaire, observation } = data

    if (!banqueId || !type || !libelle || !montant) {
      return NextResponse.json({ error: 'Banque, type, libellé et montant requis.' }, { status: 400 })
    }

    const montantNum = Number(montant)
    if (montantNum <= 0) {
      return NextResponse.json({ error: 'Le montant doit être supérieur à 0.' }, { status: 400 })
    }

    // Vérifier que la banque existe
    const banque = await prisma.banque.findUnique({ where: { id: Number(banqueId) } })
    if (!banque) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }

    // Vérifier les permissions
    if (session.role !== 'SUPER_ADMIN' && banque.entiteId !== session.entiteId) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // Calculer le solde actuel
    const operations = await prisma.operationBancaire.findMany({
      where: { banqueId: Number(banqueId) },
      orderBy: { date: 'asc' },
    })
    let soldeActuel = banque.soldeInitial
    for (const op of operations) {
      if (op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS') {
        soldeActuel += op.montant
      } else {
        soldeActuel -= op.montant
      }
    }

    const soldeAvant = soldeActuel
    let soldeApres = soldeAvant
    if (type === 'DEPOT' || type === 'VIREMENT_ENTRANT' || type === 'INTERETS') {
      soldeApres += montantNum
    } else {
      soldeApres -= montantNum
    }

    // Créer l'opération
    const operation = await prisma.operationBancaire.create({
      data: {
        banqueId: Number(banqueId),
        date: new Date(date + 'T00:00:00'),
        type,
        libelle: libelle.trim(),
        montant: montantNum,
        soldeAvant,
        soldeApres,
        reference: reference?.trim() || null,
        beneficiaire: beneficiaire?.trim() || null,
        utilisateurId: session.userId,
        observation: observation?.trim() || null,
      },
      include: {
        banque: { select: { id: true, numero: true, nomBanque: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    // Mettre à jour le solde actuel de la banque
    await prisma.banque.update({
      where: { id: Number(banqueId) },
      data: { soldeActuel: soldeApres },
    })

    // Comptabiliser l'opération
    try {
      await comptabiliserOperationBancaire({
        operationId: operation.id,
        banqueId: Number(banqueId),
        date: new Date(date + 'T00:00:00'),
        type,
        montant: montantNum,
        libelle: libelle.trim(),
        compteId: banque.compteId,
        utilisateurId: session.userId,
      })
    } catch (comptaError) {
      console.error('Erreur comptabilisation opération bancaire:', comptaError)
      // Ne pas bloquer l'opération si la comptabilisation échoue
    }

    await logAction(
      session,
      'CREATION',
      'OPERATION_BANQUE',
      `Opération bancaire: ${type} - ${libelle} - ${montantNum} FCFA`,
      banque.entiteId
    )

    return NextResponse.json(operation)
  } catch (error) {
    console.error('POST /api/banques/operations:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
