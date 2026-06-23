import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserCharge } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque, enregistrerOperationBancaire } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'
import { chargeSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'
import { successList } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'charges:view')
  if (authError) return authError

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const typeParam = request.nextUrl.searchParams.get('type')?.trim()
  const rubriqueParam = request.nextUrl.searchParams.get('rubrique')?.trim()
  const magasinIdParam = request.nextUrl.searchParams.get('magasinId')?.trim()
  const q = request.nextUrl.searchParams.get('q')?.trim()

  const where: {
    date?: { gte: Date; lte: Date }
    type?: string
    rubrique?: string
    magasinId?: number | null
    entiteId?: number
    OR?: any[]
  } = {}

  // Filtrer par entité (support SUPER_ADMIN)
  const entiteIdFilter = await getEntiteIdOrAll(session)
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (typeParam && ['FIXE', 'VARIABLE'].includes(typeParam)) {
    where.type = typeParam
  }

  if (rubriqueParam) {
    where.rubrique = rubriqueParam
  }

  if (magasinIdParam) {
    const magId = Number(magasinIdParam)
    if (Number.isInteger(magId) && magId > 0) {
      where.magasinId = magId
    }
  }

  if (q) {
    where.OR = [
      { rubrique: { contains: q } },
      { observation: { contains: q } },
      { beneficiaire: { contains: q } },
    ]
  }

  const [charges, total, totalAgg] = await Promise.all([
    prisma.charge.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        magasin: { select: { id: true, code: true, nom: true } },
        entite: { select: { id: true, code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    }),
    prisma.charge.count({ where }),
    prisma.charge.aggregate({ where, _sum: { montant: true } }),
  ])

  const totalAmount = totalAgg._sum.montant || 0

  return successList(charges, { page, limit, total, totalPages: Math.ceil(total / limit) }, { totalAmount })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'charges:create')
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = validateApiRequest(chargeSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const now = new Date()
    let date = now
    if (v.date) {
      const [y, m, d] = v.date.split('-').map(Number)
      date = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
    }
    const magasinId = v.magasinId ?? null
    const type = v.type
    const rubrique = v.rubrique
    const beneficiaire = v.beneficiaire ?? null
    const montant = v.montant
    const observation = v.observation ?? null

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)
    const modePaiement = String(body?.modePaiement || 'ESPECES').toUpperCase()
    const banqueId = body?.banqueId != null ? Number(body.banqueId) : null
    const pieceJustificative = body?.pieceJustificative != null ? String(body.pieceJustificative).trim() || null : null

    if (magasinId != null) {
      const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
      if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
      if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
      }
    }
    const modePaiementRaw = modePaiement || 'ESPECES'
    if (estModeBanque(modePaiementRaw) && !banqueId) {
      return NextResponse.json({ error: 'Banque requise pour ce mode de paiement.' }, { status: 400 })
    }

    const charge = await prisma.$transaction(async (tx) => {
      // --- VERROU SÉMANTIQUE (Idempotence) ---
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await tx.charge.findFirst({
        where: {
          rubrique,
          montant,
          utilisateurId: session.userId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
        throw new Error('DOUBLE_TRANSACTION: Cette charge semble être un doublon.')
      }

      const c = await tx.charge.create({
        data: {
          date,
          magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          type,
          rubrique,
          beneficiaire,
          montant,
          modePaiement,
          banqueId,
          pieceJustificative,
          observation,
        },
        include: {
          magasin: { select: { code: true, nom: true } },
          entite: { select: { code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })

      // Comptabilisation automatique
      await comptabiliserCharge({
        chargeId: c.id,
        date,
        montant,
        rubrique,
        libelle: observation,
        utilisateurId: session.userId,
        magasinId,
        entiteId,
        modePaiement,
      }, tx)

      // ✅ SYNCHRO TRÉSORERIE (Caisse ou Banque)
      if (estModeEspeces(modePaiementRaw)) {
        let targetMagasinId = magasinId
        if (!targetMagasinId) {
          const firstMag = await tx.magasin.findFirst({
            where: { entiteId },
            select: { id: true }
          })
          if (!firstMag) {
            throw new Error("Impossible d'enregistrer en caisse : aucun point de vente (magasin) n'est configuré pour cette entité.")
          }
          targetMagasinId = firstMag.id
        }
        await enregistrerMouvementCaisse({
          magasinId: targetMagasinId,
          type: 'SORTIE',
          motif: `Charge #${c.id} : ${rubrique}${observation ? ' (' + observation + ')' : ''}`,
          montant: montant,
          utilisateurId: session.userId,
          entiteId: entiteId || 1,
          date,
        }, tx)
        await recalculerSoldeCaisse(targetMagasinId, tx)
      } else {
        // ✅ SYNCHRO BANQUE : Charge par Chèque/Virement/MM
        if (estModeBanque(modePaiementRaw)) {
await enregistrerOperationBancaire({
            banqueId,
            entiteId,
            date,
            type: 'CHARGE',
            libelle: `Charge : ${rubrique}`,
            montant: montant,
            utilisateurId: session.userId,
            reference: `CHG-${c.id}`,
            beneficiaire: c.beneficiaire || null,
            observation: observation
          }, tx)
        }
      }

      return c
    }, { timeout: 20000 })

            return NextResponse.json(charge)
  } catch (e: any) {
    await apiCatch(e, 'api/charges')
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cette charge a déjà été enregistrée (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json(
      { error: 'Erreur serveur.' },
      { status: 500 }
    )
  }
}
