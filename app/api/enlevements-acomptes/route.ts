import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/require-role'
import { getEntiteId } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'
import { montantLigneTTC, montantTotalVenteDocument } from '@/lib/calculs-commerciaux'
import { comptabiliserLivraisonCommande } from '@/lib/comptabilisation'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'ventes:create')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const { clientId, clientLibre, magasinId: magasinSaisi, montant, montantRembourse, dateReglement, lignes } = body
    const montantRemb = Math.max(0, Number(montantRembourse) || 0)
    const montantProduits = montant - montantRemb

    if (!montant || montant <= 0) {
      return NextResponse.json({ error: 'montant requis.' }, { status: 400 })
    }
    if (montantRemb < 0 || montantProduits < 0) {
      return NextResponse.json({ error: 'montantRembourse invalide.' }, { status: 400 })
    }
    if (!clientId && !clientLibre) {
      return NextResponse.json({ error: 'clientId ou clientLibre requis.' }, { status: 400 })
    }
    if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
      return NextResponse.json({ error: 'Au moins une ligne produit requise.' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })

    // ----- Client (enregistré ou au comptoir) -----
    let client: { id: number; code: string | null; nom: string } | null = null
    let clientLibreValue: string | null = null

    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, code: true, nom: true },
      })
      if (!client) return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 })
    } else {
      client = await prisma.client.findFirst({
        where: { code: 'COMPTOIR' },
        select: { id: true, code: true, nom: true },
      })
      if (!client) {
        client = await prisma.client.create({
          data: { code: 'COMPTOIR', nom: 'CLIENT AU COMPTOIR', entiteId, type: 'PARTICULIER' },
          select: { id: true, code: true, nom: true },
        })
      }
      clientLibreValue = clientLibre || 'Client au comptoir'
    }

    const maintenant = new Date()

    // ----- Magasin -----
    let magasinId = magasinSaisi ? Number(magasinSaisi) : 0
    if (!magasinId) {
      const mag = await prisma.magasin.findFirst({
        where: { actif: true, entiteId },
        orderBy: { id: 'asc' },
      })
      magasinId = mag?.id ?? 0
    }
    if (!magasinId) return NextResponse.json({ error: 'Aucun magasin actif trouvé.' }, { status: 400 })

    // ----- Produits -----
    const tousProduitIds = [...new Set(lignes.map((l: any) => Number(l.produitId)).filter(Boolean))]
    const produits = await prisma.produit.findMany({
      where: { id: { in: tousProduitIds } },
    })
    const produitsMap = new Map(produits.map(p => [p.id, p]))

    const lignesValides: any[] = []
    let montantTotalProduits = 0

    for (const l of lignes) {
      const produitId = Number(l.produitId)
      const quantite = Math.max(0, Number(l.quantite) || 0)
      if (!produitId || quantite <= 0) continue

      const produit = produitsMap.get(produitId)
      if (!produit) continue

      const designation = produit.designation
      const prixUnitaire = Number(l.prixUnitaire) || produit.prixVente || 0
      const coutUnitaire = produit.pamp || produit.prixAchat || 0
      const tva = Number(l.tva) || 0
      const remise = Number(l.remise) || 0

      const montantLigne = montantLigneTTC({ quantite, prixUnitaire, remiseLigne: remise, tvaPourcent: tva })

      montantTotalProduits += montantLigne
      lignesValides.push({ produitId, designation, quantite, prixUnitaire, coutUnitaire, tva, remise, montant: montantLigne })
    }

    if (lignesValides.length === 0) {
      return NextResponse.json({ error: 'Lignes de vente invalides.' }, { status: 400 })
    }

    const montantFinal = montantTotalVenteDocument(montantTotalProduits, 0, 0)
    const diff = Math.abs(montantFinal - montantProduits)
    if (diff > 100) {
      return NextResponse.json({
        error: `Le total des produits (${montantFinal.toLocaleString()} F) ne correspond pas au montant alloué aux produits (${montantProduits.toLocaleString()} F).`
      }, { status: 400 })
    }

    // ----- Transaction unique -----
    const numVente = `V${Date.now()}`

    const result = await prisma.$transaction(async (tx) => {
      // 0. Récupérer/créer les acomptes (atomicité totale)
      let reglements = await tx.reglementVente.findMany({
        where: {
          clientId: client.id,
          venteId: null,
          statut: { in: ['VALIDEE', 'VALIDE'] },
        },
        include: {
          ReglementVenteLigne: { select: { montant: true } },
        },
        orderBy: { date: 'asc' },
      })

      if (reglements.length === 0 && !clientLibreValue) {
        throw new Error('Aucun acompte disponible pour ce client.')
      }

      if (reglements.length === 0 && clientLibreValue) {
        const dateRegl = dateReglement && typeof dateReglement === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateReglement)
          ? new Date(dateReglement + 'T00:00:00')
          : maintenant
        const nouveauReglement = await tx.reglementVente.create({
          data: {
            clientId: client.id,
            date: dateRegl,
            montant,
            modePaiement: 'ESPECES',
            statut: 'VALIDEE',
            entiteId,
            utilisateurId: session!.userId,
          },
        })
        reglements = [{
          ...nouveauReglement,
          ReglementVenteLigne: [],
        }]
      }

      const disponibles: { id: number; montant: number }[] = []
      let totalDisponible = 0
      for (const r of reglements) {
        const dejaAlloue = r.ReglementVenteLigne.reduce((s, l) => s + l.montant, 0)
        const restant = r.montant - dejaAlloue
        if (restant > 0) {
          disponibles.push({ id: r.id, montant: restant })
          totalDisponible += restant
        }
      }

      if (totalDisponible <= 0) {
        throw new Error('Acomptes déjà entièrement alloués.')
      }

      if (montant > totalDisponible) {
        throw new Error(`Le montant (${montant.toLocaleString()} F) dépasse le total disponible (${totalDisponible.toLocaleString()} F).`)
      }

      // 1. Créer la Vente
      const vente = await tx.vente.create({
        data: {
          numero: numVente,
          date: maintenant,
          magasinId, entiteId,
          clientId: client.id,
          clientLibre: clientLibreValue,
          montantTotal: montantFinal,
          montantPaye: montantProduits,
          statutPaiement: 'PAYE',
          modePaiement: reglements[0].modePaiement,
          retraitDiffere: false,
          typeVente: 'LIVRAISON_IMMEDIATE',
          statut: 'VALIDEE',
          utilisateurId: session!.userId,
          lignes: {
            create: lignesValides.map((lv) => ({
              produitId: lv.produitId,
              designation: lv.designation,
              quantite: lv.quantite,
              prixUnitaire: lv.prixUnitaire,
              coutUnitaire: lv.coutUnitaire,
              tva: lv.tva,
              remise: lv.remise,
              montant: lv.montant,
            })),
          },
        },
        include: { lignes: true },
      })

      // 2. Allouer les acomptes
      let resteAllouer = montant
      for (const dispo of disponibles) {
        if (resteAllouer <= 0) break
        const montantAlloue = Math.min(resteAllouer, dispo.montant)
        await tx.reglementVenteLigne.create({
          data: { reglementId: dispo.id, venteId: vente.id, montant: montantAlloue },
        })
        await tx.reglementVente.update({
          where: { id: dispo.id },
          data: { venteId: vente.id },
        })
        resteAllouer -= montantAlloue
      }

      // 3. Déduire le stock + RetraitPartiel
      let montantTotalRetrait = 0
      const lignesRetirees: any[] = []
      const lignesUpdate: { id: number; quantiteLivree: number }[] = []

      for (const lv of lignesValides) {
        const st = await tx.stock.findUnique({
          where: {
            produitId_magasinId_entiteId: { produitId: lv.produitId, magasinId, entiteId },
          },
        })
        if ((st?.quantite ?? 0) < lv.quantite) {
          throw new Error(`Stock insuffisant pour ${lv.designation} (${st?.quantite || 0} dispo, ${lv.quantite} requis).`)
        }

        await tx.stock.update({
          where: {
            produitId_magasinId_entiteId: { produitId: lv.produitId, magasinId, entiteId },
          },
          data: { quantite: { decrement: lv.quantite } },
        })

        await tx.mouvement.create({
          data: {
            type: 'SORTIE',
            produitId: lv.produitId,
            magasinId,
            entiteId,
            utilisateurId: session!.userId,
            quantite: lv.quantite,
            dateOperation: maintenant,
            observation: `Retrait vente ${numVente}`,
          },
        })

        const ligneVente = vente.lignes.find((vl: any) => vl.produitId === lv.produitId)
        if (ligneVente) {
          const quantiteLivree = lv.quantite
          lignesUpdate.push({ id: ligneVente.id, quantiteLivree })
        }

        montantTotalRetrait += lv.montant
        lignesRetirees.push({
          produitId: lv.produitId,
          designation: lv.designation,
          quantite: lv.quantite,
          prixUnitaire: lv.prixUnitaire,
          coutUnitaire: lv.coutUnitaire,
          tva: lv.tva,
          remise: lv.remise,
        })
      }

      for (const lu of lignesUpdate) {
        await tx.venteLigne.update({ where: { id: lu.id }, data: { quantiteLivree: lu.quantiteLivree } })
      }

      // Créer le RetraitPartiel
      const lastNum = await tx.retraitPartiel.findFirst({
        where: { entiteId }, orderBy: { id: 'desc' }, select: { numero: true },
      })
      const nextNum = lastNum ? String(Number(lastNum.numero) + 1).padStart(6, '0') : '000001'

      await tx.retraitPartiel.create({
        data: {
          numero: nextNum,
          venteId: vente.id,
          date: maintenant,
          utilisateurId: session!.userId,
          entiteId,
          lignes: {
            create: lignesRetirees.map((lr: any) => ({
              produitId: lr.produitId,
              designation: lr.designation,
              quantite: lr.quantite,
              prixUnitaire: lr.prixUnitaire,
              montant: lr.prixUnitaire * lr.quantite,
            })),
          },
        },
      })

      // 5. Mouvement caisse pour remboursement
      if (montantRemb > 0 && estModeEspeces(reglements[0].modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId,
          type: 'SORTIE',
          motif: `Remb. acompte ${numVente}`,
          montant: montantRemb,
          utilisateurId: session!.userId,
          entiteId,
          date: maintenant,
        }, tx)
        await recalculerSoldeCaisse(magasinId, tx)
      }

      // 6. Comptabilisation (4191 → 701 + sortie stock + remboursement)
      await comptabiliserLivraisonCommande({
        venteId: vente.id,
        numeroVente: numVente,
        date: maintenant,
        montantTotal: montantFinal,
        montantRembourse: montantRemb,
        entiteId,
        utilisateurId: session!.userId,
        magasinId,
        lignes: lignesRetirees,
      }, tx)

      return vente
    }, { timeout: 30000 })

    const clientInfo = clientLibreValue
      ? { id: client.id, nom: clientLibreValue, code: client.code }
      : { id: client.id, nom: client.nom, code: client.code }

    return NextResponse.json({
      success: true,
      vente: {
        id: result.id,
        numero: result.numero,
        montantTotal: result.montantTotal,
        montantPaye: result.montantPaye,
        montantRembourse: montantRemb,
        statutPaiement: result.statutPaiement,
        client: clientInfo,
        lignes: lignesValides.length,
      },
    })
  } catch (e) {
    await apiCatch(e, 'api/enlevements-acomptes')
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
