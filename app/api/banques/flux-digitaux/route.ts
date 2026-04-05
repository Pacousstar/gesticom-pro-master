import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const mode = request.nextUrl.searchParams.get('mode')?.trim() // MOBILE_MONEY, VIREMENT, CHEQUE

  const whereDate: any = {}
  if (dateDebut && dateFin) {
    whereDate.gte = new Date(dateDebut + 'T00:00:00')
    whereDate.lte = new Date(dateFin + 'T23:59:59')
  }

  const modesFiltre = mode ? [mode] : ['MOBILE_MONEY', 'VIREMENT', 'CHEQUE']

  try {
    // 1. Règlements Ventes
    const regsVente = await prisma.reglementVente.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        statut: 'VALIDE'
      },
      include: {
        vente: { select: { numero: true } },
        client: { select: { nom: true } }
      }
    })

    // 2. Règlements Achats
    const regsAchat = await prisma.reglementAchat.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        statut: 'VALIDE'
      },
      include: {
        achat: { select: { numero: true } },
        fournisseur: { select: { nom: true } }
      }
    })

    // 3. Dépenses (uniquement celles payées via ces modes)
    const depenses = await prisma.depense.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        montantPaye: { gt: 0 }
      }
    })

    // 4. Opérations Bancaires manuelles (Dépôts, Virement entrant, etc.)
    // Note: Les opérations bancaires n'ont pas forcément un 'modePaiement' explicite MoMo/Cheque
    // On les inclut car elles font partie du flux digital global.
    const opsBancaires = await prisma.operationBancaire.findMany({
      where: {
        date: whereDate
      },
      include: {
        banque: true
      }
    })

    // Fusion et formatage
    const flux = [
      ...regsVente.map(r => ({
        id: `RV-${r.id}`,
        date: r.date,
        type: 'ENTREE',
        source: 'VENTE',
        reference: r.vente?.numero || '—',
        libelle: `Règlement Vente ${r.vente?.numero || ''} - ${r.client?.nom || 'Client'}`,
        mode: r.modePaiement,
        montant: r.montant,
      })),
      ...regsAchat.map(r => ({
        id: `RA-${r.id}`,
        date: r.date,
        type: 'SORTIE',
        source: 'ACHAT',
        reference: r.achat?.numero || '—',
        libelle: `Règlement Achat ${r.achat?.numero || ''} - ${r.fournisseur?.nom || 'Fournisseur'}`,
        mode: r.modePaiement,
        montant: r.montant,
      })),
      ...depenses.map(d => ({
        id: `DP-${d.id}`,
        date: d.date,
        type: 'SORTIE',
        source: 'DEPENSE',
        reference: d.pieceJustificative || '—',
        libelle: `Dépense : ${d.libelle}`,
        mode: d.modePaiement,
        montant: d.montantPaye,
      })),
      ...opsBancaires.map(o => ({
        id: `OB-${o.id}`,
        date: o.date,
        type: o.type === 'DEPOT' || o.type.includes('ENTRANT') || o.type === 'INTERETS' ? 'ENTREE' : 'SORTIE',
        source: 'BANQUE',
        reference: o.reference || '—',
        libelle: `${o.libelle} (${o.banque.nomBanque})`,
        mode: 'BANQUE', // Mode global pour les op manuelles
        montant: o.montant,
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json(flux)
  } catch (error) {
    console.error('Erreur flux digitaux:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
