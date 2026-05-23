import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logAction, getIpAddress, getUserAgent } from '@/lib/audit'
import { comptabiliserVente, comptabiliserReglementVente } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'
import {
  montantLigneTTC,
  montantTotalVenteDocument,
  pointsFideliteDepuisEncaissement,
} from '@/lib/calculs-commerciaux'

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
  // Nouveaux paramètres de recherche avancée
  const searchNumero = request.nextUrl.searchParams.get('numero')?.trim() || request.nextUrl.searchParams.get('search')?.trim()
  const searchNumeroBon = request.nextUrl.searchParams.get('numeroBon')?.trim()
  const searchClient = request.nextUrl.searchParams.get('clientSearch')?.trim()

  const where: Prisma.VenteWhereInput = { entiteId: await getEntiteId(session) }

  // Filtrer par entité (support SUPER_ADMIN)
  const entiteId = await getEntiteId(session)
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

  // Filtre par date
  if (dateDebut || dateFin) {
    where.date = {}
    if (dateDebut) where.date.gte = new Date(dateDebut + 'T00:00:00')
    if (dateFin) where.date.lte = new Date(dateFin + 'T23:59:59')
  }

  // Filtre par clientId spécifique
  if (clientId) {
    where.clientId = Number(clientId)
  }

  // Filtre par numéro de facture (recherche partielle insensible à la casse)
  if (searchNumero) {
    where.numero = { contains: searchNumero }
  }

  // Filtre par numéro de bon de commande
  if (searchNumeroBon) {
    where.numeroBon = { contains: searchNumeroBon }
  }

  // Filtre recherche client (nom OU code) - avec OR
  if (searchClient) {
    where.OR = [
      { client: { nom: { contains: searchClient } } },
      { client: { code: { contains: searchClient } } },
      { clientLibre: { contains: searchClient } },
    ]
  }

  const [ventes, total, aggregates] = await Promise.all([
    prisma.vente.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        magasin: { select: { code: true, nom: true } },
        client: { select: { code: true, nom: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
        reglements: true,
        ReglementVenteLigne: { select: { montant: true } },
      },
    }),
    prisma.vente.count({ where }),
    prisma.vente.aggregate({
      where,
      _sum: {
        montantTotal: true,
        montantPaye: true,
      }
    })
  ])

  const dataWithRealPaye = ventes.map(v => {
    const totalLignePaye = (v.ReglementVenteLigne || []).reduce((s, l) => s + (l.montant || 0), 0)
    return {
      ...v,
      montantPaye: Math.max(totalLignePaye, v.montantPaye || 0),
      ReglementVenteLigne: undefined,
    }
  })

  const totalRealPaye = dataWithRealPaye.reduce((s, v) => s + (v.montantPaye || 0), 0)
  const totalMontant = dataWithRealPaye.reduce((s, v) => s + (v.montantTotal || 0), 0)

  const res = NextResponse.json({
    data: dataWithRealPaye,
    totals: {
      montantTotal: totalMontant,
      montantPaye: totalRealPaye,
      resteAPayer: Math.max(0, totalMontant - totalRealPaye),
    },
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
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const magasinId = Number(body?.magasinId)
    const clientId = body?.clientId != null ? Number(body.clientId) : null
    const clientLibre = body?.clientLibre != null ? String(body.clientLibre).trim() || null : null
    const remiseGlobale = Math.max(0, Number(body?.remiseGlobale) || 0)
    const fraisApproche = Math.max(0, Number(body?.fraisApproche) || 0)
    const observation = body?.observation != null ? String(body.observation).trim() || null : null
    const numeroBon = body?.numeroBon != null ? String(body.numeroBon).trim() || null : null
    
    // --- SUPPORT MULTI-PAIEMENT ---
    const reglementsPayload = Array.isArray(body?.reglements) ? body.reglements : []
    const modePaiementPrincipal = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'VIREMENT', 'CREDIT'].includes(String(body?.modePaiement || ''))
      ? String(body.modePaiement)
      : 'ESPECES'
    
    let montantPaye = 0
    let autoReglementComplet = false
    let listReglements: { mode: string; montant: number }[] = []

    if (reglementsPayload.length > 0) {
      for (const r of reglementsPayload) {
        const amt = Math.max(0, Number(r.montant) || 0)
        const mode = String(r.mode).toUpperCase()
        if (amt > 0 && mode !== 'CREDIT') {
          // CREDIT = créance à terme, on ne crée PAS de règlement
          listReglements.push({ mode, montant: amt })
          montantPaye += amt
        }
      }
    } else {
      const montantPayeRaw = body?.montantPaye != null ? Math.max(0, Number(body.montantPaye) || 0) : null
      if (montantPayeRaw !== null && modePaiementPrincipal !== 'CREDIT') {
         listReglements.push({ mode: modePaiementPrincipal, montant: montantPayeRaw })
         montantPaye = montantPayeRaw
      } else {
         montantPaye = 0
         autoReglementComplet = modePaiementPrincipal !== 'CREDIT'
      }
    }

    const dateStr = body?.date != null ? String(body.date).trim() : null
    let dateVente = new Date()
    if (dateStr) {
      const now = new Date()
      const parts = dateStr.split('-')
      if (parts.length !== 3) {
        return NextResponse.json({ error: 'Format de date invalide. Utilisez YYYY-MM-DD.' }, { status: 400 })
      }
      const [yStr, mStr, dStr] = parts
      const y = Number(yStr)
      const m = Number(mStr)
      const d = Number(dStr)
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
      }
      const candidate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
      if (candidate.getFullYear() !== y || candidate.getMonth() !== m - 1 || candidate.getDate() !== d) {
        return NextResponse.json({ error: 'Date invalide (jour inexistant).' }, { status: 400 })
      }
      dateVente = candidate
    }
    
    if (isNaN(dateVente.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    const lignes = Array.isArray(body?.lignes) ? body.lignes : []

    if (!Number.isInteger(magasinId) || magasinId < 1) {
      return NextResponse.json({ error: 'Magasin requis.' }, { status: 400 })
    }
    if (!lignes.length) {
      return NextResponse.json({ error: 'Au moins une ligne de vente requise.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })
    if (magasin.entiteId !== entiteId) return NextResponse.json({ error: 'Accès au magasin refusé (Entité différente).' }, { status: 403 })

    let montantTotalAVantRemise = 0
    const lignesValides: any[] = []

    for (const l of lignes) {
      const produitId = Number(l?.produitId)
      const quantite = Math.max(0, Number(l?.quantite) || 0)
      const prixUnitaire = Math.max(0, Number(l?.prixUnitaire) || 0)
      const tva = Math.max(0, Number(l?.tva ?? l?.tvaPerc) || 0)
      const remise = Math.max(0, Number(l?.remise) || 0)
      
      if (isNaN(produitId) || isNaN(quantite) || isNaN(prixUnitaire)) continue
      if (!produitId || quantite <= 0) continue

      const produit = await prisma.produit.findUnique({ where: { id: produitId } })
      if (!produit) continue

      const prixMin = produit.prixMinimum || 0
      if (prixMin > 0 && prixUnitaire < prixMin) {
        const ip = getIpAddress(request)
        await logAction(session, 'ANNULATION', 'VENTE', 
          `TENTATIVE PRIX BAS : ${session.nom} a tenté de vendre ${produit.designation} à ${prixUnitaire} F (Prix Mini: ${prixMin} F)`,
          produit.id, { prixSaisi: prixUnitaire, prixMini: prixMin }, ip
        )
        return NextResponse.json({ 
          error: `Action interdite : Le prix pour ${produit.designation} (${prixUnitaire.toLocaleString('fr-FR')} F) est inférieur au prix minimum de sécurité (${prixMin.toLocaleString('fr-FR')} F).` 
        }, { status: 400 })
      }

      const designation = produit.designation
      const coutUnitaire = produit.pamp || produit.prixAchat || 0
      const montantLigne = montantLigneTTC({
        quantite,
        prixUnitaire,
        remiseLigne: remise,
        tvaPourcent: tva,
      })

      montantTotalAVantRemise += montantLigne
      lignesValides.push({ produitId, designation, quantite, prixUnitaire, coutUnitaire, tva, remise, montant: montantLigne })
    }

    if (!lignesValides.length) {
      return NextResponse.json({ error: 'Lignes de vente invalides.' }, { status: 400 })
    }

    const montantTotal = montantTotalVenteDocument(
      montantTotalAVantRemise,
      remiseGlobale,
      fraisApproche
    )

    if (reglementsPayload.length === 0 && autoReglementComplet && montantPaye === 0) {
        montantPaye = montantTotal
        listReglements = [{ mode: modePaiementPrincipal, montant: montantPaye }]
    }

    // FCFA: tolérance "anti-1F" (arrondis / conversions UI) – clamp si écart minime
    const diffPaiement = montantTotal - montantPaye
    if (diffPaiement > 0 && diffPaiement <= 1 && montantPaye > 0) {
      montantPaye = montantTotal
      if (listReglements.length > 0) {
        listReglements[listReglements.length - 1] = {
          ...listReglements[listReglements.length - 1],
          montant: (listReglements[listReglements.length - 1].montant || 0) + diffPaiement,
        }
      }
    }

    if (montantPaye > montantTotal + 1) {
      return NextResponse.json({
        error: `Paiement invalide : le total versé (${montantPaye.toLocaleString()} F) dépasse la facture (${montantTotal.toLocaleString()} F).`
      }, { status: 400 })
    }

    const needsBanque = listReglements.some((r) => estModeBanque(r.mode))
    if (needsBanque && !Number(body?.banqueId)) {
      return NextResponse.json({ error: 'Banque requise pour les règlements non espèces.' }, { status: 400 })
    }
    
    const statutPaiement = montantPaye >= montantTotal ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'
    const pointsGagnes = pointsFideliteDepuisEncaissement(montantPaye)

    let needCreditAlerte = false
    let alerteType = 'INFO'
    let alerteMsg = ''
    let clientExtId: number | null = null

    if (statutPaiement === 'CREDIT' || statutPaiement === 'PARTIEL') {
      if (clientId == null) return NextResponse.json({ error: 'Vente à crédit : un client doit être sélectionné.' }, { status: 400 })
      const client = await prisma.client.findUnique({ where: { id: clientId } })
      if (!client) return NextResponse.json({ error: 'Client introuvable.' }, { status: 400 })
      if (client.entiteId !== entiteId) return NextResponse.json({ error: 'Accès client refusé (Entité différente).' }, { status: 403 })
      if (client.type !== 'CREDIT') return NextResponse.json({ error: 'Le client doit être de type CREDIT.' }, { status: 400 })
      if (client.plafondCredit == null) return NextResponse.json({ error: 'Le client doit avoir un plafond de crédit.' }, { status: 400 })
      
      const ventesClient = await prisma.vente.findMany({ where: { clientId, statut: 'VALIDEE', entiteId } })
      const detteFactures = ventesClient.reduce((s: number, v: any) => s + (v.montantTotal - (v.montantPaye ?? 0)), 0)
      const regsLibres = await prisma.reglementVente.aggregate({
        where: { clientId, venteId: null, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        _sum: { montant: true }
      })
      const totalRegsLibres = regsLibres._sum?.montant || 0
      const detteReelle = (detteFactures + (client.soldeInitial || 0)) - (totalRegsLibres + (client.avoirInitial || 0))
      
      if (detteReelle + (montantTotal - montantPaye) > client.plafondCredit) {
         return NextResponse.json({ error: 'Plafond crédit dépassé.' }, { status: 400 })
      }

      const totalApresVente = detteReelle + (montantTotal - montantPaye)
      needCreditAlerte = totalApresVente >= 0.9 * client.plafondCredit
      alerteType = totalApresVente >= client.plafondCredit ? 'CRITICAL' : 'WARNING'
      alerteMsg = `Attention : Le client ${client.nom} a atteint ${Math.round((totalApresVente / client.plafondCredit) * 100)}% de son plafond de crédit (${client.plafondCredit.toLocaleString()} F).`
      clientExtId = client.id
    }

    const num = body?.numero || `V${Date.now()}`
    
    const vente = await prisma.$transaction(async (tx) => {
      // Bloquer les doublons par numéro (Idempotence)
      const existing = await tx.vente.findUnique({
        where: { numero: num },
        select: { id: true }
      })
      if (existing) {
        throw new Error('DOUBLE_TRANSACTION: Cette vente a déjà été enregistrée.')
      }
      if (needCreditAlerte && clientExtId) {
        await tx.systemAlerte.create({
          data: {
            type: alerteType,
            categorie: 'CREDIT',
            message: alerteMsg,
            referenceId: clientExtId,
            entiteId
          }
        })
      }

      for (const l of lignesValides) {
const st = await tx.stock.findUnique({ 
           where: { produitId_magasinId_entiteId: { produitId: l.produitId, magasinId, entiteId } } 
         })
        if ((st?.quantite ?? 0) < l.quantite) {
          throw new Error(`Stock insuffisant pour ${l.designation} (${st?.quantite || 0} dispo, ${l.quantite} requis).`)
        }
      }

      const v = await tx.vente.create({
        data: {
          numero: num,
          date: dateVente,
          magasinId,
          entiteId,
          utilisateurId: session.userId,
          clientId,
          clientLibre,
          montantTotal,
          fraisApproche,
          remiseGlobale,
          montantPaye,
          pointsGagnes,
          statutPaiement,
          modePaiement: listReglements.length > 1 ? 'MULTI' : (listReglements[0]?.mode || modePaiementPrincipal),
          observation,
          numeroBon,
          statut: 'VALIDEE',
          lignes: {
            create: lignesValides.map((l) => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              coutUnitaire: l.coutUnitaire,
              tva: l.tva,
              remise: l.remise,
              montant: l.montant,
            })),
          },
        },
        include: { lignes: true, magasin: { select: { code: true, nom: true } } },
      })

      for (const l of lignesValides) {
await tx.stock.update({
           where: { produitId_magasinId_entiteId: { produitId: l.produitId, magasinId, entiteId } },
          data: { quantite: { decrement: l.quantite } },
        })
        await tx.mouvement.create({
          data: {
            type: 'SORTIE',
            produitId: l.produitId,
            magasinId,
            entiteId,
            utilisateurId: session.userId,
            quantite: l.quantite,
            dateOperation: dateVente,
            observation: `Vente ${num}`,
          },
        })
      }

      let resteReglement = montantTotal
      const reglementsEffectifs: { mode: string; montant: number }[] = []
      for (const reg of listReglements) {
        const montantReg = Math.min(reg.montant, resteReglement)
        if (montantReg <= 0) continue
        resteReglement -= montantReg
        reglementsEffectifs.push({ mode: reg.mode, montant: montantReg })

        const rv = await tx.reglementVente.create({
          data: {
            venteId: v.id,
            clientId,
            entiteId,
            montant: montantReg,
            modePaiement: reg.mode,
            utilisateurId: session.userId,
            observation: `Règlement ${reg.mode} - Vente ${num}`,
            date: dateVente,
          }
        })

        await tx.reglementVenteLigne.create({
          data: {
            reglementId: rv.id,
            venteId: v.id,
            montant: montantReg,
          }
        })

        // ✅ SYNCHRO PHYSIQUE (Caisse ou Banque)
        if (estModeEspeces(reg.mode)) {
          await enregistrerMouvementCaisse({
            magasinId,
            type: 'ENTREE',
            motif: `Vente ${num}`,
            montant: montantReg,
            utilisateurId: session.userId,
            entiteId,
            date: dateVente,
          }, tx)
          await recalculerSoldeCaisse(magasinId, tx)
        } else {
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
          if (estModeBanque(reg.mode)) {
            await enregistrerOperationBancaire({
              banqueId: body?.banqueId ? Number(body.banqueId) : null,
              entiteId,
              date: dateVente,
              type: 'VENTE',
              libelle: `Vente ${num}`,
              montant: montantReg,
              utilisateurId: session.userId,
              reference: num
            }, tx)
          }
        }
      }

      await comptabiliserVente({
        venteId: v.id,
        numeroVente: num,
        date: dateVente,
        montantTotal,
        modePaiement: reglementsEffectifs.length > 1 ? 'MULTI' : (reglementsEffectifs[0]?.mode || modePaiementPrincipal),
        clientId,
        entiteId,
        utilisateurId: session.userId,
        magasinId,
        reglements: reglementsEffectifs,
        fraisApproche,
        lignes: lignesValides,
      }, tx)

      return v
    }, { timeout: 20000 })

    revalidatePath('/dashboard/ventes')
    revalidatePath('/api/ventes')

    return NextResponse.json(vente)
  } catch (e: any) {
    console.error('[API VENTES ERROR]', e)
    
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cette vente a déjà été enregistrée (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }

    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ 
        error: 'Cette vente a déjà été enregistrée.', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }

    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
