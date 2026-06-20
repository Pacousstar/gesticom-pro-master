import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

  try {
    const banqueId = request.nextUrl.searchParams.get('banqueId')?.trim()
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const type = request.nextUrl.searchParams.get('type')?.trim()

    const where: any = {}

    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.banque = { entiteId: session.entiteId }
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

    const operations = await prisma.operationBancaire.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        banque: { select: { numero: true, nomBanque: true, libelle: true } },
        utilisateur: { select: { nom: true, login: true } },
      },
    })

    const data: any[] = operations.map((op) => {
      const isEntree = op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS'
      const typeLabel = 
        op.type === 'DEPOT' ? 'Dépôt' :
        op.type === 'RETRAIT' ? 'Retrait' :
        op.type === 'VIREMENT_ENTRANT' ? 'Virement entrant' :
        op.type === 'VIREMENT_SORTANT' ? 'Virement sortant' :
        op.type === 'FRAIS' ? 'Frais bancaires' :
        op.type === 'INTERETS' ? 'Intérêts' : op.type

      return {
        Date: new Date(op.date).toLocaleDateString('fr-FR'),
        Type: typeLabel,
        'Compte bancaire': `${op.banque.nomBanque} - ${op.banque.libelle} (${op.banque.numero})`,
        Libellé: op.libelle,
        Référence: op.reference || '',
        Bénéficiaire: op.beneficiaire || '',
        Montant: op.montant,
        'Solde avant': op.soldeAvant,
        'Solde après': op.soldeApres,
        Utilisateur: op.utilisateur.nom,
      }
    })

    const totalDepots = operations
      .filter(op => ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS'].includes(op.type))
      .reduce((s, op) => s + op.montant, 0)
    const totalRetraits = operations
      .filter(op => ['RETRAIT', 'VIREMENT_SORTANT', 'FRAIS'].includes(op.type))
      .reduce((s, op) => s + op.montant, 0)
    const totalMontant = operations.reduce((s, op) => s + op.montant, 0)
    const totalSoldeAvant = operations.reduce((s, op) => s + op.soldeAvant, 0)
    const totalSoldeApres = operations.reduce((s, op) => s + op.soldeApres, 0)

    data.push(
      { Date: '', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: '', 'Solde avant': '', 'Solde après': '', Utilisateur: '' },
      { Date: '', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: '', 'Solde avant': '', 'Solde après': '', Utilisateur: '' },
      { Date: 'TOTAL DÉPÔTS', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: totalDepots, 'Solde avant': '', 'Solde après': '', Utilisateur: '' },
      { Date: 'TOTAL RETRAITS', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: totalRetraits, 'Solde avant': '', 'Solde après': '', Utilisateur: '' },
      { Date: '', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: '', 'Solde avant': '', 'Solde après': '', Utilisateur: '' },
      { Date: 'TOTAL GÉNÉRAL', Type: '', 'Compte bancaire': '', Libellé: '', Référence: '', Bénéficiaire: '', Montant: totalMontant, 'Solde avant': totalSoldeAvant, 'Solde après': totalSoldeApres, Utilisateur: '' },
    )

    const buf = await rowsToBuffer(data as any[], 'Opérations bancaires')
    const filename = `operations-bancaires-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/banques/operations/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
