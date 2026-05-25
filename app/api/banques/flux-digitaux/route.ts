import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { estTypeOperationBanqueEntree } from '@/lib/banque'
import { requirePermission } from '@/lib/require-role'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'banque:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const mode = request.nextUrl.searchParams.get('mode')?.trim()

  const whereDate: any = {}
  if (dateDebut && dateFin) {
    whereDate.gte = new Date(dateDebut + 'T00:00:00')
    whereDate.lte = new Date(dateFin + 'T23:59:59')
  }

  const modesFiltre = mode ? [mode] : ['MOBILE_MONEY', 'VIREMENT', 'CHEQUE']

  // RB3: Isolation Multi-Entité
  const whereEntite = session.role === 'SUPER_ADMIN' 
    ? {} 
    : { entiteId }

  try {
    // 1. Règlements Ventes (filtrés par entité)
    const regsVente = await prisma.reglementVente.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        statut: { in: ['VALIDE', 'VALIDEE'] },
        ...whereEntite,
        vente: whereEntite
      },
      include: {
        vente: { select: { numero: true } },
        client: { select: { nom: true } }
      }
    })

    // 2. Règlements Achats (filtrés par entité)
    const regsAchat = await prisma.reglementAchat.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        statut: { in: ['VALIDE', 'VALIDEE'] },
        ...whereEntite,
        achat: whereEntite
      },
      include: {
        achat: { select: { numero: true } },
        fournisseur: { select: { nom: true } }
      }
    })

    // 3. Dépenses (filtrées par entité)
    const depenses = await prisma.depense.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        montantPaye: { gt: 0 },
        ...whereEntite
      }
    })

    // 3b. Charges bancaires (filtrées par entité)
    const charges = await prisma.charge.findMany({
      where: {
        date: whereDate,
        modePaiement: { in: modesFiltre },
        ...whereEntite
      }
    })

    // Types d'opérations bancaires manuelles
    const TYPES_OPS_MANUEL_FLUX = new Set([
      'DEPOT',
      'RETRAIT',
      'VIREMENT_ENTRANT',
      'VIREMENT_SORTANT',
      'FRAIS',
      'INTERETS',
    ])

    // 4. Opérations Bancaires (filtrées par entité)
    const opsBancaires = await prisma.operationBancaire.findMany({
      where: {
        date: whereDate,
        ...whereEntite
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
        beneficiaire: r.client?.nom || '—',
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
        beneficiaire: r.fournisseur?.nom || '—',
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
        beneficiaire: d.beneficiaire || '—',
      })),
      ...charges.map(c => ({
        id: `CH-${c.id}`,
        date: c.date,
        type: 'SORTIE',
        source: 'CHARGE',
        reference: `CHG-${c.id}`,
        libelle: `Charge : ${c.rubrique}`,
        mode: c.modePaiement,
        montant: c.montant,
        beneficiaire: c.beneficiaire || '—',
      })),
      ...opsBancaires.filter((o) =>
        TYPES_OPS_MANUEL_FLUX.has(String(o.type || '').toUpperCase()),
      )
        .map((o) => ({
          id: `OB-${o.id}`,
          date: o.date,
          type: estTypeOperationBanqueEntree(o.type) ? 'ENTREE' : 'SORTIE',
          source: 'BANQUE',
          reference: o.reference || '—',
          libelle: `${o.libelle} (${o.banque.nomBanque})`,
          mode: 'BANQUE',
          montant: o.montant,
          beneficiaire: o.beneficiaire || '—',
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json(flux)
  } catch (error) {
    console.error('Erreur flux digitaux:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}