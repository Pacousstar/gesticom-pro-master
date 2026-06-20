import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { requirePermission } from '@/lib/require-role'
import { generateRelancePDF } from '@/lib/pdf-gen'
import { apiCatch } from '@/lib/log-error'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  const { id } = await params
  const clientId = Number(id)

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    const enterprise = await prisma.parametre.findFirst()
    
    if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

    const facturesImpayees = await prisma.vente.findMany({
      where: { 
        clientId, 
        statut: 'VALIDEE',
        statutPaiement: { in: ['PARTIEL', 'CREDIT'] }
      },
      select: { numero: true, date: true, montantTotal: true, montantPaye: true },
      orderBy: { date: 'asc' }
    })

    const facturesDetail = facturesImpayees.map(f => ({
      ...f,
      resteAPayer: f.montantTotal - (f.montantPaye || 0)
    }))

    const solde = facturesDetail.reduce((acc, f) => acc + f.resteAPayer, 0) + (client.soldeInitial || 0) - (client.avoirInitial || 0)

    const doc = generateRelancePDF({ client, factures: facturesDetail, solde, enterprise })
    const pdfData = doc.output('arraybuffer')

    return new NextResponse(pdfData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Relance_${client.nom.replace(/\s+/g, '_')}.pdf"`
      }
    })

  } catch (error) {
    await apiCatch(error, 'api/clients/[id]/relance/pdf')
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}
