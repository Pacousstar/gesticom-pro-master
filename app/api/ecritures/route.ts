import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 100))
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const journalId = request.nextUrl.searchParams.get('journalId')?.trim()
  const compteId = request.nextUrl.searchParams.get('compteId')?.trim()

  const where: {
    date?: { gte?: Date; lte?: Date }
    journalId?: number
    compteId?: number
  } = {}

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
    orderBy: { date: 'desc' },
    include: {
      journal: { select: { code: true, libelle: true } },
      compte: { select: { numero: true, libelle: true } },
      utilisateur: { select: { nom: true, login: true } },
    },
  })

  return NextResponse.json(ecritures)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await request.json()
    const date = body?.date ? new Date(body.date) : new Date()
    const journalId = Number(body?.journalId)
    const piece = body?.piece != null ? String(body.piece).trim() || null : null
    const libelle = String(body?.libelle || '').trim()
    const compteId = Number(body?.compteId)
    const debit = Math.max(0, Number(body?.debit) || 0)
    const credit = Math.max(0, Number(body?.credit) || 0)
    const reference = body?.reference != null ? String(body.reference).trim() || null : null
    const referenceType = body?.referenceType != null ? String(body.referenceType).trim() || null : null
    const referenceId = body?.referenceId != null ? Number(body.referenceId) : null

    if (!journalId || !Number.isInteger(journalId) || journalId < 1) {
      return NextResponse.json({ error: 'Journal requis.' }, { status: 400 })
    }
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
      },
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    return NextResponse.json(ecriture)
  } catch (e: any) {
    console.error('POST /api/ecritures:', e)
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Numéro d\'écriture déjà utilisé.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
