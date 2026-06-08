import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { handleApiError, unauthorized, badRequest } from '@/lib/api-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  try {
    const entiteId = await getEntiteId(session)
    if (!entiteId) return badRequest('Entité non identifiée.')

    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
    const venteId = url.searchParams.get('venteId') ? Number(url.searchParams.get('venteId')) : undefined

    const where: any = { entiteId }
    if (venteId) where.venteId = venteId

    const [data, total] = await Promise.all([
      prisma.retour.findMany({
        where,
        include: {
          vente: { select: { id: true, numero: true } },
          client: { select: { id: true, nom: true } },
          magasin: { select: { id: true, nom: true } },
          utilisateur: { select: { nom: true } },
          lignes: { include: { produit: { select: { code: true, designation: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.retour.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    return handleApiError(e)
  }
}
