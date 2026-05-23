import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logCreation, getIpAddress } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { produitSchema } from '@/lib/validations'

const MAX_LIMIT = 1000
const CODE_PADDING = 3

async function generateProductCode(categorie: string, entiteId: number): Promise<string> {
  const prefix = (categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'PROD').replace(/[^A-Z0-9-]/g, '')

  const lastProd = await prisma.produit.findFirst({
    where: {
      entiteId,
      OR: [
        { code: { startsWith: prefix + '-' } },
        { categorie: categorie }
      ]
    },
    orderBy: { code: 'desc' },
    select: { code: true }
  })

  let nextNum = 1
  if (lastProd) {
    const match = lastProd.code.match(/(\d+)$/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  let code = `${prefix}-${String(nextNum).padStart(CODE_PADDING, '0')}`
  let exists = await prisma.produit.findFirst({ where: { code, entiteId } })

  while (exists) {
    nextNum++
    code = `${prefix}-${String(nextNum).padStart(CODE_PADDING, '0')}`
    exists = await prisma.produit.findFirst({ where: { code, entiteId } })
  }

  return code
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const complet = request.nextUrl.searchParams.get('complet') === '1'

  const whereEntite: any = {}
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      whereEntite.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      whereEntite.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    whereEntite.entiteId = entiteId
  } else {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  const baseWhere = complet ? { ...whereEntite } : { ...whereEntite, actif: true }

  if (complet) {
    const produits = await prisma.produit.findMany({
      where: baseWhere,
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: {
          select: { magasinId: true, quantite: true }
        }
      }
    })

    const data = produits.map(p => ({
      ...p,
      stockConsolide: p.stocks.reduce((sum, s) => sum + s.quantite, 0)
    }))

    const filtered = q
      ? data.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q) ||
          p.categorie.toLowerCase().includes(q)
      )
      : data

    const res = NextResponse.json(filtered)
    res.headers.set('Cache-Control', 'no-store, max-age=0')
    return res
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where: baseWhere,
      skip,
      take: limit,
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: {
          select: { id: true, magasinId: true, quantite: true }
        }
      }
    }),
    prisma.produit.count({ where: baseWhere }),
  ])

  const data = produits.map(p => ({
    ...p,
    stockConsolide: p.stocks.reduce((sum, s) => sum + s.quantite, 0)
  }))

  const filtered = q
    ? data.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.designation.toLowerCase().includes(q) ||
        p.categorie.toLowerCase().includes(q)
    )
    : data

  const res = NextResponse.json({
    data: filtered,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
    },
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()

    const validation = produitSchema.safeParse(body)
    if (!validation.success) {
      const errors = (validation.error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
      return NextResponse.json({ error: `Validation échouée: ${errors}` }, { status: 400 })
    }

    const { designation, categorie, prixAchat, prixVente, seuilMin, codeBarres } = validation.data
    const prixMinimum = body?.prixMinimum != null ? Number(body.prixMinimum) : 0
    const fournisseurId = body?.fournisseurId != null ? Number(body.fournisseurId) : null

    let code = String(body?.code || '').trim().toUpperCase()

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    if (!designation) {
      return NextResponse.json({ error: 'La désignation est requise.' }, { status: 400 })
    }

    if (!code) {
      code = await generateProductCode(categorie, entiteId)
    }

    const existing = await prisma.produit.findFirst({ where: { code, entiteId } })
    if (existing) {
      return NextResponse.json({ error: `Le code produit "${code}" existe déjà dans votre entité.` }, { status: 409 })
    }

    if (codeBarres) {
      const existingBarcode = await prisma.produit.findFirst({
        where: { codeBarres, entiteId }
      })
      if (existingBarcode) {
        return NextResponse.json({ error: `Le code-barres "${codeBarres}" est déjà utilisé par le produit "${existingBarcode.designation}".` }, { status: 409 })
      }
    }

    const magasinIdRaw = body?.magasinId != null ? Number(body.magasinId) : null
    if (magasinIdRaw == null || !Number.isInteger(magasinIdRaw) || magasinIdRaw <= 0) {
      return NextResponse.json({ error: 'Le point de vente est obligatoire pour créer un produit.' }, { status: 400 })
    }

    const quantiteInitiale = Math.max(0, Number(body?.quantiteInitiale) || 0)

    const magasin = await prisma.magasin.findFirst({
      where: { id: magasinIdRaw, entiteId }
    })
    if (!magasin) {
      return NextResponse.json({ error: 'Point de vente introuvable ou n\'appartient pas à votre entité.' }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.produit.create({
        data: {
          code,
          designation,
          categorie,
          prixAchat,
          prixVente,
          prixMinimum,
          pamp: prixAchat,
          fournisseurId,
          seuilMin,
          actif: true,
          entiteId,
          codeBarres: codeBarres || null,
        },
      })

      const st = await tx.stock.create({
        data: { produitId: p.id, magasinId: magasinIdRaw, quantite: quantiteInitiale, quantiteInitiale, entiteId },
      })

      if (quantiteInitiale > 0) {
        const mvt = await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            produitId: p.id,
            magasinId: magasinIdRaw,
            entiteId,
            utilisateurId: session.userId,
            quantite: quantiteInitiale,
            dateOperation: new Date(),
            observation: `Stock initial - Création produit ${p.code}`,
          }
        })

        const { comptabiliserMouvementStock } = await import('@/lib/comptabilisation')
        await comptabiliserMouvementStock({
          produitId: p.id,
          magasinId: magasinIdRaw,
          type: 'ENTREE',
          quantite: quantiteInitiale,
          date: new Date(),
          motif: `Stock initial à la création`,
          utilisateurId: session.userId,
          entiteId,
          mouvementId: mvt.id,
        }, tx)
      }

      return p
    }, { timeout: 10000 })

    const ipAddress = getIpAddress(request)
    await logCreation(
      session,
      'PRODUIT',
      result.id,
      `Produit ${result.code} - ${result.designation}`,
      {
        code: result.code,
        designation: result.designation,
        categorie: result.categorie,
        magasinId: magasinIdRaw,
        quantiteInitiale,
        codeBarres: codeBarres || null,
      },
      ipAddress
    )

    revalidatePath('/dashboard/produits')
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/produits')
    revalidatePath('/api/produits/stats')
    revalidatePath('/api/produits/categories')

    return NextResponse.json(result)
  } catch (e) {
    console.error('POST /api/produits:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}