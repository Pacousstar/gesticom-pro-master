import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()

  const where: {
    date?: { gte: Date; lte: Date }
  } = {}

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  // Récupérer toutes les écritures
  const ecritures = await prisma.ecritureComptable.findMany({
    where,
    orderBy: [{ compteId: 'asc' }, { date: 'asc' }],
    include: {
      compte: { select: { id: true, numero: true, libelle: true, classe: true, type: true } },
    },
  })

  // Grouper par compte et calculer les soldes
  const balance: Record<number, {
    compte: { id: number; numero: string; libelle: string; classe: string; type: string }
    soldeDebit: number
    soldeCredit: number
    solde: number
  }> = {}

  for (const ecriture of ecritures) {
    const compteId = ecriture.compteId
    if (!balance[compteId]) {
      balance[compteId] = {
        compte: ecriture.compte,
        soldeDebit: 0,
        soldeCredit: 0,
        solde: 0,
      }
    }
    balance[compteId].soldeDebit += ecriture.debit
    balance[compteId].soldeCredit += ecriture.credit
  }

  // Calculer le solde final selon le type de compte
  const result = Object.values(balance)
    .map((b) => {
      let solde = 0
      if (b.compte.type === 'ACTIF' || b.compte.type === 'CHARGES') {
        // Actifs et Charges : Solde = Débit - Crédit
        solde = b.soldeDebit - b.soldeCredit
      } else {
        // Passifs et Produits : Solde = Crédit - Débit
        solde = b.soldeCredit - b.soldeDebit
      }
      return {
        ...b,
        solde,
      }
    })
    .sort((a, b) => {
      // Trier par classe puis par numéro de compte
      if (a.compte.classe !== b.compte.classe) {
        return a.compte.classe.localeCompare(b.compte.classe)
      }
      return a.compte.numero.localeCompare(b.compte.numero)
    })

  // Calculer les totaux par classe
  const totauxParClasse: Record<string, { debit: number; credit: number }> = {}
  for (const entry of result) {
    if (!totauxParClasse[entry.compte.classe]) {
      totauxParClasse[entry.compte.classe] = { debit: 0, credit: 0 }
    }
    totauxParClasse[entry.compte.classe].debit += entry.soldeDebit
    totauxParClasse[entry.compte.classe].credit += entry.soldeCredit
  }

  const totalDebit = result.reduce((sum, entry) => sum + entry.soldeDebit, 0)
  const totalCredit = result.reduce((sum, entry) => sum + entry.soldeCredit, 0)

  return NextResponse.json({
    balance: result,
    totauxParClasse,
    totalDebit,
    totalCredit,
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
