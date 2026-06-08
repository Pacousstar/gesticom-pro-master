import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validerLicence } from '@/lib/license'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const licence = await prisma.licence.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    if (!licence) {
      const essai = await prisma.licence.create({
        data: {
          cle: '',
          clientNom: 'Essai',
          finValidite: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          statut: 'ESSAI',
          typeEssai: true,
          debutEssai: new Date(),
          features: '["all"]',
        }
      })
      return NextResponse.json({
        active: true,
        statut: 'ESSAI',
        clientNom: 'Essai gratuit',
        debutValidite: essai.debutEssai,
        finValidite: essai.finValidite,
        joursRestants: 7,
        features: ['all'],
      })
    }

    if (licence.typeEssai) {
      const debut = licence.debutEssai || licence.createdAt
      const fin = licence.finValidite || new Date(debut.getTime() + 7 * 24 * 60 * 60 * 1000)
      const joursRestants = Math.max(0, Math.ceil((fin.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      const expire = Date.now() > fin.getTime()

      return NextResponse.json({
        active: !expire,
        statut: expire ? 'ESSAI_EXPIRE' : 'ESSAI',
        clientNom: 'Essai gratuit',
        debutValidite: debut,
        finValidite: fin,
        joursRestants,
        features: ['all'],
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
          typeEssai: false,
          debutEssai: null,
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
