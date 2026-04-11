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
    
    // Récupérer tous les clients actifs
    const clients = await prisma.client.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
      select: { 
        id: true, 
        code: true, 
        nom: true, 
        telephone: true, 
        type: true, 
        ncc: true, 
        localisation: true, 
        plafondCredit: true,
        soldeInitial: true,
        ventes: {
          where: { statut: 'VALIDEE' },
          select: { montantTotal: true, montantPaye: true }
        }
      },
    })
    
    const data: any[] = []
    let totalSolde = 0

    for (const c of clients) {
      // Filtrer éventuellement par recherche si q est présent
      if (q && !c.nom.toLowerCase().includes(q) && !(c.telephone || '').toLowerCase().includes(q) && !(c.code || '').toLowerCase().includes(q)) {
        continue
      }

      // Calcul du solde global
      // Note: Dans cette application, le solde semble être (Engagements - Paiements) + soldeInitial
      const engagements = c.ventes.reduce((sum, v) => sum + v.montantTotal, 0)
      const paiements = c.ventes.reduce((sum, v) => sum + (v.montantPaye || 0), 0)
      const soldeNet = (c.soldeInitial || 0) + (engagements - paiements)

      totalSolde += soldeNet

      data.push({
        Code: c.code || '—',
        Nom: c.nom,
        'Tél.': c.telephone || '—',
        Type: c.type === 'CASH' ? 'Cash' : 'Crédit',
        NCC: c.ncc || '—',
        Localisation: c.localisation || '—',
        Plafond: c.plafondCredit || 0,
        'Solde Global': soldeNet
      })
    }

    if (data.length > 0) {
      data.push({
        Code: 'TOTAL',
        Nom: '',
        'Tél.': '',
        Type: '',
        NCC: '',
        Localisation: '',
        Plafond: '',
        'Solde Global': totalSolde
      })
    }

    const worksheet = XLSX.utils.json_to_sheet(data.length ? data : [{ Code: '', Nom: '', 'Tél.': '', Type: '', NCC: '', Localisation: '', Plafond: '', 'Solde Global': '' }])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients')

    const colWidths = [
      { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
    ]
    worksheet['!cols'] = colWidths

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const filename = `clients-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/clients/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
