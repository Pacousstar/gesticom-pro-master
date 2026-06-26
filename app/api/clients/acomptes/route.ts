import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { getEntiteIdOrAll } from '@/lib/get-entite-id'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  const entiteIdFilter = await getEntiteIdOrAll(session)

  try {
    const where: any = {
      venteId: null,
      statut: { in: ['VALIDEE', 'VALIDE'] },
      clientId: { not: null },
    }
    if (entiteIdFilter != null) {
      where.entiteId = entiteIdFilter
    }

    const reglements = await prisma.reglementVente.findMany({
      where,
      include: {
        client: { select: { id: true, code: true, nom: true } },
      },
      orderBy: { date: 'desc' },
    })

    const grouped = new Map<number, {
      clientId: number
      clientCode: string | null
      clientNom: string
      totalAcompte: number
      paiements: { id: number; date: string; montant: number; modePaiement: string }[]
    }>()

    for (const r of reglements) {
      if (!r.client) continue
      const key = r.clientId!
      if (!grouped.has(key)) {
        grouped.set(key, {
          clientId: key,
          clientCode: r.client.code,
          clientNom: r.client.nom,
          totalAcompte: 0,
          paiements: [],
        })
      }
      const g = grouped.get(key)!
      g.totalAcompte += r.montant
      g.paiements.push({
        id: r.id,
        date: r.date.toISOString(),
        montant: r.montant,
        modePaiement: r.modePaiement,
      })
    }

    const data = Array.from(grouped.values()).sort((a, b) => a.clientNom.localeCompare(b.clientNom))

    return NextResponse.json(data)
  } catch (error) {
    await apiCatch(error, 'api/clients/acomptes')
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}
