import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'comptabilite:export')
  if (authError) return authError

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
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

    const ecritures = await prisma.ecritureComptable.findMany({
      where,
      take: 20000,
      orderBy: [{ compteId: 'asc' }, { date: 'asc' }],
      include: {
        journal: { select: { code: true, libelle: true } },
        compte: { select: { numero: true, libelle: true, type: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    // Grouper par compte
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

    const result = Object.values(grandLivre).map((gl) => {
      let solde = 0
      if (gl.compte.type === 'ACTIF' || gl.compte.type === 'CHARGES') {
        solde = gl.soldeDebit - gl.soldeCredit
      } else {
        solde = gl.soldeCredit - gl.soldeDebit
      }
      return { ...gl, solde }
    })

    // Grand totals
    let grandTotalDebit = 0
    let grandTotalCredit = 0
    let grandTotalSolde = 0

    // Préparer les données pour Excel
    const rows: any[] = []
    for (const entry of result) {
      grandTotalDebit += entry.soldeDebit
      grandTotalCredit += entry.soldeCredit
      grandTotalSolde += entry.solde
      // En-tête du compte
      rows.push({
        Compte: `${entry.compte.numero} - ${entry.compte.libelle}`,
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: '',
        Débit: '',
        Crédit: '',
        Solde: '',
      })
      
      // Écritures
      for (const ecriture of entry.ecritures) {
        rows.push({
          Compte: '',
          Date: new Date(ecriture.date).toLocaleDateString('fr-FR'),
          Journal: ecriture.journal.code,
          Pièce: ecriture.piece || '',
          Libellé: ecriture.libelle,
          Débit: ecriture.debit > 0 ? ecriture.debit : '',
          Crédit: ecriture.credit > 0 ? ecriture.credit : '',
          Solde: '',
        })
      }
      
      // Total du compte
      rows.push({
        Compte: '',
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: 'TOTAL',
        Débit: entry.soldeDebit,
        Crédit: entry.soldeCredit,
        Solde: entry.solde,
      })
      
      // Ligne vide
      rows.push({
        Compte: '',
        Date: '',
        Journal: '',
        Pièce: '',
        Libellé: '',
        Débit: '',
        Crédit: '',
        Solde: '',
      })
    }

    // Grand total row
    rows.push({
      Compte: '',
      Date: '',
      Journal: '',
      Pièce: '',
      Libellé: 'TOTAL GÉNÉRAL',
      Débit: grandTotalDebit,
      Crédit: grandTotalCredit,
      Solde: grandTotalSolde,
    })

    const buf = await rowsToBuffer(rows as any[], 'Grand Livre')
    const filename = `grand-livre_${dateDebut || 'all'}_${dateFin || 'all'}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/grand-livre/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
