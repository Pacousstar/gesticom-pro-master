import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAction, getIpAddress, getUserAgent } from '@/lib/audit'
import { comptabiliserVente, comptabiliserReglementVente } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { ensureActivated } from '@/lib/security'
import { enregistrerMouvementCaisse, estModeEspeces } from '@/lib/caisse'

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
  const where: { date?: { gte: Date; lte: Date }; entiteId?: number; clientId?: number } = {}
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
        client: { select: { code: true, nom: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
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

  const res = NextResponse.json({
    data: ventes,
    totals: {
      montantTotal: aggregates._sum.montantTotal || 0,
      montantPaye: aggregates._sum.montantPaye || 0,
      resteAPayer: (aggregates._sum.montantTotal || 0) - (aggregates._sum.montantPaye || 0),
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
    let listReglements: { mode: string; montant: number }[] = []

    if (reglementsPayload.length > 0) {
      // Si on reçoit une liste de règlements, on les additionne
      for (const r of reglementsPayload) {
        const amt = Math.max(0, Number(r.montant) || 0)
        if (amt > 0) {
          listReglements.push({ mode: String(r.mode).toUpperCase(), montant: amt })
          montantPaye += amt
        }
      }
    } else {
      // Fallback sur l'ancien système (paiement unique)
      const montantPayeRaw = body?.montantPaye != null ? Math.max(0, Number(body.montantPaye) || 0) : null
      if (montantPayeRaw !== null) {
         montantPaye = montantPayeRaw
         listReglements.push({ mode: modePaiementPrincipal, montant: montantPaye })
      } else {
         // Si rien n'est spécifié, on considère tout payé sauf si CREDIT
         montantPaye = modePaiementPrincipal === 'CREDIT' ? 0 : 999999999 // Sera limité au total après
      }
    }

    const dateStr = body?.date != null ? String(body.date).trim() : null
    let dateVente = new Date()
    if (dateStr) {
      const now = new Date()
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
    if (!lignes.length) {
      return NextResponse.json({ error: 'Au moins une ligne de vente requise.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    const magasin = await prisma.magasin.findUnique({ where: { id: magasinId } })
    if (!magasin) return NextResponse.json({ error: 'Magasin introuvable.' }, { status: 400 })

    let montantTotalAVantRemise = 0
    const lignesValides: any[] = []

    for (const l of lignes) {
      const produitId = Number(l?.produitId)
      const quantite = Math.max(0, Number(l?.quantite) || 0) // Supprimé Math.floor pour autoriser KG/Litre
      const prixUnitaire = Math.max(0, Number(l?.prixUnitaire) || 0)
      const tva = Math.max(0, Number(l?.tva) || 0)
      const remise = Math.max(0, Number(l?.remise) || 0)
      
      if (isNaN(produitId) || isNaN(quantite) || isNaN(prixUnitaire)) continue
      if (!produitId || quantite <= 0) continue

      const produit = await prisma.produit.findUnique({ where: { id: produitId } })
      if (!produit) continue

      // Validation du prix minimum (PVM) - BLOCAGE STRICT (Même pour le Patron)
      const prixMin = produit.prixMinimum || 0
      if (prixMin > 0 && prixUnitaire < prixMin) {
        const ip = getIpAddress(request)
        // Log de la tentative suspecte
        await logAction(session, 'ANNULATION', 'VENTE', 
          `TENTATIVE PRIX BAS : ${session.nom} a tenté de vendre ${produit.designation} à ${prixUnitaire} F (Prix Mini: ${prixMin} F)`,
          produit.id, { prixSaisi: prixUnitaire, prixMini: prixMin }, ip
        )
        // Blocage sans exception
        return NextResponse.json({ 
          error: `Action interdite : Le prix pour ${produit.designation} (${prixUnitaire.toLocaleString('fr-FR')} F) est inférieur au prix minimum de sécurité (${prixMin.toLocaleString('fr-FR')} F) défini dans le catalogue.` 
        }, { status: 400 })
      }

      const designation = produit.designation
      const coutUnitaire = produit.pamp || produit.prixAchat || 0
      const montantHT = quantite * prixUnitaire
      const montantLigne = Math.round((montantHT - remise) * (1 + tva / 100))
      
      montantTotalAVantRemise += montantLigne
      lignesValides.push({ produitId, designation, quantite, prixUnitaire, coutUnitaire, tva, remise, montant: montantLigne })
    }

    if (!lignesValides.length) {
      return NextResponse.json({ error: 'Lignes de vente invalides.' }, { status: 400 })
    }

    const montantTotal = Math.max(0, Math.round(montantTotalAVantRemise - remiseGlobale + fraisApproche))
    
    // --- SECURITE : Gestion des Trop-perçus et Avoirs ---
    let surplusAvoir = 0
    if (montantPaye > montantTotal + 0.1) {
       if (clientId) {
          // Client identifié : On accepte le surplus et on le transforme en avoir
          surplusAvoir = Math.round(montantPaye - montantTotal)
          montantPaye = montantTotal // Le montant payé "sur la facture" est le total TTC
       } else {
          // Client anonyme : Pas d'endroit où stocker l'avoir => Blocage
          return NextResponse.json({ 
            error: `Paiement invalide : Pas d'avoir possible pour un client anonyme. Le total versé (${montantPaye.toLocaleString()} F) dépasse la facture (${montantTotal.toLocaleString()} F).` 
          }, { status: 400 })
       }
    }

    if (reglementsPayload.length === 0 && modePaiementPrincipal !== 'CREDIT' && montantPaye === 0) {
        // Fallback pour compatibilité si montantPaye non envoyé
        montantPaye = montantTotal
        listReglements = [{ mode: modePaiementPrincipal, montant: montantPaye }]
    }
    
    const statutPaiement = montantPaye >= montantTotal ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'
    
    // --- PRECISION : Points calculés sur le TOTAL de la facture ---
    const pointsGagnes = Math.floor(montantTotal)

    if (statutPaiement === 'CREDIT' || statutPaiement === 'PARTIEL') {
      if (clientId == null) return NextResponse.json({ error: 'Vente à crédit : un client doit être sélectionné.' }, { status: 400 })
      const client = await prisma.client.findUnique({ where: { id: clientId } })
      if (!client) return NextResponse.json({ error: 'Client introuvable.' }, { status: 400 })
      if (client.type !== 'CREDIT') return NextResponse.json({ error: 'Le client doit être de type CREDIT.' }, { status: 400 })
      if (client.plafondCredit == null) return NextResponse.json({ error: 'Le client doit avoir un plafond de crédit.' }, { status: 400 })
      
      const ventesClient = await prisma.vente.findMany({ where: { clientId, statut: 'VALIDEE' }})
      const detteFactures = ventesClient.reduce((s: number, v: any) => s + (v.montantTotal - (v.montantPaye ?? 0)), 0)
      
      const regsLibres = await prisma.reglementVente.aggregate({
        where: { clientId, venteId: null },
        _sum: { montant: true }
      })
      const totalRegsLibres = regsLibres._sum?.montant || 0
      
      const detteReelle = (detteFactures + (client.soldeInitial || 0)) - (totalRegsLibres + (client.avoirInitial || 0))
      
      if (detteReelle + (montantTotal - montantPaye) > client.plafondCredit) {
         return NextResponse.json({ error: 'Plafond crédit dépassé.' }, { status: 400 })
      }
    }

    for (const l of lignesValides) {
      const st = await prisma.stock.findUnique({ where: { produitId_magasinId: { produitId: l.produitId, magasinId } } })
      if ((st?.quantite ?? 0) < l.quantite) {
        return NextResponse.json({ error: `Stock insuffisant pour ${l.designation}.` }, { status: 400 })
      }
    }

    const num = `V${Date.now()}`
    
    const vente = await prisma.$transaction(async (tx) => {
      // 1. Créer la vente et ses lignes
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
          // @ts-ignore
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
              // @ts-ignore
              coutUnitaire: l.coutUnitaire,
              tva: l.tva,
              remise: l.remise,
              montant: l.montant,
            })),
          },
        },
        include: { lignes: true, magasin: { select: { code: true, nom: true } } },
      })

      // 2. Mettre à jour les stocks et créer les mouvements
      for (const l of lignesValides) {
        await tx.stock.updateMany({
          where: { produitId: l.produitId, magasinId },
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

      // 3. Fidélité
      if (clientId && pointsGagnes > 0) {
        await tx.client.update({
          where: { id: clientId },
          // @ts-ignore
          data: { pointsFidelite: { increment: pointsGagnes } }
        })
      }

      // 4. Règlement(s) automatique(s) - MULTI-PAIEMENT
      for (const reg of listReglements) {
        const montantReg = Math.min(reg.montant, montantTotal) // Sécurité
        if (montantReg <= 0) continue

        await tx.reglementVente.create({
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

        // 5. Mouvement de caisse : Désormais géré automatiquement par comptabiliserVente
      }

      // 6. Création de l'AVOIR si surplus (Règlement libre hors venteId)
      if (surplusAvoir > 0) {
        const modeAvoir = listReglements.length > 0 ? listReglements[0].mode : modePaiementPrincipal
        await tx.reglementVente.create({
          data: {
            clientId,
            entiteId,
            montant: surplusAvoir,
            modePaiement: modeAvoir,
            utilisateurId: session.userId,
            observation: `AVOIR généré par trop-perçu sur vente ${num}`,
            date: dateVente,
          }
        })
        
        // Comptabilisation de l'avoir
        await comptabiliserReglementVente({
          venteId: null, 
          numeroVente: `${num} (AVOIR)`,
          date: dateVente,
          montant: surplusAvoir,
          modePaiement: modeAvoir,
          utilisateurId: session.userId,
          entiteId: entiteId,
          magasinId: magasinId
        }, tx)
      }

      // 7. Comptabilisation
      await comptabiliserVente({
        venteId: v.id,
        numeroVente: num,
        date: dateVente,
        montantTotal,
        modePaiement: listReglements.length > 1 ? 'MULTI' : (listReglements[0]?.mode || modePaiementPrincipal),
        clientId,
        entiteId,
        utilisateurId: session.userId,
        magasinId,
        reglements: listReglements, 
        fraisApproche,
        lignes: lignesValides, // Ajout des lignes pour la TVA et le stock
      }, tx)

      return v
    })

    revalidatePath('/dashboard/ventes')
    revalidatePath('/api/ventes')

    return NextResponse.json(vente)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
