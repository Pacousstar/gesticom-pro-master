import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateRelancePDF } from '@/lib/pdf-gen'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    console.error('PDF Relance Error:', error)
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
  }
}
