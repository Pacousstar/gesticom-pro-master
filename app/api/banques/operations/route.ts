import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { comptabiliserOperationBancaire } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const entiteId = await getEntiteId(session)
    const banqueId = request.nextUrl.searchParams.get('banqueId')
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 200))

    const where: any = {}

    // Isolation Multi-Entité
    if (session.role === 'SUPER_ADMIN') {
        const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
        if (entiteIdFromParams) {
            where.banque = { entiteId: Number(entiteIdFromParams) }
        }
    } else {
        if (entiteId && entiteId > 0) {
            where.banque = { entiteId }
        }
    }

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

    const [operations, total] = await Promise.all([
      prisma.operationBancaire.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          banque: { select: { id: true, numero: true, nomBanque: true, libelle: true, entiteId: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      }),
      prisma.operationBancaire.count({ where })
    ])
    
    return NextResponse.json({
      data: operations,
      pagination: {
        page: 1, 
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

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

    // Utiliser une transaction pour sécuriser la mise à jour du solde
    const operation = await prisma.$transaction(async (tx) => {
      // Re-vérifier le solde actuel de la banque (verrouillage implicite via transaction)
      const b = await tx.banque.findUnique({ 
        where: { id: Number(banqueId) },
        select: { soldeActuel: true, entiteId: true, compteId: true }
      })
      if (!b) throw new Error('Banque introuvable.')

      const soldeAvant = b.soldeActuel
      let soldeApres = soldeAvant

      const isEntree = ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(type)
      if (isEntree) {
        soldeApres += montantNum
      } else {
        soldeApres -= montantNum
      }

      // 1. Créer l'opération
      const op = await tx.operationBancaire.create({
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

      // 2. Mettre à jour le solde de la banque
      await tx.banque.update({
        where: { id: Number(banqueId) },
        data: { soldeActuel: soldeApres },
      })

      return op
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
        entiteId: banque.entiteId,
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
