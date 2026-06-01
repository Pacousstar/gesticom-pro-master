import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logAction, getIpAddress, getUserAgent } from '@/lib/audit'
import { comptabiliserVente, comptabiliserReglementVente } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import { estModeBanque } from '@/lib/banque'
import { unauthorized, badRequest, conflict, forbidden, handleApiError } from '@/lib/api-error'
import {
  montantLigneTTC,
  montantTotalVenteDocument,
  pointsFideliteDepuisEncaissement,
} from '@/lib/calculs-commerciaux'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()
  const permError = requirePermission(session, 'ventes:view')
  if (permError) return permError

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

  const entiteIdFilter = await getEntiteIdOrAll(session)
  const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
  const where: Prisma.VenteWhereInput = {}
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else if (entiteIdFromParams) {
    where.entiteId = Number(entiteIdFromParams)
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
        ReglementVenteLigne: { select: { reglementId: true, montant: true } },
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
    const creditReglementIds = new Set(
      (v.reglements || [])
        .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
        .map(r => r.id)
    )
    const totalLignePaye = (v.ReglementVenteLigne || [])
      .filter(l => !creditReglementIds.has(l.reglementId))
      .reduce((s, l) => s + (l.montant || 0), 0)
    return {
      ...v,
      montantPaye: totalLignePaye > 0 ? totalLignePaye : (v.montantPaye || 0),
      ReglementVenteLigne: undefined,
      reglements: undefined,
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
  if (!session) return unauthorized()
  const permError = requirePermission(session, 'ventes:create')
  if (permError) return permError

  try {
    const body = await request.json()
    const magasinId = Number(body?.magasinId)
    const clientId = body?.clientId != null ? Number(body.clientId) : null
    const clientLibre = body?.clientLibre != null ? String(body.clientLibre).trim() || null : null
    const remiseGlobale = Math.max(0, Number(body?.remiseGlobale) || 0)
    const fraisApproche = Math.max(0, Number(body?.fraisApproche) || 0)
    const observation = body?.observation != null ? String(body.observation).trim() || null : null
    const numeroBon = body?.numeroBon != null ? String(body.numeroBon).trim() || null : null
    const estVenteRapide = body?.estVenteRapide === true
    
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
        return badRequest('Format de date invalide. Utilisez YYYY-MM-DD.')
      }
      const [yStr, mStr, dStr] = parts
      const y = Number(yStr)
      const m = Number(mStr)
      const d = Number(dStr)
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        return badRequest('Date invalide.')
      }
      const candidate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
      if (candidate.getFullYear() !== y || candidate.getMonth() !== m - 1 || candidate.getDate() !== d) {
        return badRequest('Date invalide (jour inexistant).')
      }
      dateVente = candidate
    }
    
    if (isNaN(dateVente.getTime())) {
      return badRequest('Date invalide.')
    }
    const lignes = Array.isArray(body?.lignes) ? body.lignes : []

    if (!Number.isInteger(magasinId) || magasinId < 1) {
      return badRequest('Magasin requis.')
    }
    if (!lignes.length) {
      return badRequest('Au moins une ligne de vente requise.')
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return badRequest('Entité non identifiée.')

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) return badRequest('Magasin introuvable.')
    if (magasin.entiteId !== entiteId) return forbidden('Accès au magasin refusé (Entité différente).')

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
        return badRequest(`Action interdite : Le prix pour ${produit.designation} (${prixUnitaire.toLocaleString('fr-FR')} F) est inférieur au prix minimum de sécurité (${prixMin.toLocaleString('fr-FR')} F).`)
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
      return badRequest('Lignes de vente invalides.')
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
      return badRequest(`Paiement invalide : le total versé (${montantPaye.toLocaleString()} F) dépasse la facture (${montantTotal.toLocaleString()} F).`)
    }

    const needsBanque = listReglements.some((r) => estModeBanque(r.mode))
    if (needsBanque && !Number(body?.banqueId)) {
      return badRequest('Banque requise pour les règlements non espèces.')
    }
    
    const statutPaiement = montantPaye >= montantTotal ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'
    const pointsGagnes = pointsFideliteDepuisEncaissement(montantPaye)

    let needCreditAlerte = false
    let alerteType = 'INFO'
    let alerteMsg = ''
    let clientExtId: number | null = null

    if (statutPaiement === 'CREDIT' || statutPaiement === 'PARTIEL') {
      if (clientId == null) return badRequest('Vente à crédit : un client doit être sélectionné.')
      const client = await prisma.client.findUnique({ where: { id: clientId } })
      if (!client) return badRequest('Client introuvable.')
      if (client.entiteId !== entiteId) return forbidden('Accès client refusé (Entité différente).')
      if (client.type !== 'CREDIT') return badRequest('Le client doit être de type CREDIT.')
      if (client.plafondCredit == null) return badRequest('Le client doit avoir un plafond de crédit.')
      
      const ventesClient = await prisma.vente.findMany({ where: { clientId, statut: 'VALIDEE', entiteId } })
      const detteFactures = ventesClient.reduce((s: number, v: any) => s + (v.montantTotal - (v.montantPaye ?? 0)), 0)
      const regsLibres = await prisma.reglementVente.aggregate({
        where: { clientId, venteId: null, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        _sum: { montant: true }
      })
      const totalRegsLibres = regsLibres._sum?.montant || 0
      const detteReelle = (detteFactures + (client.soldeInitial || 0)) - (totalRegsLibres + (client.avoirInitial || 0))
      
      if (detteReelle + (montantTotal - montantPaye) > client.plafondCredit) {
         return conflict('Plafond crédit dépassé.', 'CREDIT_LIMIT_EXCEEDED')
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
          estVenteRapide,
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
        include: { client: { select: { nom: true } }, lignes: true, magasin: { select: { code: true, nom: true } } },
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
              reference: num,
              beneficiaire: v?.client?.nom || clientLibre || null,
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
  } catch (e) {
    return handleApiError(e)
  }
}
