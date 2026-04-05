import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

const POINTS_DE_VENTE: Array<{ code: string; nom: string; localisation: string }> = [
  { code: 'DANANE', nom: 'Danané', localisation: 'Danané' },
  { code: 'GUIGLO', nom: 'Guiglo', localisation: 'Guiglo' },
  { code: 'MAG01', nom: 'Magasin 01', localisation: '-' },
  { code: 'MAG02', nom: 'Magasin 02', localisation: '-' },
  { code: 'MAG03', nom: 'Magasin 03', localisation: '-' },
  { code: 'STK01', nom: 'Stock 01', localisation: '-' },
  { code: 'STK03', nom: 'Stock 03', localisation: '-' },
]

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { entiteId: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    let created = 0
    let skipped = 0

    for (const { code, nom, localisation } of POINTS_DE_VENTE) {
      const existant = await prisma.magasin.findUnique({ where: { code } })
      if (existant) {
        skipped += 1
        continue
      }
      await prisma.magasin.create({
        data: {
          code,
          nom,
          localisation: localisation || '-',
          entiteId: user.entiteId,
          actif: true,
        },
      })
      created += 1
    }

    return NextResponse.json({ created, skipped })
  } catch (e) {
    console.error('POST /api/magasins/ajout-defaut:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
