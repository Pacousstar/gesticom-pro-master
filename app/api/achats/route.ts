import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserAchat, comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { getEntiteId, getEntiteIdOrAll } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { estModeBanque } from '@/lib/banque'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'
import {
  htNetLigne,
  montantLigneTTC,
  montantTotalAchatSommeLignes,
  nouveauPampApresAchatLigne,
  partFraisApprocheLigne,
  valeurAchatNetAvecFrais,
  roundMoneyFCFA,
} from '@/lib/calculs-commerciaux'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:view')
  if (forbidden) return forbidden

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const dateDebut = request.nextUrl.searchParams.get('dateDebut')?.trim()
  const dateFin = request.nextUrl.searchParams.get('dateFin')?.trim()
  const q = request.nextUrl.searchParams.get('q')?.trim()
  // Nouveaux filtres dédiés
  const searchNumero = request.nextUrl.searchParams.get('numero')?.trim()
  const searchNumeroCamion = request.nextUrl.searchParams.get('numeroCamion')?.trim()
  const searchFournisseur = request.nextUrl.searchParams.get('fournisseurSearch')?.trim()
  
  const entiteIdFilter = await getEntiteIdOrAll(session)
  const where: any = {}

  // Filtre par numéro d'achat
  if (searchNumero) {
    where.numero = { contains: searchNumero }
  }

  // Filtre par numéro de camion
  if (searchNumeroCamion) {
    where.numeroCamion = { contains: searchNumeroCamion }
  }

  // Filtre recherche fournisseur (nom, code, téléphone ou nom libre)
  if (searchFournisseur) {
    where.OR = [
      { fournisseur: { nom: { contains: searchFournisseur } } },
      { fournisseur: { code: { contains: searchFournisseur } } },
      { fournisseur: { telephone: { contains: searchFournisseur } } },
      { fournisseurLibre: { contains: searchFournisseur } }
    ]
  }

  // Support du paramètre q existant (recherche globale)
  if (q && !searchNumero && !searchNumeroCamion && !searchFournisseur) {
    where.OR = [
      { numero: { contains: q } },
      { fournisseur: { nom: { contains: q } } },
      { fournisseur: { code: { contains: q } } },
      { fournisseur: { telephone: { contains: q } } },
      { fournisseurLibre: { contains: q } }
    ]
  }

  if (dateDebut || dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }

  // Filtrage par entité (support SUPER_ADMIN)
  if (entiteIdFilter != null) {
    where.entiteId = entiteIdFilter
  } else {
    const entiteIdFromParams = request.nextUrl.searchParams.get('entiteId')?.trim()
    if (entiteIdFromParams) {
      where.entiteId = Number(entiteIdFromParams)
    }
  }

  const [achats, total, aggregates] = await Promise.all([
    prisma.achat.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        fournisseur: { select: { id: true, code: true, nom: true, telephone: true, email: true, localisation: true, ncc: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
        reglements: { select: { id: true, modePaiement: true } },
        ReglementAchatLigne: { select: { reglementId: true, montant: true } },
      },
    }),
    prisma.achat.count({ where }),
    prisma.achat.aggregate({
      where,
      _sum: {
        montantTotal: true,
        montantPaye: true,
      }
    })
  ])

  const dataWithRealPaye = achats.map(a => {
    const creditReglementIds = new Set(
      (a.reglements || [])
        .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
        .map(r => r.id)
    )
    const totalLignePaye = (a.ReglementAchatLigne || [])
      .filter(l => !creditReglementIds.has(l.reglementId))
      .reduce((s, l) => s + (l.montant || 0), 0)
    return {
      ...a,
      montantPaye: totalLignePaye > 0 ? totalLignePaye : (a.montantPaye || 0),
      ReglementAchatLigne: undefined,
    }
  })

  // Utiliser l'agrégat SQL pour les totaux (couvre TOUS les achats filtrés, pas seulement la page)
  const totalMontant = aggregates._sum.montantTotal || 0
  const totalPaye = aggregates._sum.montantPaye || 0

  const res = NextResponse.json({
    data: dataWithRealPaye,
    totals: {
      montantTotal: totalMontant,
      montantPaye: totalPaye,
      resteAPayer: Math.max(0, totalMontant - totalPaye),
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
  const forbidden = requirePermission(session, 'achats:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const magasinId = Number(body?.magasinId)
    const fournisseurId = body?.fournisseurId != null ? Number(body.fournisseurId) : null
    const fournisseurLibre = body?.fournisseurLibre != null ? String(body.fournisseurLibre).trim() || null : null
    const numeroCamion = body?.numeroCamion != null ? String(body.numeroCamion).trim() || null : null
    const observation = body?.observation != null ? String(body.observation).trim() || null : null
    const fraisApproche = Math.max(0, Number(body?.fraisApproche) || 0)

    // --- SUPPORT MULTI-PAIEMENT ---
    const reglementsPayload = Array.isArray(body?.reglements) ? body.reglements : []
    const modePaiementPrincipal = ['ESPECES', 'MOBILE_MONEY', 'CHEQUE', 'CREDIT', 'VIREMENT'].includes(String(body?.modePaiement || ''))
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
          // CREDIT = dette à terme, on ne crée PAS de règlement
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
    const now = new Date()
    let dateAchat = now
    if (dateStr) {
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
      dateAchat = candidate
    }
    if (isNaN(dateAchat.getTime())) {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    const lignes = Array.isArray(body?.lignes) ? body.lignes : []

    if (!Number.isInteger(magasinId) || magasinId < 1) {
      return NextResponse.json({ error: 'Magasin requis.' }, { status: 400 })
    }
    if (!lignes.length) {
      return NextResponse.json({ error: 'Au moins une ligne requise.' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.utilisateur.findUnique({
      where: { id: session.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 401 })

    // Utiliser l'entité de la session (qui peut être changée pour SUPER_ADMIN)
    const entiteId = await getEntiteId(session)

    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })

    // Vérifier que le magasin appartient à l'entité sélectionnée (sauf SUPER_ADMIN)
    if (session.role !== 'SUPER_ADMIN' && magasin.entiteId !== entiteId) {
      return NextResponse.json({ error: 'Ce magasin n\'appartient pas à votre entité.' }, { status: 403 })
    }

let montantFactureHT = 0
    const lignesBrutes: any[] = []

    for (const l of lignes) {
      const produitId = Number(l?.produitId)
      const quantite = Number(l?.quantite) || 0
      const prixUnitaire = Number(l?.prixUnitaire) || 0
      const tva = Number(l?.tva) || 0
      const remise = Number(l?.remise) || 0

      if (quantite <= 0) continue

      const produit = await prisma.produit.findUnique({ where: { id: produitId } })
      if (!produit) continue

      if (prixUnitaire <= 0) {
        return NextResponse.json({ error: `Prix unitaire invalide pour ${produit.designation} : doit être supérieur à 0.` }, { status: 400 })
      }

      const designation = produit.designation
      const htNet = htNetLigne(quantite, prixUnitaire, remise)
      const montantLigne = montantLigneTTC({
        quantite,
        prixUnitaire,
        remiseLigne: remise,
        tvaPourcent: tva,
      })

      montantFactureHT += htNet
      lignesBrutes.push({
        produitId,
        designation,
        quantite,
        prixUnitaire,
        tva,
        remise,
        montant: montantLigne,
        htNet,
      })
    }

    const lignesValides = lignesBrutes.map(l => {
      const partFrais = partFraisApprocheLigne(l.htNet, montantFactureHT, fraisApproche)
      const valNet = valeurAchatNetAvecFrais(l.htNet, partFrais)
      return {
        ...l,
        valeurAchatNet: valNet,
        coutUnitaire: l.htNet / l.quantite,
      }
    })

    if (!lignesValides.length) {
      return NextResponse.json({ error: 'Lignes invalides.' }, { status: 400 })
    }

    const montantTotalLignes = montantTotalAchatSommeLignes(lignesValides.map((l) => l.montant))
    const montantTotal = roundMoneyFCFA(montantTotalLignes + fraisApproche)

    if (reglementsPayload.length === 0 && autoReglementComplet && montantPaye === 0) {
        montantPaye = montantTotal
        listReglements = [{ mode: modePaiementPrincipal, montant: montantPaye }]
    }

    if (montantPaye > montantTotal + 1) {
      return NextResponse.json({
        error: `Paiement invalide : le total versé (${montantPaye.toLocaleString()} F) dépasse l'achat (${montantTotal.toLocaleString()} F).`
      }, { status: 400 })
    }
    const needsBanque = listReglements.some((r) => estModeBanque(r.mode))
    if (needsBanque && !Number(body?.banqueId)) {
      return NextResponse.json({ error: 'Banque requise pour les règlements non espèces.' }, { status: 400 })
    }

    
    const statutPaiement = montantPaye >= montantTotal ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'

    const num = body?.numero || `A${Date.now()}`
    
    const achat = await prisma.$transaction(async (tx) => {
      // Bloquer les doublons par numéro (Idempotence)
      const existing = await tx.achat.findUnique({
        where: { numero: num },
        select: { id: true }
      })
      if (existing) {
        throw new Error('DOUBLE_TRANSACTION: Cet achat a déjà été enregistré.')
      }
      // 1. Créer l'achat et ses lignes
      const a = await tx.achat.create({
        data: {
          numero: num,
          date: dateAchat,
          magasinId,
          entiteId: entiteId,
          utilisateurId: session.userId,
          fournisseurId,
          fournisseurLibre,
          montantTotal,
          fraisApproche,
          montantPaye,
          statutPaiement,
          modePaiement: listReglements.length > 1 ? 'MULTI' : (listReglements[0]?.mode || modePaiementPrincipal),
          numeroCamion,
          observation,
          lignes: {
            create: lignesValides.map((l) => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              coutUnitaire: l.coutUnitaire || l.prixUnitaire,
              tva: l.tva,
              remise: l.remise,
              montant: l.montant,
            })),
          },
        },
        include: {
          lignes: true,
          magasin: { select: { code: true, nom: true } },
          fournisseur: { select: { id: true, code: true, nom: true, telephone: true, email: true, localisation: true, ncc: true } },
        },
      })

      // 2. Mise à jour des stocks et du PAMP
      // Regrouper les lignes par produit pour calcul PAMP correct (stock pré-achat)
      const lignesParProduit = new Map<number, { quantite: number; valeurAchatNet: number; prixUnitaireFallback: number }>()
      for (const l of lignesValides) {
        const existing = lignesParProduit.get(l.produitId)
        if (existing) {
          existing.quantite += l.quantite
          existing.valeurAchatNet += l.valeurAchatNet
        } else {
          lignesParProduit.set(l.produitId, { quantite: l.quantite, valeurAchatNet: l.valeurAchatNet, prixUnitaireFallback: l.prixUnitaire })
        }
      }

      for (const [produitId, groupe] of lignesParProduit) {
        const targetProduit = await tx.produit.findUnique({
          where: { id: produitId },
          include: { stocks: true }
        })

        if (targetProduit) {
          const stockGlobalAvant = targetProduit.stocks.reduce((acc: number, s: any) => acc + s.quantite, 0)
          const pampActuel = targetProduit.pamp || targetProduit.prixAchat || 0

          const pampAjuste = nouveauPampApresAchatLigne({
            stockGlobalAvant,
            pampActuel,
            quantiteLigne: groupe.quantite,
            valeurAchatNet: groupe.valeurAchatNet,
            prixUnitaireFallback: groupe.prixUnitaireFallback,
          })
          
          await tx.produit.update({
            where: { id: produitId },
            data: { pamp: pampAjuste }
          })
        }
      }

      for (const l of lignesValides) {
        let st = await tx.stock.findUnique({
          where: { produitId_magasinId_entiteId: { produitId: l.produitId, magasinId, entiteId } },
        })

        if (!st) {
          st = await tx.stock.create({
            data: { produitId: l.produitId, magasinId, entiteId, quantite: 0, quantiteInitiale: 0 },
          })
        }

        await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            produitId: l.produitId,
            magasinId,
            entiteId: entiteId,
            utilisateurId: session.userId,
            quantite: l.quantite,
            dateOperation: dateAchat,
            observation: `Achat ${num}`,
          },
        })

        await tx.stock.update({
          where: { id: st.id },
          data: { quantite: { increment: l.quantite } },
        })
      }

      // 3. Règlement(s) automatique(s) - MULTI-PAIEMENT
      let resteReglement = montantTotal
      const reglementsEffectifs: { mode: string; montant: number }[] = []
      for (const reg of listReglements) {
        const montantReg = Math.min(reg.montant, resteReglement)
        if (montantReg <= 0) continue
        resteReglement -= montantReg
        reglementsEffectifs.push({ mode: reg.mode, montant: montantReg })

        const reglAchat = await tx.reglementAchat.create({
          data: {
            achatId: a.id,
            fournisseurId,
            entiteId,
            montant: montantReg,
            modePaiement: reg.mode,
            utilisateurId: session.userId,
            observation: `Règlement ${reg.mode} - Achat ${num}`,
            date: dateAchat,
          }
        })

        await tx.reglementAchatLigne.create({
          data: {
            reglementId: reglAchat.id,
            achatId: a.id,
            montant: montantReg,
          }
        })

        // 4. Synchronisation physique trésorerie (caisse / banque)
        if (estModeEspeces(reg.mode)) {
          await enregistrerMouvementCaisse({
            magasinId,
            type: 'SORTIE',
            motif: `Règlement Achat ${num}`,
            montant: montantReg,
            utilisateurId: session.userId,
            entiteId,
            date: dateAchat,
          }, tx)
          await recalculerSoldeCaisse(magasinId, tx)
        } else if (estModeBanque(reg.mode)) {
          const { enregistrerOperationBancaire } = await import('@/lib/banque')
          await enregistrerOperationBancaire({
            banqueId: body?.banqueId ? Number(body.banqueId) : null,
            entiteId,
            date: dateAchat,
            type: 'REGLEMENT_FOURNISSEUR',
            libelle: `Règlement Achat ${num}`,
            montant: montantReg,
            utilisateurId: session.userId,
            reference: num,
            beneficiaire: a?.fournisseur?.nom || fournisseurLibre || null,
            observation: `Paiement via ${reg.mode}`
          }, tx)
        }
      }

      // 6. Comptabilisation
      await comptabiliserAchat({
        achatId: a.id,
        numeroAchat: num,
        date: dateAchat,
        montantTotal,
        fraisApproche,
        modePaiement: reglementsEffectifs.length > 1 ? 'MULTI' : (reglementsEffectifs[0]?.mode || modePaiementPrincipal),
        fournisseurId,
        entiteId,
        utilisateurId: session.userId,
        magasinId,
        reglements: reglementsEffectifs,
        lignes: lignesValides,
      }, tx)

      return a
    }, { timeout: 20000 })

    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/achats')
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/achats')

    return NextResponse.json(achat)
  } catch (e: any) {
    console.error('POST /api/achats:', e)
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Cet achat a déjà été enregistré (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
