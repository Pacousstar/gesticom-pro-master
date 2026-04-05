import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logCreation, getIpAddress, getUserAgent } from '@/lib/audit'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { ensureActivated } from '@/lib/security'

export async function GET(request: NextRequest) {
  const session = await getSession()
  const forbidden = requirePermission(session, 'produits:view')
  if (forbidden) return forbidden

  const complet = request.nextUrl.searchParams.get('complet') === '1'

  const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  const where = q
    ? {
      actif: true,
      OR: [
        { code: { contains: q } },
        { designation: { contains: q } },
        { categorie: { contains: q } },
      ],
    }
    : { actif: true }

  // Mode complet : retourner tous les produits sans pagination (utilisé dans les sélecteurs)
  if (complet) {
    const produits = await prisma.produit.findMany({
      where,
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

    // Filtre insensible à la casse manuel si la requête Prisma est complexe
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

  // Mode paginé (utilisé dans la liste des produits)
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ categorie: 'asc' }, { code: 'asc' }],
      include: {
        stocks: {
          select: { magasinId: true, quantite: true }
        }
      }
    }),
    prisma.produit.count({ where }),
  ])

  const data = produits.map(p => ({
    ...p,
    stockConsolide: p.stocks.reduce((sum, s) => sum + s.quantite, 0)
  }))

  const res = NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

async function generateProductCode(categorie: string): Promise<string> {
  const prefix = categorie.slice(0, 4).toUpperCase().replace(/\s/g, '') || 'PROD'
  
  // Trouver le dernier produit avec ce préfixe ou cette catégorie
  const lastProd = await prisma.produit.findFirst({
    where: { 
      OR: [
        { code: { startsWith: prefix + '-' } },
        { categorie: categorie }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: { code: true }
  })

  let nextNum = 1
  if (lastProd) {
    const match = lastProd.code.match(/(\d+)$/)
    if (match) {
      nextNum = parseInt(match[1], 10) + 1
    }
  }

  // Vérifier l'unicité et itérer si besoin
  let code = `${prefix}-${String(nextNum).padStart(4, '0')}`
  let exists = await prisma.produit.findUnique({ where: { code } })
  
  while (exists) {
    nextNum++
    code = `${prefix}-${String(nextNum).padStart(4, '0')}`
    exists = await prisma.produit.findUnique({ where: { code } })
  }

  return code
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'produits:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const designation = String(body?.designation || '').trim()
    const categorie = String(body?.categorie || 'DIVERS').trim() || 'DIVERS'
    const prixAchat = body?.prixAchat != null ? Number(body.prixAchat) : null
    const prixVente = body?.prixVente != null ? Number(body.prixVente) : null
    const prixMinimum = body?.prixMinimum != null ? Number(body.prixMinimum) : 0
    const fournisseurId = body?.fournisseurId != null ? Number(body.fournisseurId) : null
    const seuilMin = Math.max(0, Number(body?.seuilMin) || 5)
    
    let code = String(body?.code || '').trim().toUpperCase()
    
    // Si le code est vide, on le génère automatiquement
    if (!code) {
      code = await generateProductCode(categorie)
    }

    if (!designation) {
      return NextResponse.json({ error: 'La désignation est requise.' }, { status: 400 })
    }

    const existing = await prisma.produit.findUnique({ where: { code } })
    if (existing) {
      if (!existing.actif) {
        // ... (conserver la logique de réactivation si besoin, mais ici si on veut de l'auto, maybe simple generating new)
      }
      
      // Si le code existe déjà et que l'utilisateur n'a pas forcé le code, on en génère un nouveau
      // car le message d'erreur bloque l'utilisateur.
      code = await generateProductCode(categorie)
    }

    const magasinIdRaw = body?.magasinId != null ? Number(body.magasinId) : null
    if (magasinIdRaw == null || !Number.isInteger(magasinIdRaw) || magasinIdRaw <= 0) {
      return NextResponse.json({ error: 'Le point de vente est obligatoire pour créer un produit.' }, { status: 400 })
    }

    const quantiteInitiale = Math.max(0, Number(body?.quantiteInitiale) || 0)

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinIdRaw } })
    if (!magasin) {
      return NextResponse.json({ error: 'Point de vente introuvable.' }, { status: 404 })
    }

    const entiteId = await getEntiteId(session)
    if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
    }

    const p = await prisma.produit.create({
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
        entiteId: entiteId
      },
    })

    await prisma.stock.create({
      data: { produitId: p.id, magasinId: magasinIdRaw, quantite: quantiteInitiale, quantiteInitiale },
    })

    const ipAddress = getIpAddress(request)
    await logCreation(
        session,
        'PRODUIT',
        p.id,
        `Produit ${p.code} - ${p.designation}`,
        {
          code: p.code,
          designation: p.designation,
          categorie: p.categorie,
          magasinId: magasinIdRaw,
          quantiteInitiale,
        },
        ipAddress
      )

      revalidatePath('/dashboard/produits')
      revalidatePath('/dashboard/stock')
      revalidatePath('/api/produits')
      revalidatePath('/api/produits/stats')
      revalidatePath('/api/produits/categories')

      return NextResponse.json(p)
    } catch (e) {
      console.error('POST /api/produits:', e)
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
    }
  }
