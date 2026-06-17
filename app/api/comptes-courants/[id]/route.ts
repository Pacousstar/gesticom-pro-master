import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entiteId = await getEntiteId(session)

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })
  }

  const cc = await prisma.compteCourant.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, nom: true, code: true, telephone: true, ncc: true } },
      fournisseur: { select: { id: true, nom: true, code: true, telephone: true, ncc: true } },
    },
  })

  if (!cc) return NextResponse.json({ error: 'Compte courant introuvable.' }, { status: 404 })
  if (cc.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  const transactions = await getTransactions(cc.clientId, cc.fournisseurId, cc.id)
  const solde = transactions.reduce((acc, t) => acc + (t.montantSigne || 0), 0)

  return NextResponse.json({ ...cc, transactions, solde })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const entiteId = await getEntiteId(session)

  const id = Number((await params).id)
  const cc = await prisma.compteCourant.findUnique({ where: { id } })
  if (!cc) return NextResponse.json({ error: 'Introuvable.' }, { status: 404 })
  if (cc.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 403 })
  }

  await prisma.compteCourant.update({
    where: { id },
    data: { actif: false },
  })

  return NextResponse.json({ success: true })
}

type TransactionRow = {
  id: string
  date: Date
  libelle: string
  montant: number
  type: string
  referenceType: string
  montantSigne: number
}

async function getTransactions(
  clientId: number | null,
  fournisseurId: number | null,
  compteCourantId: number
): Promise<TransactionRow[]> {
  const rows: TransactionRow[] = []

  if (fournisseurId) {
    const achats = await prisma.achat.findMany({
      where: { fournisseurId, statut: { not: 'ANNULEE' } },
      select: { id: true, date: true, numero: true, montantTotal: true },
      orderBy: { date: 'asc' },
    })
    for (const a of achats) {
      rows.push({
        id: `ACHAT-${a.id}`,
        date: a.date,
        libelle: `Achat ${a.numero}`,
        montant: a.montantTotal,
        type: 'ACHAT',
        referenceType: 'ACHAT',
        montantSigne: -a.montantTotal,
      })
    }

    const paiements = await prisma.reglementAchat.findMany({
      where: { fournisseurId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      select: { id: true, date: true, montant: true, modePaiement: true, observation: true },
      orderBy: { date: 'asc' },
    })
    for (const p of paiements) {
      rows.push({
        id: `REG-ACHAT-${p.id}`,
        date: p.date,
        libelle: `Paiement fournisseur ${p.observation ? `- ${p.observation}` : ''} (${p.modePaiement})`,
        montant: p.montant,
        type: 'PAIEMENT_FOURNISSEUR',
        referenceType: 'REGLEMENT_ACHAT',
        montantSigne: p.montant,
      })
    }
  }

  if (clientId) {
    const ventes = await prisma.vente.findMany({
      where: { clientId, statut: { not: 'ANNULEE' } },
      select: { id: true, date: true, numero: true, montantTotal: true },
      orderBy: { date: 'asc' },
    })
    for (const v of ventes) {
      rows.push({
        id: `VENTE-${v.id}`,
        date: v.date,
        libelle: `Vente ${v.numero}`,
        montant: v.montantTotal,
        type: 'VENTE',
        referenceType: 'VENTE',
        montantSigne: v.montantTotal,
      })
    }

    const encaissements = await prisma.reglementVente.findMany({
      where: { clientId, statut: 'VALIDE', modePaiement: { not: 'CREDIT' } },
      select: { id: true, date: true, montant: true, modePaiement: true, observation: true },
      orderBy: { date: 'asc' },
    })
    for (const e of encaissements) {
      rows.push({
        id: `REG-VENTE-${e.id}`,
        date: e.date,
        libelle: `Encaissement client ${e.observation ? `- ${e.observation}` : ''} (${e.modePaiement})`,
        montant: e.montant,
        type: 'ENCAISSEMENT_CLIENT',
        referenceType: 'REGLEMENT_VENTE',
        montantSigne: -e.montant,
      })
    }
  }

  // Ajouter les écritures de compensation
  const compensations = await prisma.ecritureComptable.findMany({
    where: { referenceType: 'COMPENSATION_CC', referenceId: compteCourantId },
    select: { date: true, libelle: true, debit: true, credit: true, reference: true },
    orderBy: { date: 'asc' },
  })

  // Une compensation génère 2 lignes (débit 401, crédit 411) avec le même montant
  // On ne prend qu'une ligne par référence
  const seenRefs = new Set<string>()
  for (const comp of compensations) {
    if (seenRefs.has(comp.reference || '')) continue
    seenRefs.add(comp.reference || '')
    const montant = comp.debit || comp.credit
    rows.push({
      id: `COMP-${comp.reference}`,
      date: comp.date,
      libelle: comp.libelle,
      montant,
      type: 'COMPENSATION',
      referenceType: 'COMPENSATION_CC',
      montantSigne: 0, // La compensation est neutre sur le solde net
    })
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime())

  return rows
}
