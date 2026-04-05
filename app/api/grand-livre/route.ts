import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const compteId = request.nextUrl.searchParams.get('compteId')?.trim()

  const where: {
    date?: { gte: Date; lte: Date }
    compteId?: number
  } = {}

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  if (compteId) {
    const cId = Number(compteId)
    if (Number.isInteger(cId) && cId > 0) {
      where.compteId = cId
    }
  }

  // Récupérer toutes les écritures
  const ecritures = await prisma.ecritureComptable.findMany({
    where,
    orderBy: [{ compteId: 'asc' }, { date: 'asc' }],
    include: {
      journal: { select: { code: true, libelle: true } },
      compte: { select: { numero: true, libelle: true, type: true } },
      utilisateur: { select: { nom: true } },
    },
  })

  // Grouper par compte et calculer les soldes
  const grandLivre: Record<number, {
    compte: { numero: string; libelle: string; type: string }
    ecritures: typeof ecritures
    soldeDebit: number
    soldeCredit: number
    solde: number
  }> = {}

  for (const ecriture of ecritures) {
    const compteId = ecriture.compteId
    if (!grandLivre[compteId]) {
      grandLivre[compteId] = {
        compte: ecriture.compte,
        ecritures: [],
        soldeDebit: 0,
        soldeCredit: 0,
        solde: 0,
      }
    }
    grandLivre[compteId].ecritures.push(ecriture)
    grandLivre[compteId].soldeDebit += ecriture.debit
    grandLivre[compteId].soldeCredit += ecriture.credit
  }

  // Calculer le solde final selon le type de compte
  const result = Object.values(grandLivre).map((gl) => {
    let solde = 0
    if (gl.compte.type === 'ACTIF' || gl.compte.type === 'CHARGES') {
      // Actifs et Charges : Solde = Débit - Crédit
      solde = gl.soldeDebit - gl.soldeCredit
    } else {
      // Passifs et Produits : Solde = Crédit - Débit
      solde = gl.soldeCredit - gl.soldeDebit
    }
    return {
      ...gl,
      solde,
    }
  })

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
