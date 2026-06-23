import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { validateApiRequest } from '@/lib/validation-helpers'
import { stockInventaireSchema } from '@/lib/validations'

type CoherenceDetail = {
  produitId: number
  produitCode: string
  produitDesignation: string
  magasinId: number
  magasinCode: string
  magasinNom: string
  stockActuel: number
  stockSelonMouvements: number
  ecart: number
  valeurEcart: number
}

async function calculerCoherenceStock(entiteId: number) {
  const [stocks, mouvements] = await Promise.all([
prisma.stock.findMany({
       where: { entiteId },
       select: {
         id: true,
         produitId: true,
         magasinId: true,
         quantite: true,
         quantiteInitiale: true,
         produit: { select: { code: true, designation: true, pamp: true } },
         magasin: { select: { code: true, nom: true } },
       },
     }),
    prisma.mouvement.groupBy({
      by: ['produitId', 'magasinId', 'type'],
      where: { entiteId },
      _sum: { quantite: true },
    }),
  ])

  const stockMap = new Map<string, (typeof stocks)[number]>()
  for (const s of stocks) {
    stockMap.set(`${s.produitId}:${s.magasinId}`, s)
  }

  const mouvementMap = new Map<string, number>()
  for (const m of mouvements) {
    const key = `${m.produitId}:${m.magasinId}`
    const qty = m._sum.quantite || 0
    const sign = String(m.type).toUpperCase() === 'SORTIE' ? -1 : 1
    mouvementMap.set(key, (mouvementMap.get(key) || 0) + (qty * sign))
  }

  // Récupérer les quantités initiales pour le calcul de cohérence
  const quantiteInitialeMap = new Map<string, number>()
  for (const s of stocks) {
    const key = `${s.produitId}:${s.magasinId}`
    quantiteInitialeMap.set(key, s.quantiteInitiale || 0)
  }

  const keys = new Set<string>([...stockMap.keys(), ...mouvementMap.keys()])
  const details: CoherenceDetail[] = []

  for (const key of keys) {
    const [produitIdStr, magasinIdStr] = key.split(':')
    const produitId = Number(produitIdStr)
    const magasinId = Number(magasinIdStr)
    const stock = stockMap.get(key)
    const stockActuel = stock?.quantite || 0
    const qteInit = quantiteInitialeMap.get(key) || 0
    // Le stock selon mouvements = quantité initiale + Σ(ENTREE) - Σ(SORTIE)
    const stockSelonMouvements = qteInit + (mouvementMap.get(key) || 0)
    const ecart = stockActuel - stockSelonMouvements
    const pamp = Number(stock?.produit?.pamp) || 0

    details.push({
      produitId,
      produitCode: stock?.produit.code || '',
      produitDesignation: stock?.produit.designation || '',
      magasinId,
      magasinCode: stock?.magasin.code || '',
      magasinNom: stock?.magasin.nom || '',
      stockActuel,
      stockSelonMouvements,
      ecart,
      valeurEcart: ecart * pamp,
    })
  }

  details.sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
  return { details, stockMap }
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

  const onlyDiff = request.nextUrl.searchParams.get('onlyDiff') === '1'
  const { details } = await calculerCoherenceStock(entiteId)

  const lignesEnEcart = details.filter((d) => Math.abs(d.ecart) >= 0.0001)
  const totalValeurEcart = lignesEnEcart.reduce((sum, d) => sum + d.valeurEcart, 0)

  const detailsFiltered = onlyDiff ? lignesEnEcart : details

  return NextResponse.json({
    entiteId,
    totalLignesControlees: detailsFiltered.length,
    totalLignesEnEcart: lignesEnEcart.length,
    totalValeurEcart,
    details: detailsFiltered,
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'stocks:init')
  if (forbidden) return forbidden

  const entiteId = await getEntiteId(session)
  if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

  const body = await request.json().catch(() => ({} as any))
  const vres = validateApiRequest(stockInventaireSchema, body)
  if (!vres.success) return vres.response
  const validated = vres.data
  const mode = String(validated?.mode || 'simulate').toLowerCase() === 'apply' ? 'apply' : 'simulate'
  const maxItems = Math.max(1, Number(validated?.maxItems) || 5000)

  const { details, stockMap } = await calculerCoherenceStock(entiteId)
  const ecarts = details
    .filter((d) => Math.abs(d.ecart) >= 0.0001)
    .slice(0, maxItems)

  if (mode !== 'apply') {
    return NextResponse.json({
      entiteId,
      mode: 'simulate',
      totalEcarts: ecarts.length,
      correctionsPreparees: ecarts.map((d) => ({
        produitId: d.produitId,
        magasinId: d.magasinId,
        ancienStock: d.stockActuel,
        nouveauStock: d.stockSelonMouvements,
        quantiteInitiale: d.stockSelonMouvements - d.ecart,
        ecart: d.ecart,
      })),
      hint: 'Pour appliquer, envoyez mode=apply avec en-tête x-coherence-confirm: APPLY_STOCK_COHERENCE',
    })
  }

  const confirm = request.headers.get('x-coherence-confirm') || ''
  if (confirm !== 'APPLY_STOCK_COHERENCE') {
    return NextResponse.json({
      error: 'Confirmation requise pour appliquer les corrections.',
      hint: 'Ajoutez l’en-tête x-coherence-confirm: APPLY_STOCK_COHERENCE',
    }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const d of ecarts) {
      const key = `${d.produitId}:${d.magasinId}`
      const stockRow = stockMap.get(key)
      if (stockRow?.id) {
        await tx.stock.update({
          where: { id: stockRow.id },
          data: { quantite: d.stockSelonMouvements },
        })
      } else {
        // Nouveau stock : le stockSelonMouvements = quantiteInitiale + mouvements
        // Mais il n'y a pas de mouvements existants (sinon le stock existerait)
        // Donc quantiteInitiale = stockSelonMouvements
        await tx.stock.create({
          data: {
            produitId: d.produitId,
            magasinId: d.magasinId,
            entiteId,
            quantite: d.stockSelonMouvements,
            quantiteInitiale: d.stockSelonMouvements,
          },
        })
      }
    }
  }, { timeout: 30000 })

  return NextResponse.json({
    entiteId,
    mode: 'apply',
    totalEcartsCorriges: ecarts.length,
    correctionsAppliquees: ecarts.map((d) => ({
      produitId: d.produitId,
      magasinId: d.magasinId,
      ancienStock: d.stockActuel,
      nouveauStock: d.stockSelonMouvements,
      ecartCorrige: d.ecart,
    })),
  })
}
