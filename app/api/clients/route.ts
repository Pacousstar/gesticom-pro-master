import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

// Utilisation directe du client Prisma pour éviter les erreurs de type complexes

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'clients:view')
  if (forbidden) return forbidden

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const q = String(request.nextUrl.searchParams.get('q') || '').trim()
  const entiteId = await getEntiteId(session)
  const where: any = { actif: true }

  // Filtrage par entité (support SUPER_ADMIN)
  if (session.role === 'SUPER_ADMIN') {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    } else if (entiteId > 0) {
      where.entiteId = entiteId
    }
  } else if (entiteId > 0) {
    where.entiteId = entiteId
  }

  if (q) {
    where.OR = [
      { nom: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { telephone: { contains: q, mode: 'insensitive' } }
    ]
  }

  const [total, list] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: { nom: 'asc' },
      select: { id: true, code: true, nom: true, telephone: true, type: true, plafondCredit: true, ncc: true, localisation: true, soldeInitial: true, avoirInitial: true },
      skip,
      take: limit,
    })
  ])

  const paginated = list

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')
  const dateFin = request.nextUrl.searchParams.get('dateFin')
  
  const clientIds = paginated.map((c) => c.id)
  let detteTotaleByClient: Record<number, number> = {}
  let dettePeriodeByClient: Record<number, number> = {}

  if (clientIds.length > 0) {
    // 1. Dette TOTALE (jusqu'à dateFin si fournie, sinon tout)
    const whereVenteTotale: any = {
      clientId: { in: clientIds },
      statut: { in: ['VALIDE', 'VALIDEE'] },
    }
    if (dateFin) whereVenteTotale.date = { lte: new Date(dateFin + 'T23:59:59') }

    const sumsTotales = await prisma.vente.groupBy({
      by: ['clientId'],
      where: whereVenteTotale,
      _sum: { montantTotal: true, montantPaye: true },
    })
    
    // Règlements LIBRES totaux
    const whereReglementTotal: any = { clientId: { in: clientIds }, venteId: null }
    if (dateFin) whereReglementTotal.date = { lte: new Date(dateFin + 'T23:59:59') }
    const reglementsLibresTotaux = await prisma.reglementVente.groupBy({
      by: ['clientId'],
      where: whereReglementTotal,
      _sum: { montant: true }
    })

    for (const r of sumsTotales) {
       if (r.clientId != null) {
          detteTotaleByClient[r.clientId] = (r._sum?.montantTotal || 0) - (r._sum?.montantPaye || 0)
       }
    }
    for (const rl of reglementsLibresTotaux) {
       if (rl.clientId != null) {
          detteTotaleByClient[rl.clientId] = (detteTotaleByClient[rl.clientId] || 0) - (rl._sum?.montant || 0)
       }
    }

    // 2. Dette sur la PÉRIODE (uniquement entre dateDebut et dateFin)
    if (dateDebut && dateFin) {
      const wherePeriode: any = {
        clientId: { in: clientIds },
        entiteId: where.entiteId, // Appliquer l'entité si filtrée
        statut: { in: ['VALIDE', 'VALIDEE'] },
        date: { gte: new Date(dateDebut + 'T00:00:00'), lte: new Date(dateFin + 'T23:59:59') }
      }
      if (where.entiteId) wherePeriode.entiteId = where.entiteId

      const sumsPeriode = await prisma.vente.groupBy({
        by: ['clientId'],
        where: wherePeriode,
        _sum: { montantTotal: true, montantPaye: true },
      })
      
      const whereRegPeriode: any = { 
        clientId: { in: clientIds }, 
        venteId: null,
        date: { gte: new Date(dateDebut + 'T00:00:00'), lte: new Date(dateFin + 'T23:59:59') }
      }
      if (where.entiteId) whereRegPeriode.entiteId = where.entiteId

      const reglementsLibresPeriode = await prisma.reglementVente.groupBy({
        by: ['clientId'],
        where: whereRegPeriode,
        _sum: { montant: true }
      })

      for (const r of sumsPeriode) {
        if (r.clientId != null) {
          dettePeriodeByClient[r.clientId] = (r._sum?.montantTotal || 0) - (r._sum?.montantPaye || 0)
        }
      }
      for (const rl of reglementsLibresPeriode) {
        if (rl.clientId != null) {
          dettePeriodeByClient[rl.clientId] = (dettePeriodeByClient[rl.clientId] || 0) - (rl._sum?.montant || 0)
        }
      }
    }
  }

  const result = await Promise.all(paginated.map(async (c) => {
    const base = { ...c } as any
    const totalVentes = detteTotaleByClient[c.id] ?? 0
    // Dette Totale = (Impayés Factures) + (Dette Initiale) - (Avoir Initial)
    base.dette = totalVentes + (c.soldeInitial || 0) - (c.avoirInitial || 0)
    
    // Dette sur période (Si dates fournies)
    if (dateDebut && dateFin) {
      base.dettePeriode = (dettePeriodeByClient[c.id] ?? 0)
    }

    // Récupérer le numéro de la dernière facture
    const derniereVente = await prisma.vente.findFirst({
      where: { clientId: c.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
      orderBy: { date: 'desc' },
      select: { numero: true }
    })
    base.derniereFacture = derniereVente?.numero || null
    
    return base
  }))

  const res = NextResponse.json({
    data: result,
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

export async function POST(request: NextRequest) {
  const session = await getSession()
  const forbidden = requirePermission(session, 'clients:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    let code = body?.code != null ? String(body.code).trim() || null : null
    const nom = String(body?.nom || '').trim()
    const telephone = body?.telephone != null ? String(body.telephone).trim() || null : null
    const email = body?.email != null ? String(body.email).trim() || null : null
    const adresse = body?.adresse != null ? String(body.adresse).trim() || null : null
    const type = String(body?.type || 'CASH').toUpperCase() === 'CREDIT' ? 'CREDIT' : 'CASH'
    const plafondCredit = type === 'CREDIT' && body?.plafondCredit != null
      ? Math.max(0, Number(body.plafondCredit))
      : null
    const ncc = body?.ncc != null ? String(body.ncc).trim() || null : null
    const localisation = body?.localisation != null ? String(body.localisation).trim() || null : null
    const soldeInitial = body?.soldeInitial != null ? Number(body.soldeInitial) || 0 : 0
    const avoirInitial = body?.avoirInitial != null ? Number(body.avoirInitial) || 0 : 0

    if (!nom) {
      return NextResponse.json({ error: 'Nom du client requis.' }, { status: 400 })
    }

    // Génération automatique du code si non fourni
    if (!code) {
      const count = await prisma.client.count()
      const prefix = nom.charAt(0).toUpperCase() || 'C'
      code = `${String(count + 1).padStart(6, '0')}${prefix}`
    }

    const c = await prisma.client.create({
      data: { 
        code, 
        nom, 
        telephone, 
        email, 
        adresse, 
        localisation, 
        type, 
        plafondCredit, 
        ncc, 
        soldeInitial, 
        avoirInitial, 
        actif: true,
        entiteId: session?.entiteId || 1
      },
    })

    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/clients')
    revalidatePath('/api/clients')

    return NextResponse.json(c)
  } catch (e) {
    console.error('POST /api/clients:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
