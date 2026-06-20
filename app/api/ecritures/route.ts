import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { ecritureSchema } from '@/lib/validations'
import { validateApiRequest } from '@/lib/validation-helpers'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 100))
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const journalId = request.nextUrl.searchParams.get('journalId')?.trim()
  const compteId = request.nextUrl.searchParams.get('compteId')?.trim()
  const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()

  const where: any = {}

  // Filtrage par entité
  if (session.role === 'SUPER_ADMIN') {
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else {
      const eId = await getEntiteId(session)
      if (eId > 0) where.entiteId = eId
    }
  } else {
    const eId = await getEntiteId(session)
    if (eId > 0) where.entiteId = eId
  }

  if (dateDebut || dateFin) {
    if (dateDebut && dateFin) {
      where.date = {
        gte: new Date(dateDebut + 'T00:00:00'),
        lte: new Date(dateFin + 'T23:59:59'),
      }
    } else if (dateDebut) {
      where.date = { gte: new Date(dateDebut + 'T00:00:00') }
    } else {
      where.date = { lte: new Date(dateFin! + 'T23:59:59') }
    }
  }

  if (journalId) {
    const jId = Number(journalId)
    if (Number.isInteger(jId) && jId > 0) {
      where.journalId = jId
    }
  }

  if (compteId) {
    const cId = Number(compteId)
    if (Number.isInteger(cId) && cId > 0) {
      where.compteId = cId
    }
  }

  const ecritures = await prisma.ecritureComptable.findMany({
    where,
    take: limit,
    orderBy: [{ date: 'desc' }, { numero: 'asc' }],
    include: {
      journal: { select: { code: true, libelle: true } },
      compte: { select: { numero: true, libelle: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  return NextResponse.json(ecritures)
  } catch (e) {
    await apiCatch(e, 'api/ecritures')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:view')
  if (authError) return authError

  try {
    const body = await request.json()

    const validation = validateApiRequest(ecritureSchema, body)
    if (!validation.success) return validation.response
    const v = validation.data

    const date = v.date ? new Date(v.date) : new Date()
    const journalId = v.journalId
    const piece = v.piece ?? null
    const libelle = v.libelle
    const compteId = v.compteId
    const debit = v.debit
    const credit = v.credit
    const reference = v.reference ?? null
    const referenceType = v.referenceType ?? null
    const referenceId = v.referenceId ?? null

    if (!libelle) {
      return NextResponse.json({ error: 'Libellé requis.' }, { status: 400 })
    }
    if (!compteId || !Number.isInteger(compteId) || compteId < 1) {
      return NextResponse.json({ error: 'Compte requis.' }, { status: 400 })
    }
    if (debit === 0 && credit === 0) {
      return NextResponse.json({ error: 'Débit ou crédit doit être supérieur à 0.' }, { status: 400 })
    }
    if (debit > 0 && credit > 0) {
      return NextResponse.json({ error: 'Une écriture ne peut avoir à la fois un débit et un crédit.' }, { status: 400 })
    }

    // Vérifier que le journal existe
    const journal = await prisma.journal.findUnique({ where: { id: journalId } })
    if (!journal) return NextResponse.json({ error: 'Journal introuvable.' }, { status: 400 })

    // Vérifier que le compte existe
    const compte = await prisma.planCompte.findUnique({ where: { id: compteId } })
    if (!compte) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 })

    // Générer un numéro d'écriture unique
    const timestamp = Date.now()
    const numero = `ECR-${timestamp}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`

    // Récupérer l'entité appropriée
    const eId = await getEntiteId(session)
    if (eId <= 0) return NextResponse.json({ error: 'Entité non définie.' }, { status: 400 })

    const ecriture = await prisma.ecritureComptable.create({
      data: {
        numero,
        date,
        journalId,
        piece,
        libelle,
        compteId,
        debit,
        credit,
        reference,
        referenceType,
        referenceId,
        utilisateurId: session.userId,
        entiteId: eId,
      },
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(ecriture)
  } catch (e: any) {
    await apiCatch(e, 'api/ecritures')
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Numéro d\'écriture déjà utilisé.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
