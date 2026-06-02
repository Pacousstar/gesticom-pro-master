import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validerLicence } from '@/lib/license'

export async function GET() {
  try {
    const licence = await prisma.licence.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (!licence) {
      return NextResponse.json({
        active: false,
        statut: 'ABSENTE',
        message: 'Aucune licence installée'
      })
    }

    const validation = validerLicence(licence.cle)
    return NextResponse.json({
      active: validation.valide,
      statut: validation.statut,
      clientNom: licence.clientNom,
      debutValidite: licence.debutValidite,
      finValidite: licence.finValidite,
      features: licence.features ? JSON.parse(licence.features) : [],
      erreur: validation.erreur
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur lors de la lecture de la licence' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cle } = await request.json()

    if (!cle || typeof cle !== 'string') {
      return NextResponse.json(
        { error: 'Veuillez fournir une clé de licence valide' },
        { status: 400 }
      )
    }

    const validation = validerLicence(cle.trim())

    if (!validation.valide) {
      return NextResponse.json(
        { error: validation.erreur, statut: validation.statut },
        { status: 400 }
      )
    }

    const existing = await prisma.licence.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (existing) {
      await prisma.licence.update({
        where: { id: existing.id },
        data: {
          cle: cle.trim(),
          clientNom: validation.payload!.client,
          finValidite: validation.payload!.expire ? new Date(validation.payload!.expire) : null,
          statut: 'ACTIVE',
          features: JSON.stringify(validation.payload!.features),
        }
      })
    } else {
      await prisma.licence.create({
        data: {
          cle: cle.trim(),
          clientNom: validation.payload!.client,
          finValidite: validation.payload!.expire ? new Date(validation.payload!.expire) : null,
          statut: 'ACTIVE',
          features: JSON.stringify(validation.payload!.features),
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Licence activée avec succès',
      client: validation.payload!.client,
      expire: validation.payload!.expire,
      features: validation.payload!.features,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur lors de l'activation de la licence" },
      { status: 500 }
    )
  }
}
