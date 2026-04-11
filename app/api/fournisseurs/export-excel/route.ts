import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx-prototype-pollution-fixed')

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    // Récupérer tous les fournisseurs actifs
    const fournisseurs = await prisma.fournisseur.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { 
        id: true, 
        code: true, 
        nom: true, 
        telephone: true, 
        email: true, 
        ncc: true, 
        localisation: true, 
        numeroCamion: true,
        soldeInitial: true,
        achats: {
          where: { statut: 'VALIDEE' },
          select: { montantTotal: true, montantPaye: true }
        }
      },
    })
    
    const data: any[] = []
    let totalDette = 0

    for (const f of fournisseurs) {
      if (q && !f.nom.toLowerCase().includes(q) && !(f.telephone || '').toLowerCase().includes(q) && !(f.code || '').toLowerCase().includes(q)) {
        continue
      }

      // Calcul de la dette totale
      const engagements = f.achats.reduce((sum, a) => sum + a.montantTotal, 0)
      const paiements = f.achats.reduce((sum, a) => sum + (a.montantPaye || 0), 0)
      const detteNet = (f.soldeInitial || 0) + (engagements - paiements)

      totalDette += detteNet

      data.push({
        Code: f.code || '—',
        Nom: f.nom,
        'Tél.': f.telephone || '—',
        Email: f.email || '—',
        NCC: f.ncc || '—',
        Localisation: f.localisation || '—',
        'N° Camion': f.numeroCamion || '—',
        'Dette Initiale': f.soldeInitial || 0,
        'Dette Totale': detteNet
      })
    }

    if (data.length > 0) {
      data.push({
        Code: 'TOTAL',
        Nom: '',
        'Tél.': '',
        Email: '',
        NCC: '',
        Localisation: '',
        'N° Camion': '',
        'Dette Initiale': '',
        'Dette Totale': totalDette
      })
    }

    const worksheet = XLSX.utils.json_to_sheet(data.length ? data : [{ Code: '', Nom: '', 'Tél.': '', Email: '', NCC: '', Localisation: '', 'N° Camion': '', 'Dette Initiale': '', 'Dette Totale': '' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fournisseurs')

    const colWidths = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `fournisseurs-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/fournisseurs/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
