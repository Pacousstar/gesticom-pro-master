import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const banques = await prisma.banque.findMany({
      where: {
        actif: true,
        ...(session.role !== 'SUPER_ADMIN' && session.entiteId ? { entiteId: session.entiteId } : {}),
      },
      include: {
        compte: { select: { id: true, numero: true, libelle: true } },
      },
      orderBy: { nomBanque: 'asc' },
    })

    // Calculer le solde actuel pour chaque banque
    const banquesAvecSolde = await Promise.all(
      banques.map(async (banque) => {
        const operations = await prisma.operationBancaire.findMany({
          where: { banqueId: banque.id },
        })
        let solde = banque.soldeInitial
        for (const op of operations) {
          if (op.type === 'DEPOT' || op.type === 'VIREMENT_ENTRANT' || op.type === 'INTERETS') {
            solde += op.montant
          } else {
            solde -= op.montant
          }
        }
        return { ...banque, soldeActuel: solde }
      })
    )

    return NextResponse.json(banquesAvecSolde)
  } catch (error) {
    console.error('GET /api/banques:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const data = await request.json()
    const { numero, nomBanque, libelle, soldeInitial, compteId } = data

    if (!numero || !nomBanque || !libelle) {
      return NextResponse.json({ error: 'Numéro, nom de banque et libellé requis.' }, { status: 400 })
    }

    // Vérifier si le numéro existe déjà
    const existe = await prisma.banque.findUnique({ where: { numero } })
    if (existe) {
      return NextResponse.json({ error: 'Ce numéro de compte existe déjà.' }, { status: 400 })
    }

    // entiteId : toujours depuis l'utilisateur (éviter userId comme entiteId → FK)
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { entiteId: true },
    })
    const entiteId = user?.entiteId ?? session.entiteId
    if (!entiteId) {
      return NextResponse.json({ error: 'Aucune entité associée à votre compte.' }, { status: 400 })
    }

    // compteId : accepter id ou numéro (512, 513, 514) ; résoudre par numéro si besoin
    let compteIdFinal: number | null = null
    if (compteId != null && compteId !== '') {
      const num = Number(compteId)
      const byId = await prisma.planCompte.findUnique({ where: { id: num }, select: { id: true } })
      if (byId) {
        compteIdFinal = byId.id
      } else {
        const byNumero = await prisma.planCompte.findFirst({
          where: { numero: String(compteId).trim() },
          select: { id: true },
        })
        if (byNumero) compteIdFinal = byNumero.id
      }
    }

    const banque = await prisma.banque.create({
      data: {
        numero: numero.trim(),
        nomBanque: nomBanque.trim(),
        libelle: libelle.trim(),
        soldeInitial: Number(soldeInitial) || 0,
        soldeActuel: Number(soldeInitial) || 0,
        entiteId,
        compteId: compteIdFinal,
      },
      include: {
        compte: { select: { id: true, numero: true, libelle: true } },
      },
    })

    await logAction(session, 'CREATION', 'BANQUE', `Création compte bancaire: ${nomBanque} - ${libelle}`, session.entiteId)

    return NextResponse.json(banque)
  } catch (error) {
    console.error('POST /api/banques:', error)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
