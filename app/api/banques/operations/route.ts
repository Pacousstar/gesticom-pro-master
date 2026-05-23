import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { comptabiliserOperationBancaire } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

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

    // RB11: Utiliser le soldeActuel stocké au lieu du recalcul N+1
    const [operations, total] = await Promise.all([
      prisma.operationBancaire.findMany({
        where,
        take: limit,
        orderBy: { date: 'desc' },
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
  const authError = requirePermission(session, 'banque:create')
  if (authError) return authError

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

    // RB10: Normaliser le type (uppercase)
    const typeNormalise = String(type).toUpperCase().trim()

    // Vérifier que la banque existe
    const banque = await prisma.banque.findUnique({ where: { id: Number(banqueId) } })
    if (!banque) {
      return NextResponse.json({ error: 'Compte bancaire introuvable.' }, { status: 404 })
    }

    // Vérifier les permissions
    const entiteIdSession = await getEntiteId(session)
    if (session.role !== 'SUPER_ADMIN' && banque.entiteId !== entiteIdSession) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
    }

    // RB1 + RB4: Utiliser enregistrerOperationBancaire (service canonique) + comptabilité dans la même transaction
    const operation = await prisma.$transaction(async (tx) => {
      // Enregistrer l'opération bancaire via le service canonique
      // Ce service gère: calcul du solde, mise à jour de banque.soldeActuel, création de l'OperationBancaire avec entiteId
      const op = await enregistrerOperationBancaire({
        banqueId: Number(banqueId),
        entiteId: banque.entiteId,
        date: new Date(date + 'T00:00:00'),
        type: typeNormalise,
        libelle: libelle.trim(),
        montant: montantNum,
        utilisateurId: session.userId,
        reference: reference?.trim() || null,
        beneficiaire: beneficiaire?.trim() || null,
        observation: observation?.trim() || null,
      }, tx)

      if (!op) {
        throw new Error('Erreur lors de l\'enregistrement de l\'opération bancaire.')
      }

      // Comptabiliser dans la même transaction
      await comptabiliserOperationBancaire({
        operationId: op.id,
        banqueId: Number(banqueId),
        date: new Date(date + 'T00:00:00'),
        type: typeNormalise,
        montant: montantNum,
        libelle: libelle.trim(),
        compteId: banque.compteId,
        utilisateurId: session.userId,
        entiteId: banque.entiteId,
      }, tx)

      // Récupérer l'opération avec les relations pour la réponse
      return await tx.operationBancaire.findUnique({
        where: { id: op.id },
        include: {
          banque: { select: { id: true, numero: true, nomBanque: true, libelle: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })
    }, { timeout: 20000 })

await logAction(
      session,
      'CREATION',
      'OPERATION_BANQUE',
      `Opération bancaire: ${typeNormalise} - ${libelle} - ${montantNum} FCA`,
      banque.entiteId
    )

    return NextResponse.json(operation)
  } catch (error) {
    console.error('POST /api/banques/operations:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}