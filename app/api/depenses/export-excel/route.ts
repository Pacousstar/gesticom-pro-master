import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'depenses:view')
  if (authError) return authError

  try {
    const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
    const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
    const categorie = request.nextUrl.searchParams.get('categorie')?.trim()
    const magasinId = request.nextUrl.searchParams.get('magasinId')?.trim()

    const where: any = {}
    
    if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
      where.entiteId = session.entiteId
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

    const depenses = await prisma.depense.findMany({
      where,
      take: 10000,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        utilisateur: { select: { nom: true } },
      },
    })

    const data: any[] = depenses.map((d) => ({
      Date: new Date(d.date).toLocaleDateString('fr-FR'),
      Catégorie: d.categorie,
      Libellé: d.libelle,
      Magasin: d.magasin ? `${d.magasin.code} - ${d.magasin.nom}` : '—',
      Montant: d.montant,
      'Montant payé': d.montantPaye || 0,
      'Mode paiement': d.modePaiement,
      Bénéficiaire: d.beneficiaire || '',
      Utilisateur: d.utilisateur.nom,
    }))

    const totalMontant = depenses.reduce((s, d) => s + d.montant, 0)
    const totalMontantPaye = depenses.reduce((s, d) => s + (d.montantPaye || 0), 0)
    data.push(
      { Date: '', Catégorie: '', Libellé: '', Magasin: '', Montant: '', 'Montant payé': '', 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: '', Catégorie: '', Libellé: '', Magasin: '', Montant: '', 'Montant payé': '', 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: 'Total', Catégorie: '', Libellé: '', Magasin: '', Montant: totalMontant, 'Montant payé': totalMontantPaye, 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: '', Catégorie: '', Libellé: '', Magasin: '', Montant: '', 'Montant payé': '', 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: 'Récapitulatif', Catégorie: '', Libellé: '', Magasin: '', Montant: '', 'Montant payé': '', 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: 'Total Montant', Catégorie: '', Libellé: '', Magasin: '', Montant: totalMontant, 'Montant payé': '', 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
      { Date: 'Total Montant payé', Catégorie: '', Libellé: '', Magasin: '', Montant: '', 'Montant payé': totalMontantPaye, 'Mode paiement': '', Bénéficiaire: '', Utilisateur: '' },
    )

    const buf = await rowsToBuffer(data as any[], 'Dépenses')
    const filename = `depenses-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/depenses/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
