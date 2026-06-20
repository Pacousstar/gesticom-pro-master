import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'
import { apiCatch } from '@/lib/log-error'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'clients:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    // Récupérer tous les clients actifs
    const clients = await prisma.client.findMany({
      where: { actif: true, entiteId },
      take: 10000,
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
        avoirInitial: true,
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
      // FORMULE UNIFIÉE : Solde = (Ventes - Paiements) + soldeInitial - avoirInitial
      const engagements = c.ventes.reduce((sum, v) => sum + v.montantTotal, 0)
      const paiements = c.ventes.reduce((sum, v) => sum + (v.montantPaye || 0), 0)
      const soldeNet = (c.soldeInitial || 0) + (engagements - paiements) - (c.avoirInitial || 0)

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

    const buf = await rowsToBuffer(data as any[], 'Clients')
    const filename = `clients-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    await apiCatch(error, 'api/clients/export-excel')
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
