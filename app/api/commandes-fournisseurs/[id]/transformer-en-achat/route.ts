import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { comptabiliserAchat } from '@/lib/comptabilisation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'achats:create')
  if (forbidden) return forbidden

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  try {
    const commande = await prisma.commandeFournisseur.findUnique({
      where: { id },
      include: { lignes: true }
    })

    if (!commande) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    if (commande.statut === 'RECUE') return NextResponse.json({ error: 'Déjà réceptionnée' }, { status: 400 })

    const entiteId = await getEntiteId(session)
    const num = `A${Date.now()}`

    const results = await prisma.$transaction(async (tx) => {
      const frais = commande.fraisApproche || 0
      
      // 1. Créer l'Achat réel basé sur le BC
      const achat = await tx.achat.create({
        data: {
          numero: num,
          date: new Date(),
          magasinId: commande.magasinId,
          entiteId,
          utilisateurId: session.userId,
          fournisseurId: commande.fournisseurId,
          fournisseurLibre: commande.fournisseurLibre,
          montantTotal: commande.montantTotal,
          fraisApproche: frais,
          montantPaye: 0,
          statut: 'VALIDEE',
          statutPaiement: 'CREDIT',
          modePaiement: 'ESPECES',
          observation: `Réception BC ${commande.numero}`,
          lignes: {
            create: commande.lignes.map((l) => ({
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              tva: l.tva || 0,
              remise: l.remise || 0,
              montant: l.montant,
            })),
          },
        },
        include: { lignes: true }
      })

      // 2. Mouvement de stock et PAMP (Logique v2.0.1 unifiée)
      for (const l of achat.lignes) {
        const p = await tx.produit.findUnique({ 
          where: { id: l.produitId }, 
          include: { stocks: true } 
        })
        
        if (p) {
          // Calcul du PAMP Robuste (Gestion stocks négatifs / Dettes de stock)
          const qteActuelle = p.stocks.reduce((acc, s) => acc + s.quantite, 0)
          const pampAncien = p.pamp || p.prixAchat || 0
          
          let nouveauPamp = pampAncien
          const qteAchat = l.quantite
          // On répartit les frais d'approche au prorata du montant HT si plusieurs lignes, 
          // ou proportionnellement ici pour simplifier (frais / nbLignes)
          const fraisLigne = frais / achat.lignes.length 
          const coutTotalLigne = (l.prixUnitaire * qteAchat) + fraisLigne
          const prixRevientUnitaire = coutTotalLigne / qteAchat

          if (qteActuelle <= 0) {
            // Si stock négatif ou nul, le nouvel achat devient la référence de prix
            nouveauPamp = prixRevientUnitaire
          } else {
            // Formule standard PAMP
            nouveauPamp = ((qteActuelle * pampAncien) + coutTotalLigne) / (qteActuelle + qteAchat)
          }

          await tx.produit.update({ 
            where: { id: l.produitId }, 
            data: { 
              pamp: Math.round(nouveauPamp), 
              prixAchat: l.prixUnitaire 
            } 
          })
        }

        // b. Stock Magasin
        let st = await tx.stock.findUnique({
          where: { produitId_magasinId: { produitId: l.produitId, magasinId: achat.magasinId } },
        })
        if (!st) {
          st = await tx.stock.create({
            data: { produitId: l.produitId, magasinId: achat.magasinId, entiteId, quantite: 0 },
          })
        }
        await tx.stock.update({ where: { id: st.id }, data: { quantite: { increment: l.quantite } } })

        // c. Mouvement Physique de Stock
        await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            produitId: l.produitId,
            magasinId: achat.magasinId,
            entiteId,
            utilisateurId: session.userId,
            quantite: l.quantite,
            observation: `Réception BC ${commande.numero} (Achat ${num})`,
          },
        })
      }

      // 3. Marquer le BC comme reçu
      await tx.commandeFournisseur.update({
        where: { id },
        data: { statut: 'RECUE' }
      })

      // 4. Comptabilisation DÉTAILLÉE (Restaure la Classe 3)
      await comptabiliserAchat({
        achatId: achat.id,
        numeroAchat: num,
        date: new Date(),
        montantTotal: achat.montantTotal,
        fraisApproche: frais,
        modePaiement: 'ESPECES',
        fournisseurId: achat.fournisseurId,
        entiteId,
        utilisateurId: session.userId,
        magasinId: achat.magasinId,
        lignes: achat.lignes // Transmission des lignes pour la Classe 3
      }, tx)

      return achat
    })

    revalidatePath('/dashboard/achats')
    revalidatePath('/dashboard/commandes-fournisseurs')
    return NextResponse.json(results)
  } catch (e) {
    console.error('POST /api/commandes-fournisseurs/transformer:', e)
    return NextResponse.json({ error: 'Erreur lors de la transformation.' }, { status: 500 })
  }
}
