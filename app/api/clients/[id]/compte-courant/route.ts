import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { enregistrerMouvementCaisse, recalculerSoldeCaisse } from '@/lib/caisse'
import { estModeEspeces } from '@/lib/enums-commerce'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  try {
    const id = (await params).id
    const clientId = Number(id)

    if (Number.isNaN(clientId)) {
      return NextResponse.json({ error: 'ID client invalide' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)

    // Récupérer le client avec ses soldes initiaux
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...(entiteId ? { entiteId } : {}) },
      select: { id: true, nom: true, code: true, telephone: true, localisation: true, soldeInitial: true, avoirInitial: true }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Récupérer les opérations (ventes et règlements) - période optional
    const searchParams = request.nextUrl.searchParams
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const inclureTout = !dateDebut || !dateFin

    const whereVente: any = {
      clientId,
      entiteId,
      statut: { in: ['VALIDE', 'VALIDEE'] }
    }
    const whereReglement: any = {
      clientId,
      entiteId,
      statut: { in: ['VALIDE', 'VALIDEE'] }
    }

    if (dateDebut && dateFin) {
      const gte = new Date(dateDebut + 'T00:00:00')
      const lte = new Date(dateFin + 'T23:59:59')
      whereVente.date = { gte, lte }
      whereReglement.date = { gte, lte }
    }

    // Calcul global pour le solde (toutes les ventes validées - tous les règlements validés + soldes initiaux)
    const [ventesGlobalesAgg, reglementsGlobauxAgg] = await Promise.all([
      prisma.vente.aggregate({
        where: { clientId, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        _sum: { montantTotal: true, montantPaye: true }
      }),
      prisma.reglementVente.aggregate({
        where: { clientId, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        _sum: { montant: true }
      })
    ])

    const totalDebitGlobal = (Number(ventesGlobalesAgg._sum?.montantTotal) || 0) + (client.soldeInitial || 0)
    const totalCreditGlobal = (Number(reglementsGlobauxAgg._sum?.montant) || 0) + (client.avoirInitial || 0)
    const globalSolde = (totalDebitGlobal - totalCreditGlobal)

    const [ventes, reglements] = await Promise.all([
      prisma.vente.findMany({
        where: whereVente,
        orderBy: { date: 'desc' },
        select: {
          id: true, numero: true, date: true, montantTotal: true,
          montantPaye: true, modePaiement: true, statutPaiement: true, magasin: { select: { nom: true } },
          reglements: { select: { id: true, modePaiement: true } },
          ReglementVenteLigne: { select: { reglementId: true, montant: true } }
        }
      }),
      prisma.reglementVente.findMany({
        where: whereReglement,
        orderBy: { date: 'desc' },
        select: {
          id: true, montant: true, modePaiement: true, date: true,
          observation: true, venteId: true,
          vente: { select: { numero: true } }
        }
      })
    ])

    const dataWithRealPaye = ventes.map((v: any) => {
      const creditReglementIds = new Set(
        (v.reglements || [])
          .filter(r => String(r.modePaiement).toUpperCase() === 'CREDIT')
          .map(r => r.id)
      )
      const totalLignePaye = (v.ReglementVenteLigne || [])
        .filter(l => !creditReglementIds.has(l.reglementId))
        .reduce((s: number, l: any) => s + (l.montant || 0), 0)
      return { ...v, montantPaye: totalLignePaye > 0 ? totalLignePaye : (v.montantPaye || 0), ReglementVenteLigne: undefined, reglements: undefined }
    })

    // Construire les opérations
    const operations = [
      ...dataWithRealPaye.map((v: any) => ({
        id: v.id,
        date: v.date,
        numero: v.numero,
        type: 'ACHAT' as const,
        debit: v.montantTotal || 0,
        credit: v.montantPaye || 0,
        libelle: `Vente ${v.numero} - ${v.magasin?.nom || ''}`
      })),
      ...reglements.map((r: any) => ({
        id: r.id,
        date: r.date,
        numero: `R${r.id}`,
        type: 'REGLEMENT' as const,
        debit: 0,
        credit: r.montant,
        libelle: `Règlement ${r.modePaiement}${r.observation ? ' - ' + r.observation : ''}`,
        reference: r.venteId ? r.vente?.numero || `V${r.venteId}` : '-',
        mode: r.modePaiement
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Ajouter les soldes initiaux au début de l'historique si ils existent
    const initialOperations: any[] = []
    if (client.soldeInitial && client.soldeInitial > 0) {
      initialOperations.push({
        id: 'init-dette',
        date: new Date().toISOString(),
        type: 'INIT',
        libelle: 'Dette initiale (Solde de départ)',
        debit: client.soldeInitial,
        credit: 0,
        isInitial: true
      })
    }
    if (client.avoirInitial && client.avoirInitial > 0) {
      initialOperations.push({
        id: 'init-avoir',
        date: new Date().toISOString(),
        type: 'INIT',
        libelle: 'Avoir initial (Acompte de départ)',
        debit: 0,
        credit: client.avoirInitial,
        isInitial: true
      })
    }

    const allOperations = [...initialOperations, ...operations]

    return NextResponse.json({ 
      client, 
      operations: allOperations, 
      totalDebitGlobal, 
      totalCreditGlobal, 
      globalSolde,
      solderInitial: client.soldeInitial || 0,
      avoirInitial: client.avoirInitial || 0
    })
  } catch (error) {
    console.error('GET /api/clients/[id]/compte-courant:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const authError = requirePermission(session, 'clients:edit')
  if (authError) return authError

  try {
    const id = (await params).id
    const clientId = Number(id)

    if (Number.isNaN(clientId)) {
      return NextResponse.json({ error: 'ID client invalide' }, { status: 400 })
    }

    const body = await request.json()
    const { montant, modePaiement, magasinId, banqueId, date, observation } = body

    if (!montant || montant <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    if (!modePaiement) {
      return NextResponse.json({ error: 'Mode de paiement requis' }, { status: 400 })
    }

    const entiteId = await getEntiteId(session)
    if (!entiteId) {
      return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
    }

    const dateReglement = date ? new Date(date) : new Date()

    const result = await prisma.$transaction(async (tx: any) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: { id: true, nom: true }
      })
      if (!client) throw new Error('Client introuvable')

      const reglement = await tx.reglementVente.create({
        data: {
          clientId,
          montant,
          modePaiement,
          banqueId: banqueId ? Number(banqueId) : null,
          date: dateReglement,
          statut: 'VALIDE',
          entiteId,
          utilisateurId: session.userId,
          observation,
        },
      })

      const ventesNonSoldees = await tx.vente.findMany({
        where: {
          clientId,
          entiteId,
          statut: { in: ['VALIDE', 'VALIDEE'] },
          statutPaiement: { in: ['CREDIT', 'PARTIEL'] },
        },
        orderBy: { date: 'asc' },
        select: { id: true, montantTotal: true, montantPaye: true, ReglementVenteLigne: { select: { reglementId: true, montant: true } } },
      })

      let resteAPayer = montant

      for (const vente of ventesNonSoldees) {
        if (resteAPayer <= 0) break

        const totalLignePaye = (vente.ReglementVenteLigne as any[] || [])
          .reduce((s: number, l: any) => s + (l.montant || 0), 0)
        const realMontantPaye = totalLignePaye > 0 ? totalLignePaye : (vente.montantPaye || 0)
        const montantDu = (vente.montantTotal || 0) - realMontantPaye
        const montantARegler = Math.min(montantDu, resteAPayer)

        if (montantARegler > 0) {
          const nouveauPaye = realMontantPaye + montantARegler
          const nouveauStatut = nouveauPaye >= (vente.montantTotal || 0) ? 'PAYE' : 'PARTIEL'

          await tx.vente.update({
            where: { id: vente.id },
            data: {
              montantPaye: nouveauPaye,
              statutPaiement: nouveauStatut,
            },
          })

          await tx.reglementVenteLigne.create({
            data: {
              reglementId: reglement.id,
              venteId: vente.id,
              montant: montantARegler,
            },
          })

          resteAPayer -= montantARegler
        }
      }

      const toutesVentesDuClient = await tx.vente.findMany({
        where: { clientId, entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        select: { id: true, montantTotal: true }
      })

      for (const v of toutesVentesDuClient) {
        const [lignes, directRegs] = await Promise.all([
          tx.reglementVenteLigne.findMany({
            where: { venteId: v.id },
            select: { montant: true }
          }),
          tx.reglementVente.aggregate({
            where: { venteId: v.id, statut: { in: ['VALIDE', 'VALIDEE'] } },
            _sum: { montant: true }
          })
        ])
        const totalFromLignes = lignes.reduce((sum: number, l: any) => sum + (l.montant || 0), 0)
        const totalFromDirect = directRegs._sum?.montant || 0
        const totalPaye = Math.max(totalFromLignes, totalFromDirect)
        const nouveauStatut = totalPaye >= v.montantTotal ? 'PAYE' : totalPaye > 0 ? 'PARTIEL' : 'CREDIT'

        await tx.vente.update({
          where: { id: v.id },
          data: { montantPaye: totalPaye, statutPaiement: nouveauStatut }
        })
      }

      if (estModeEspeces(modePaiement)) {
        await enregistrerMouvementCaisse({
          magasinId: Number(magasinId),
          type: 'ENTREE',
          motif: `Règlement client : ${observation || 'Acompte compte courant'}${client.nom ? ' - ' + client.nom : ''}`,
          montant,
          utilisateurId: session.userId,
          entiteId,
          date: dateReglement,
        }, tx)
        await recalculerSoldeCaisse(Number(magasinId), tx)
      } else {
        const { enregistrerOperationBancaire, estModeBanque } = await import('@/lib/banque')
        if (estModeBanque(modePaiement)) {
          await enregistrerOperationBancaire({
            banqueId: banqueId ? Number(banqueId) : null,
            entiteId,
            date: dateReglement,
            type: 'REGLEMENT_CLIENT',
            libelle: `Règlement client ${client.nom || ''} - ${observation || 'Compte courant'}`,
            montant,
            utilisateurId: session.userId,
            reference: `CC-CLI-${clientId}-${Date.now()}`,
            beneficiaire: client.nom || null,
            observation: `Paiement via ${modePaiement}`
          }, tx)
        } else {
          console.warn(`[paiement client] Mode de paiement non géré pour trésorerie: ${modePaiement}`)
        }
      }

      return reglement
    }, { timeout: 20000 })

    return NextResponse.json({ success: true, reglementId: result.id })
  } catch (error) {
    console.error('POST /api/clients/[id]/compte-courant:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}