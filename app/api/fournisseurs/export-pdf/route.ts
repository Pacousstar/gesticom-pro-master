import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    const list = await prisma.fournisseur.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, telephone: true, email: true, ncc: true },
    })
    
    const filtered = q
      ? list.filter(
          (f) =>
            f.nom.toLowerCase().includes(q) ||
            (f.telephone || '').toLowerCase().includes(q) ||
            (f.email || '').toLowerCase().includes(q)
        )
      : list

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Liste des Fournisseurs', 15, 20)

    if (filtered.length === 0) {
      doc.setFontSize(12)
      doc.text('Aucun fournisseur trouvé.', 15, 50)
      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="fournisseurs-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    let y = 35
    doc.setFontSize(9)
    doc.setFont(undefined, 'bold')
    doc.text('Nom', 15, y)
    doc.text('Téléphone', 70, y)
    doc.text('Email', 110, y)
    doc.text('NCC', 160, y)

    y += 5
    doc.line(15, y, 195, y)

    doc.setFont(undefined, 'normal')
    for (const f of filtered) {
      if (y > 270) {
        doc.addPage()
        y = 20
        doc.setFont(undefined, 'bold')
        doc.text('Nom', 15, y)
        doc.text('Téléphone', 70, y)
        doc.text('Email', 110, y)
        doc.text('NCC', 160, y)
        y += 5
        doc.line(15, y, 195, y)
        y += 5
        doc.setFont(undefined, 'normal')
      }

      const nom = f.nom.length > 25 ? f.nom.substring(0, 22) + '...' : f.nom
      doc.text(nom, 15, y)
      doc.text(f.telephone || '—', 70, y)
      const email = f.email && f.email.length > 20 ? f.email.substring(0, 17) + '...' : (f.email || '—')
      doc.text(email, 110, y)
      doc.text(f.ncc || '—', 160, y)

      y += 7
    }

    const buffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fournisseurs-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('GET /api/fournisseurs/export-pdf:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export PDF' }, { status: 500 })
  }
}
