import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'
import { apiCatch } from '@/lib/log-error'
import { validateApiRequest } from '@/lib/validation-helpers'
import { z } from 'zod'

const genererRelanceSchema = z.object({
  clientIds: z.array(z.coerce.number().int().positive()).min(1, 'Au moins un client requis.'),
  canal: z.enum(['SMS', 'EMAIL', 'APPEL']).optional().default('SMS'),
})

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const forbidden = requirePermission(session, 'clients:edit')
  if (forbidden) return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  try {
    const body = await request.json()
    const validation = validateApiRequest(genererRelanceSchema, body)
    if (!validation.success) return validation.response
    const { clientIds, canal } = validation.data

    const entiteId = await getEntiteId(session)

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds.map(Number) }, entiteId },
      include: {
        ventes: { where: { statut: 'VALIDEE' }, select: { id: true, montantTotal: true, montantPaye: true, numero: true } },
        reglements: { where: { venteId: null, statut: 'VALIDE' }, select: { montant: true } },
      },
    })

    const results: { clientId: number; nom: string; statut: string; error?: string }[] = []
    const enterprise = await prisma.parametre.findFirst()

    for (const client of clients) {
      try {
        const detteFactures = client.ventes.reduce((s, v) => s + (v.montantTotal - (v.montantPaye || 0)), 0)
        const regsLibres = client.reglements.reduce((s, r) => s + r.montant, 0)
        const solde = detteFactures + (client.soldeInitial || 0) - regsLibres - (client.avoirInitial || 0)

        if (solde <= 0) {
          results.push({ clientId: client.id, nom: client.nom, statut: 'SOLDE_NUL' })
          continue
        }

        const factureIds = client.ventes
          .filter(v => (v.montantTotal - (v.montantPaye || 0)) > 0)
          .map(v => v.id)

        const message = `Bonjour ${client.nom},\n\nVotre solde débiteur est de ${solde.toLocaleString()} FCFA.\nMerci de régulariser au plus vite.\n\n${enterprise?.nomEntreprise || 'GestiCom Pro'}`

        let statutEnvoi = 'ENVOYE'
        if (canal === 'EMAIL' && client.email) {
          try {
            const { sendRelanceEmail } = await import('@/lib/mail')
            await sendRelanceEmail({
              to: client.email,
              subject: `Relance Paiement - ${enterprise?.nomEntreprise || 'GestiCom Pro'}`,
              text: message,
            })
          } catch {
            statutEnvoi = 'ECHEC'
          }
        }

        await prisma.relanceClient.create({
          data: {
            clientId: client.id,
            montantDu: solde,
            canal: canal || 'EMAIL',
            statut: statutEnvoi,
            message,
            envoyeePar: session.userId,
            factureIds: JSON.stringify(factureIds),
          },
        })

        results.push({ clientId: client.id, nom: client.nom, statut: statutEnvoi })
      } catch (e: any) {
        results.push({ clientId: client.id, nom: client.nom, statut: 'ERREUR', error: e.message })
      }
    }

    return NextResponse.json({ results, count: results.length, succes: results.filter(r => r.statut === 'ENVOYE').length })
  } catch (e) {
    await apiCatch(e, 'api/relances/generer')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
