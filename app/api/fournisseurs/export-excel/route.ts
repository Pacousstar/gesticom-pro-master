import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getEntiteId } from '@/lib/get-entite-id'
import { requirePermission } from '@/lib/require-role'

import { rowsToBuffer, makeResponse } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const authError = requirePermission(session, 'fournisseurs:view')
  if (authError) return authError

  const entiteId = await getEntiteId(session)
  if (!entiteId) {
    return NextResponse.json({ error: 'Entité non identifiée.' }, { status: 400 })
  }

  try {
    const q = String(request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
    
    // Récupérer tous les fournisseurs actifs
    const fournisseurs = await prisma.fournisseur.findMany({
      where: { actif: true, entiteId },
      take: 10000,
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
        avoirInitial: true,
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
      // FORMULE UNIFIÉE : Dette = (Achats - Paiements) + soldeInitial - avoirInitial
      const engagements = f.achats.reduce((sum, a) => sum + a.montantTotal, 0)
      const paiements = f.achats.reduce((sum, a) => sum + (a.montantPaye || 0), 0)
      const detteNet = (f.soldeInitial || 0) + (engagements - paiements) - (f.avoirInitial || 0)

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

    const buf = await rowsToBuffer(data as any[], 'Fournisseurs')
    const filename = `fournisseurs-${new Date().toISOString().split('T')[0]}.xlsx`
    return makeResponse(buf, filename)
  } catch (error) {
    console.error('GET /api/fournisseurs/export-excel:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export Excel' }, { status: 500 })
  }
}
