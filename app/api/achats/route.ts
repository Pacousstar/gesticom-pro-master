import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { comptabiliserAchat, comptabiliserReglementAchat } from '@/lib/comptabilisation'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { ensureActivated } from '@/lib/security'
import { enregistrerMouvementCaisse, estModeEspeces } from '@/lib/caisse'

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
  const where: { date?: { gte: Date; lte: Date }; entiteId?: number } = {}
  if (dateDebut && dateFin) {
    where.date = {
      gte: new Date(dateDebut + 'T00:00:00'),
      lte: new Date(dateFin + 'T23:59:59'),
    }
  }
  // Filtrer par entité de la session (sauf SUPER_ADMIN qui voit tout)
  if (session.role !== 'SUPER_ADMIN' && session.entiteId) {
    where.entiteId = session.entiteId
  }

  const [achats, total, aggregates] = await Promise.all([
    prisma.achat.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        magasin: { select: { code: true, nom: true } },
        fournisseur: { select: { id: true, code: true, nom: true, telephone: true, email: true, localisation: true, ncc: true } },
        lignes: { include: { produit: { select: { code: true, designation: true } } } },
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

  const res = NextResponse.json({
    data: achats,
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
    let listReglements: { mode: string; montant: number }[] = []

    if (reglementsPayload.length > 0) {
      for (const r of reglementsPayload) {
        const amt = Math.max(0, Number(r.montant) || 0)
        if (amt > 0) {
          listReglements.push({ mode: String(r.mode).toUpperCase(), montant: amt })
          montantPaye += amt
        }
      }
    } else {
      const montantPayeRaw = body?.montantPaye != null ? Math.max(0, Number(body.montantPaye) || 0) : null
      if (montantPayeRaw !== null) {
        montantPaye = montantPayeRaw
        listReglements.push({ mode: modePaiementPrincipal, montant: montantPaye })
      } else {
        montantPaye = modePaiementPrincipal === 'CREDIT' ? 0 : 999999999 // Sera ajusté au total
      }
    }

    const dateStr = body?.date != null ? String(body.date).trim() : null
    const now = new Date()
    let dateAchat = now
    if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number)
      dateAchat = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
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
    const lignesValides: any[] = []

    for (const l of lignes) {
      const produitId = Number(l?.produitId)
      const quantite = Math.max(0, Number(l?.quantite) || 0) // Supprimé Math.floor
      const prixUnitaire = Math.max(0, Number(l?.prixUnitaire) || 0)
      const tva = Math.max(0, Number(l?.tva) || 0)
      const remise = Math.max(0, Number(l?.remise) || 0)
      if (!produitId || quantite <= 0) continue

      const produit = await prisma.produit.findUnique({ where: { id: produitId } })
      if (!produit) continue

      const designation = produit.designation
      const montantHT = quantite * prixUnitaire
      const montantLigne = Math.round((montantHT - remise) * (1 + tva / 100))
      
      montantFactureHT += (montantHT - remise) // Base pour prorata des frais
      lignesValides.push({ produitId, designation, quantite, prixUnitaire, tva, remise, montant: montantLigne, htNet: (montantHT - remise) })
    }

    if (!lignesValides.length) {
      return NextResponse.json({ error: 'Lignes invalides.' }, { status: 400 })
    }

    const montantTotal = lignesValides.reduce((acc, l) => acc + l.montant, 0)
    
    // --- SECURITE : Gestion des Trop-perçus et Avoirs Fournisseurs ---
    let surplusAvoir = 0
    if (montantPaye > montantTotal + 0.1) {
       if (fournisseurId) {
          // Fournisseur identifié : On accepte le surplus et on le transforme en avoir
          surplusAvoir = Math.round(montantPaye - montantTotal)
          montantPaye = montantTotal
       } else {
          // Pas de fournisseur identifié => Blocage
          return NextResponse.json({ 
            error: `Paiement invalide : Pas d'avoir possible sans fournisseur identifié. Le total versé (${montantPaye.toLocaleString()} F) dépasse l'achat (${montantTotal.toLocaleString()} F).` 
          }, { status: 400 })
       }
    }

    if (reglementsPayload.length === 0 && modePaiementPrincipal !== 'CREDIT' && montantPaye === 0) {
        montantPaye = montantTotal
        listReglements = [{ mode: modePaiementPrincipal, montant: montantPaye }]
    }

    
    const statutPaiement = montantPaye >= montantTotal ? 'PAYE' : montantPaye > 0 ? 'PARTIEL' : 'CREDIT'

    const num = `A${Date.now()}`
    
    const achat = await prisma.$transaction(async (tx) => {
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
      for (const l of lignesValides) {
        // a. Calcul du PAMP
        const targetProduit = await tx.produit.findUnique({
          where: { id: l.produitId },
          include: { stocks: true }
        })

        if (targetProduit) {
          // --- CALCUL PAMP PRÉCISION SYCOHADA (Gère le stock négatif) ---
          const stockGlobalAvant = targetProduit.stocks.reduce((acc: number, s: any) => acc + s.quantite, 0)
          const pampActuel = targetProduit.pamp || targetProduit.prixAchat || 0
          
          // Calcul de la part des frais d'approche au prorata de la valeur HT de cette ligne
          const partFrais = montantFactureHT > 0 ? (l.htNet / montantFactureHT) * fraisApproche : 0
          const valeurAchatNet = l.htNet + partFrais
          
          let nouveauPamp = pampActuel
          
          if (stockGlobalAvant <= 0) {
            // Cas Stock Négatif ou Vide : Le nouveau prix d'achat devient la référence
            nouveauPamp = (l.quantite > 0) ? valeurAchatNet / l.quantite : pampActuel
          } else {
            // Formule standard PAMP : (Valeur Stock Existant + Valeur Achat) / Quantité Totale
            const valeurStockExistant = stockGlobalAvant * pampActuel
            nouveauPamp = (valeurStockExistant + valeurAchatNet) / (stockGlobalAvant + l.quantite)
          }
          
          // Sécurité contre NaN/Infinity
          if (isNaN(nouveauPamp) || !isFinite(nouveauPamp)) nouveauPamp = l.prixUnitaire
          
          const pampAjuste = Math.round(nouveauPamp)
          
          await tx.produit.update({
            where: { id: l.produitId },
            data: { pamp: pampAjuste }
          })
        }


        // b. Gérer le stock par magasin
        let st = await tx.stock.findUnique({
          where: { produitId_magasinId: { produitId: l.produitId, magasinId } },
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
            observation: `Achat ${num}`,
          },
        })

        await tx.stock.update({
          where: { id: st.id },
          data: { quantite: { increment: l.quantite } },
        })
      }

      // 3. Règlement(s) automatique(s) - MULTI-PAIEMENT
      for (const reg of listReglements) {
        const montantReg = Math.min(reg.montant, montantTotal)
        if (montantReg <= 0) continue

        await tx.reglementAchat.create({
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

        // 4. Mouvement de caisse : Désormais géré automatiquement par comptabiliserAchat
      }

      // 5. Création de l'AVOIR FOURNISSEUR si surplus
      if (surplusAvoir > 0) {
        const modeAvoir = listReglements.length > 0 ? listReglements[0].mode : modePaiementPrincipal
        await tx.reglementAchat.create({
          data: {
            fournisseurId,
            entiteId,
            montant: surplusAvoir,
            modePaiement: modeAvoir,
            utilisateurId: session.userId,
            observation: `AVOIR généré par trop-perçu sur achat ${num}`,
            date: dateAchat,
          }
        })
        
        // Comptabilisation de l'avoir fournisseur
        await comptabiliserReglementAchat({
          achatId: null, 
          numeroAchat: `${num} (AVOIR)`,
          date: dateAchat,
          montant: surplusAvoir,
          modePaiement: modeAvoir,
          utilisateurId: session.userId,
          entiteId: entiteId,
          magasinId: magasinId
        }, tx)
      }

      // 6. Comptabilisation
      await comptabiliserAchat({
        achatId: a.id,
        numeroAchat: num,
        date: dateAchat,
        montantTotal,
        fraisApproche,
        modePaiement: listReglements.length > 1 ? 'MULTI' : (listReglements[0]?.mode || modePaiementPrincipal),
        fournisseurId,
        entiteId,
        utilisateurId: session.userId,
        magasinId,
        reglements: listReglements,
        lignes: lignesValides,
      }, tx)

      return a
    })

    // Invalider le cache pour affichage immédiat
    revalidatePath('/dashboard/achats')
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/achats')

    return NextResponse.json(achat)
  } catch (e) {
    console.error('POST /api/achats:', e)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
