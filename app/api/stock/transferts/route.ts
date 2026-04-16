import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { logModification } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  try {
    const entiteId = await getEntiteId(session)
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit')) || 20
    const page = Number(searchParams.get('page')) || 1
    const skip = (page - 1) * limit

    const transferts = await prisma.transfert.findMany({
      where: { entiteId },
      include: {
        magasinOrigine: { select: { nom: true, code: true } },
        magasinDest: { select: { nom: true, code: true } },
        lignes: true,
        utilisateur: { select: { nom: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    })

    const total = await prisma.transfert.count({ where: { entiteId } })

    return NextResponse.json({
      data: transferts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (e) {
    console.error('GET /api/stock/transferts:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  
  const forbidden = requirePermission(session, 'stocks:view')
  if (forbidden) return forbidden

  try {
    const body = await request.json()
    const { magasinOrigineId, magasinDestId, observation, lignes } = body
    
    if (!magasinOrigineId || !magasinDestId || !lignes || !lignes.length) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    if (magasinOrigineId === magasinDestId) {
      return NextResponse.json({ error: 'Le magasin d\'origine et de destination doivent être différents' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)

    // Générer un numéro de transfert unique (ou utiliser celui du client pour l'idempotence)
    const count = await prisma.transfert.count({ where: { entiteId } })
    const numero = body.numero || `TRF-${new Date().getFullYear()}${(count + 1).toString().padStart(5, '0')}`

    const result = await prisma.$transaction(async (tx) => {
      // Bloquer les doublons par numéro (Idempotence)
      const existing = await tx.transfert.findUnique({
        where: { numero },
        select: { id: true }
      })
      if (existing) {
        throw new Error('DOUBLE_TRANSACTION: Ce transfert a déjà été enregistré.')
      }
      // 1. Créer le transfert
      const transfert = await tx.transfert.create({
        data: {
          numero,
          magasinOrigineId: Number(magasinOrigineId),
          magasinDestId: Number(magasinDestId),
          entiteId,
          utilisateurId: session.userId,
          observation: observation || 'Transfert inter-magasins',
          lignes: {
            create: lignes.map((l: any) => ({
              produitId: Number(l.produitId),
              designation: l.designation,
              quantite: Number(l.quantite)
            }))
          }
        },
        include: { lignes: true }
      })

      // 2. Traiter chaque ligne
      for (const ligne of transfert.lignes) {
        // Décrémenter Stock Origine
        const stockOrigine = await tx.stock.findUnique({
          where: { produitId_magasinId: { produitId: ligne.produitId, magasinId: transfert.magasinOrigineId } }
        })

        if (!stockOrigine || stockOrigine.quantite < ligne.quantite) {
          throw new Error(`Stock insuffisant pour le produit ID ${ligne.produitId} dans le magasin d'origine`)
        }

        await tx.stock.update({
          where: { id: stockOrigine.id },
          data: { quantite: { decrement: ligne.quantite } }
        })

        // Incrémenter Stock Destination
        let stockDest = await tx.stock.findUnique({
          where: { produitId_magasinId: { produitId: ligne.produitId, magasinId: transfert.magasinDestId } }
        })

        if (!stockDest) {
          stockDest = await tx.stock.create({
            data: {
              produitId: ligne.produitId,
              magasinId: transfert.magasinDestId,
              entiteId,
              quantite: 0,
              quantiteInitiale: 0
            }
          })
        }

        await tx.stock.update({
          where: { id: stockDest.id },
          data: { quantite: { increment: ligne.quantite } }
        })

        // Créer les mouvements
        await tx.mouvement.create({
          data: {
            type: 'SORTIE',
            produitId: ligne.produitId,
            magasinId: transfert.magasinOrigineId,
            entiteId,
            utilisateurId: session.userId,
            quantite: ligne.quantite,
            observation: `Transfert ${transfert.numero} vers Magasin #${transfert.magasinDestId}`,
            referenceTransfertId: transfert.id
          }
        })

        await tx.mouvement.create({
          data: {
            type: 'ENTREE',
            produitId: ligne.produitId,
            magasinId: transfert.magasinDestId,
            entiteId,
            utilisateurId: session.userId,
            quantite: ligne.quantite,
            observation: `Transfert ${transfert.numero} depuis Magasin #${transfert.magasinOrigineId}`,
            referenceTransfertId: transfert.id
          }
        })
      }

      // 3. Comptabilisation du transfert (OD : 311 Débit / 311 Crédit)
      let montantTotalTransfert = 0
      for (const ligne of transfert.lignes) {
        const prod = await tx.produit.findUnique({ where: { id: ligne.produitId } })
        montantTotalTransfert += (prod?.pamp || prod?.prixAchat || 0) * ligne.quantite
      }

      if (montantTotalTransfert > 0) {
        const { comptabiliserTransfert } = await import('@/lib/comptabilisation')
        const magasinOrigine = await tx.magasin.findUnique({ where: { id: transfert.magasinOrigineId } })
        const magasinDest = await tx.magasin.findUnique({ where: { id: transfert.magasinDestId } })

        await comptabiliserTransfert({
          transfertId: transfert.id,
          numero: transfert.numero,
          date: new Date(),
          magasinOrigineNom: magasinOrigine?.nom || `Magasin ${transfert.magasinOrigineId}`,
          magasinDestNom: magasinDest?.nom || `Magasin ${transfert.magasinDestId}`,
          montantTotal: Math.round(montantTotalTransfert),
          utilisateurId: session.userId,
        }, tx)
      }

      return transfert
    }, { timeout: 20000 })

    // Invalider le cache
    revalidatePath('/dashboard/stock')
    revalidatePath('/api/stock')

    // Logger l'action
    await logModification(
        session,
        'TRANSFERT',
        result.id,
        `Transfert ${result.numero} de ${lignes.length} produit(s)`,
        {},
        { numero: result.numero, origineId: magasinOrigineId, destId: magasinDestId }
    )

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('POST /api/stock/transferts:', e)
    if (e.message?.includes('DOUBLE_TRANSACTION')) {
      return NextResponse.json({ 
        error: 'Ce transfert a déjà été enregistré (Doublon bloqué).', 
        code: 'IDEMPOTENCY_CONFLICT' 
      }, { status: 409 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur lors du transfert' }, { status: 500 })
  }
}
