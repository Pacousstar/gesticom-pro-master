import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserDepense } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces, estModeBanque } from '@/lib/enums-commerce'
import { enregistrerOperationBancaire } from '@/lib/banque'
import fs from 'fs'
import path from 'path'
import { depenseSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 100))
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const categorie = request.nextUrl.searchParams.get('categorie')?.trim()
  const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()
  const search = request.nextUrl.searchParams.get('search')?.trim()

  const entiteIdFilter = await getEntiteIdOrAll(session)
  const where: any = {}

  // Filtrage par entité (support SUPER_ADMIN)
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

  if (categorie) {
    where.categorie = categorie
  }

  if (magasinId) {
    const magId = Number(magasinId)
    if (Number.isInteger(magId) && magId > 0) {
      where.magasinId = magId
    }
  }

  if (search) {
    const searchFilter = {
      OR: [
        { libelle: { contains: search } },
        { beneficiaire: { contains: search } },
      ]
    }
    if (where.AND) {
      where.AND.push(searchFilter)
    } else {
      where.AND = [searchFilter]
    }
  }

  const [total, depenses, aggregates] = await Promise.all([
    prisma.depense.count({ where }),
    prisma.depense.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      // Tri chronologique inverse : la dépense la plus récente en premier.
      // Le tri secondaire par id garantit un ordre stable quand plusieurs dépenses ont la même date.
      orderBy: [{ createdAt: 'desc' }],
      include: {
        magasin: { select: { id: true, code: true, nom: true } },
        entite: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    }),
    prisma.depense.aggregate({
      where,
      _sum: { montant: true }
    })
  ])

  return NextResponse.json({
    data: depenses,
    totalAmount: aggregates._sum.montant || 0,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
  const authError = requirePermission(session, 'depenses:create')
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = validateApiRequest(depenseSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const now = new Date()
    let date = now
    if (v.date) {
      const [y, m, d] = v.date.split('-').map(Number)
      date = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
    }
    const magasinId = v.magasinId ?? null
    const categorie = v.categorie
    const libelle = v.libelle
    const montant = v.montant
    const montantPayeRaw = v.montantPaye ?? null
    const modePaiement = v.modePaiement
    const beneficiaire = v.beneficiaire ?? null
    const pieceJustificative = v.pieceJustificative ?? null
    const observation = v.observation ?? null
    if (montant <= 0) {
      return NextResponse.json({ error: 'Montant doit être supérieur à 0.' }, { status: 400 })
    }

    const montantPaye = montantPayeRaw != null
      ? Math.min(montant, Math.max(0, montantPayeRaw))
      : (modePaiement === 'CREDIT' ? 0 : montant)
    const statutPaiement = montantPaye >= montant ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session
    const entiteId = await getEntiteId(session)

    if (magasinId != null) {
      const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
      if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
      // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
      if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
        return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
      }
    }

    if (estModeBanque(modePaiement) && !body.banqueId) {
      return NextResponse.json({ error: 'Compte bancaire requis pour ce mode de paiement.' }, { status: 400 })
    }

    const depense = await prisma.$transaction(async (tx) => {
      // --- VERROU SÉMANTIQUE (Idempotence) ---
      const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)
      const isDuplicate = await tx.depense.findFirst({
        where: {
          libelle,
          montant,
          utilisateurId: session.userId,
          createdAt: { gte: fifteenSecondsAgo }
        },
        select: { id: true }
      })

      if (isDuplicate) {
        throw new Error('DOUBLE_TRANSACTION: Cette dépense semble être un doublon.')
      }

      const d = await tx.depense.create({
        data: {
          date,
          magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          categorie,
          libelle,
          montant,
          montantPaye,
          statutPaiement,
          modePaiement,
          banqueId: body?.banqueId != null ? Number(body.banqueId) : null,
          beneficiaire,
          pieceJustificative,
          observation,
        },
        include: {
          magasin: { select: { code: true, nom: true } },
          entite: { select: { code: true, nom: true } },
          utilisateur: { select: { nom: true, login: true } },
        },
      })

      // Comptabilisation automatique : toujours le montant total en charge
      if (statutPaiement === 'PAYE' || montantPaye > 0) {
        await comptabiliserDepense({
          depenseId: d.id,
          date,
          montantTotal: montant,
          montantPaye,
          categorie,
          libelle,
          modePaiement,
          utilisateurId: session.userId,
          magasinId,
          entiteId: d.entiteId,
        }, tx)

        // ✅ SYNCHRO CAISSE : Si paiement CASH/ESPECES, enregistrer en caisse (SORTIE)
        if (montantPaye > 0 && estModeEspeces(modePaiement)) {
          let targetMagasinId = magasinId;
          
          if (!targetMagasinId) {
            const firstMag = await tx.magasin.findFirst({
              where: { entiteId },
              select: { id: true }
            });
            if (!firstMag) {
              throw new Error("Impossible d'enregistrer en caisse : aucun point de vente (magasin) n'est configuré pour cette entité.");
            }
            targetMagasinId = firstMag.id;
          }

          await enregistrerMouvementCaisse({
            magasinId: targetMagasinId,
            type: 'SORTIE',
            motif: `Dépense #${d.id} : ${libelle}${beneficiaire ? ' (' + beneficiaire + ')' : ''}`,
            montant: montantPaye,
            utilisateurId: session.userId,
            entiteId: entiteId || 1,
            date,
          }, tx)
          await recalculerSoldeCaisse(targetMagasinId, tx)
        } else {
          // ✅ SYNCHRO BANQUE : Dépense par Chèque/Virement/MM
          if (montantPaye > 0 && estModeBanque(modePaiement)) {
            await enregistrerOperationBancaire({
              banqueId: body.banqueId ? Number(body.banqueId) : null,
              entiteId,
              date,
              type: 'DEPENSE',
              libelle: `Dépense #${d.id} : ${libelle}`,
              montant: montantPaye,
              utilisateurId: session.userId,
              reference: pieceJustificative || `EXP-${d.id}`,
              beneficiaire: body.beneficiaire || d.beneficiaire || null,
              observation: observation
            }, tx)
          }
        }
      }
      return d
    }, { timeout: 20000 })

            return NextResponse.json(depense)
  } catch (e: any) {
    await apiCatch(e, 'api/depenses')
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cette dépense a déjà été enregistrée (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    const msg = e instanceof Error ? e.message : String(e)
    const hint = msg.includes('table') || msg.includes('Table')
      ? 'La table Dépenses n\'existe peut-être pas. Exécutez: npx prisma db push'
      : undefined
    // Log fichier pour diagnostic
    try {
      const logPath = path.join(process.cwd(), 'gesticom-error.log')
      const detail = e instanceof Error ? (e.stack || e.message) : String(e)
      fs.appendFileSync(logPath, new Date().toISOString() + ' [depenses:POST] ' + detail + '\n', 'utf8')
    } catch (_) {
      // ignore
    }
    return NextResponse.json(
      { error: 'Erreur serveur.', hint },
      { status: 500 }
    )
  }
}
