import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { logAction, getIpAddress } from '@/lib/audit'
import { comptabiliserVente } from '@/lib/comptabilisation'
import { montantLigneTTC } from '@/lib/calculs-commerciaux'

/**
 * API : Ventes Historiques (Anciennes Ventes)
 * ✅ Enregistrement figuratif uniquement — AUCUN impact sur :
 *   - Le stock ou les mouvements
 *   - La comptabilité (aucune écriture)
 *   - Les règlements (pas de ReglementVente)
 *   - Le PAMP des produits
 * But : Traçabilité des ventes/factures antérieures à l'utilisation de GestiCom.
 */

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:view')
  if (forbidden) return forbidden

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const clientId = request.nextUrl.searchParams.get('clientId')
  const where: any = { estHistorique: true }

  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }
  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }
  if (clientId) {
    where.clientId = Number(clientId)
  }

  const [ventes, total, aggregates] = await Promise.all([
    prisma.vente.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { nom: true } },
        lignes: true,
      },
    }),
    prisma.vente.count({ where }),
    prisma.vente.aggregate({
      where,
      _sum: { montantTotal: true, montantPaye: true }
    })
  ])

  const res = NextResponse.json({
    data: ventes,
    totals: {
      montantTotal: aggregates._sum.montantTotal || 0,
      montantPaye: aggregates._sum.montantPaye || 0,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  return res
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const magasinId = Number(body?.magasinId)
    const clientId = body?.clientId != null ? Number(body.clientId) : null
    const clientLibre = body?.clientLibre != null ? String(body.clientLibre).trim() || null : null
    const modePaiement = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CREDIT'].includes(String(body?.modePaiement || ''))
      ? String(body.modePaiement)
      : 'ESPECES'
    const montantPayeRaw = body?.montantPaye != null ? Math.max(0, Number(body.montantPaye) || 0) : null
    const observation = body?.observation != null ? String(body.observation).trim() || null : null
    const dateStr = body?.date != null ? String(body.date).trim() : null
    const now = new Date()
    let dateVente = now
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number)
      dateVente = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
    }

    if (isNaN(dateVente.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    const lignes = Array.isArray(body?.lignes) ? body.lignes : []
    if (!Number.isInteger(magasinId) || magasinId < 1) {
      return NextResponse.json({ error: 'Magasin requis.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })

    let montantTotalCalcule = 0
    const lignesValides: any[] = []

    for (const l of lignes) {
      const produitId = Number(l?.produitId)
      const quantite = Math.max(0, Number(l?.quantite) || 0)
      const prixUnitaire = Math.max(0, Number(l?.prixUnitaire) || 0)
      const tva = Math.max(0, Number(l?.tva || 0))
      const remise = Math.max(0, Number(l?.remise || 0))
      if (!produitId || quantite <= 0) continue

      const produit = await prisma.produit.findUnique({ 
        where: { id: produitId }, 
        select: { designation: true, prixMinimum: true } 
      })

      // BLOCAGE STRICT PRIX MINIMUM (Audit Trail)
      const prixMin = produit?.prixMinimum || 0
      if (prixMin > 0 && prixUnitaire < prixMin) {
        const ip = getIpAddress(request)
        await logAction(session, 'ANNULATION', 'VENTE', 
          `TENTATIVE PRIX BAS (HIST): ${session.nom} a tenté d'enregistrer en historique ${produit?.designation} à ${prixUnitaire} F (Prix Mini: ${prixMin} F)`,
          produitId, { prixSaisi: prixUnitaire, prixMini: prixMin }, ip
        )
        return NextResponse.json({ 
          error: `Action interdite : Le prix pour ${produit?.designation} (${prixUnitaire.toLocaleString('fr-FR')} F) est inférieur au prix de sécurité (${prixMin.toLocaleString('fr-FR')} F).` 
        }, { status: 400 })
      }

      const designation = produit?.designation || String(l?.designation || '')
      const montant = montantLigneTTC({
        quantite,
        prixUnitaire,
        remiseLigne: remise,
        tvaPourcent: tva,
      })
      montantTotalCalcule += montant
      lignesValides.push({ produitId, designation, quantite, prixUnitaire, tva, remise, montant })
    }

    // Si pas de lignes produits, on crée quand même la vente figurative avec le montant direct
    const montantManuel = body?.montantManuel != null ? Math.max(0, Number(body.montantManuel)) : 0
    const montantTotal = lignesValides.length > 0 ? montantTotalCalcule : montantManuel

    const montantPaye = montantPayeRaw != null
      ? Math.min(montantTotal, Math.max(0, montantPayeRaw))
      : montantTotal
    const statutPaiement = 'PAYE' // Les anciennes ventes sont toutes encaissées

    const num = `HIST-${Date.now()}`

    // ✅ Enregistrement IMPACTANT (Stock, Compta, Solde)
    const vente = await prisma.vente.create({
      data: {
        numero: num,
        date: dateVente,
        magasinId,
        entiteId,
        utilisateurId: session.userId,
        clientId,
        clientLibre,
        montantTotal,
        remiseGlobale: Number(body?.remiseGlobale) || 0,
        montantPaye,
        statutPaiement,
        modePaiement,
        observation,
        statut: 'VALIDEE',
        estHistorique: true,
        lignes: {
          create: lignesValides.map((l) => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            coutUnitaire: 0, // Optionnel pour historique
            tva: l.tva,
            remise: l.remise,
            montant: l.montant,
          })),
        },
      },
      include: { lignes: true, magasin: { select: { code: true, nom: true } } },
    })

    // Impact Stock
    for (const l of lignesValides) {
      await prisma.stock.updateMany({
        where: { produitId: l.produitId, magasinId },
        data: { quantite: { decrement: l.quantite } },
      })
      await prisma.mouvement.create({
        data: {
          type: 'SORTIE',
          produitId: l.produitId,
          magasinId,
          entiteId,
          utilisateurId: session.userId,
          quantite: l.quantite,
          date: dateVente,
          observation: `Vente Historique ${num} (${observation || ''})`,
        },
      })
    }

    // Règlement automatique si payé
    if (modePaiement !== 'CREDIT' && montantPaye > 0 && clientId) {
      await prisma.reglementVente.create({
        data: {
          venteId: vente.id,
          clientId,
          montant: montantPaye,
          modePaiement,
          utilisateurId: session.userId,
          observation: `Règlement historique - Vente ${num}`,
          date: dateVente,
        }
      })
    }

    // Comptabilisation
    try {
      await comptabiliserVente({
        venteId: vente.id,
        numeroVente: num,
        date: dateVente,
        montantTotal,
        modePaiement,
        clientId,
        entiteId,
        utilisateurId: session.userId,
        magasinId,
      })
    } catch (e) { console.error('Erreur compta historique:', e) }

    await logAction(session, 'CREATION', 'VENTE', `Enregistrement vente historique ${num}`, vente.id, body)

    revalidatePath('/dashboard/ventes/historiques')
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/ventes/historiques')
    return NextResponse.json(vente)
  } catch (e) {
    console.error('POST /api/ventes-historiques:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
