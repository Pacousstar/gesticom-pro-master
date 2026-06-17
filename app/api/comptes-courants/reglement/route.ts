import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { compteCourantId, montant, modePaiement, clientId, fournisseurId } = body
  if (!compteCourantId || !montant || montant <= 0 || !modePaiement) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
  }

  const entiteId = await getEntiteId(session)

  const cc = await prisma.compteCourant.findUnique({ where: { id: Number(compteCourantId) } })
  if (!cc || cc.entiteId !== entiteId) {
    return NextResponse.json({ error: 'Compte courant introuvable.' }, { status: 404 })
  }

  const ref = `CC-REG-${Date.now()}`

  if (clientId) {
    await prisma.reglementVente.create({
      data: {
        venteId: null,
        clientId,
        entiteId,
        montant: Math.round(montant),
        modePaiement,
        statut: 'VALIDE',
        date: new Date(),
        utilisateurId: session.userId,
        observation: `Règlement rapide depuis Compte Courant (${ref})`,
      },
    })
  } else if (fournisseurId) {
    await prisma.reglementAchat.create({
      data: {
        achatId: null,
        fournisseurId,
        entiteId,
        montant: Math.round(montant),
        modePaiement,
        statut: 'VALIDE',
        date: new Date(),
        utilisateurId: session.userId,
        observation: `Règlement rapide depuis Compte Courant (${ref})`,
      },
    })
  } else {
    return NextResponse.json({ error: 'Aucun client ou fournisseur lié.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
