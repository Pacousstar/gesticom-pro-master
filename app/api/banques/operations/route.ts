import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'
import { comptabiliserOperationBancaire } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { enregistrerOperationBancaire } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { banqueOperationSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

  try {
    const entiteIdFilter = await getEntiteIdOrAll(session)
    const banqueId = request.nextUrl.searchParams.get('banqueId')
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 200))
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)

    const where: any = {}

    // Isolation Multi-Entité
    if (entiteIdFilter != null) {
        where.banque = { entiteId: entiteIdFilter }
    } else {
        const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
        if (entiteIdFromParams) {
            where.banque = { entiteId: Number(entiteIdFromParams) }
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
        skip: (page - 1) * limit,
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
        page, 
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    await apiCatch(error, 'api/banques/operations')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:create')
  if (authError) return authError

  try {
    const body = await request.json()
    const result = validateApiRequest(banqueOperationSchema, body)
    if (!result.success) return result.response
    const data = result.data
    const reference = body?.reference ? String(body.reference).trim() : null

    // RB10: Normaliser le type (uppercase)
    const typeNormalise = data.type

    // Vérifier que la banque existe
    const banque = await prisma.banque.findUnique({ where: { id: data.banqueId } })
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
        banqueId: data.banqueId,
        entiteId: banque.entiteId,
        date: new Date(data.date + 'T00:00:00'),
        type: typeNormalise,
        libelle: data.description ?? '',
        montant: data.montant,
        utilisateurId: session.userId,
        reference: reference,
        beneficiaire: data.beneficiaire ?? null,
        observation: data.observation ?? null,
      }, tx)

      if (!op) {
        throw new Error('Erreur lors de l\'enregistrement de l\'opération bancaire.')
      }

      // Comptabiliser dans la même transaction
      await comptabiliserOperationBancaire({
        operationId: op.id,
        banqueId: data.banqueId,
        date: new Date(data.date + 'T00:00:00'),
        type: typeNormalise,
        montant: data.montant,
        libelle: data.description ?? '',
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
      `Opération bancaire: ${typeNormalise} - ${data.description} - ${data.montant} FCA`,
      banque.entiteId
    )

    return NextResponse.json(operation)
  } catch (error) {
    await apiCatch(error, 'api/banques/operations')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}