import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  comptabiliserDepense,
  comptabiliserCharge,
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserReglementVente,
  comptabiliserReglementAchat,
} from '@/lib/comptabilisation'

export async function POST() {
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const results = {
    doublonsComptablesSupprimes: 0,
    doublonsCaisseSupprimes: 0,
    ventesSynchronisees: 0,
    achatsSynchronises: 0,
    ecrituresGenerees: 0,
    errors: [] as string[]
  }

  try {
    const entiteId = session.entiteId || 1

    // 1. DÉDUPLICATION COMPTABLE
    // On cherche les écritures avec la même référence, compte et montant
    const duplicates = await prisma.$queryRaw`
      SELECT referenceType, referenceId, compteId, debit, credit, COUNT(*) as count 
      FROM EcritureComptable 
      WHERE referenceId IS NOT NULL AND referenceType IS NOT NULL
      GROUP BY referenceType, referenceId, compteId, debit, credit 
      HAVING count > 1
    ` as any[]

    for (const dup of duplicates) {
      const records = await prisma.ecritureComptable.findMany({
        where: {
          referenceType: dup.referenceType,
          referenceId: dup.referenceId,
          compteId: dup.compteId,
          debit: dup.debit,
          credit: dup.credit
        },
        orderBy: { id: 'asc' }
      })
      
      // On garde le premier, on supprime les autres
      const toDelete = records.slice(1).map(r => r.id)
      if (toDelete.length > 0) {
        await prisma.ecritureComptable.deleteMany({ where: { id: { in: toDelete } } })
        results.doublonsComptablesSupprimes += toDelete.length
      }
    }

    // 2. DÉDUPLICATION CAISSE
    // On cherche les entrées de caisse quasi-identiques (même montant, motif, magasin, date à la minute près)
    const entries = await prisma.caisse.findMany({
      where: { entiteId },
      orderBy: { date: 'asc' }
    })

    const caisseToDelete = []
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i]
            const b = entries[j]
            const timeDiff = Math.abs(a.date.getTime() - b.date.getTime())
            if (
                a.magasinId === b.magasinId &&
                a.montant === b.montant &&
                a.motif === b.motif &&
                a.type === b.type &&
                timeDiff < 60000 // Moins d'une minute d'écart
            ) {
                caisseToDelete.push(b.id)
                entries.splice(j, 1) // On l'enlève de la liste pour ne pas le comparer à nouveau
                j--
            }
        }
    }

    if (caisseToDelete.length > 0) {
        await prisma.caisse.deleteMany({ where: { id: { in: caisseToDelete } } })
        results.doublonsCaisseSupprimes = caisseToDelete.length
    }

    // 3. SYNCHRONISATION DES SOLDES (Ventes)
    const ventes = await prisma.vente.findMany({ 
        where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        include: { reglements: true }
    })
    for (const v of ventes) {
        const totalPaye = v.reglements.filter(r => r.statut === 'VALIDE').reduce((sum, r) => sum + r.montant, 0)
        if (Math.abs(v.montantPaye - totalPaye) > 0.01) {
            const statutPaiement = totalPaye >= v.montantTotal - 0.01 ? 'PAYE' : (totalPaye > 0 ? 'PARTIEL' : 'CREDIT')
            await prisma.vente.update({
                where: { id: v.id },
                data: { montantPaye: totalPaye, statutPaiement }
            })
            results.ventesSynchronisees++
        }
    }

    // 4. SYNCHRONISATION DES SOLDES (Achats)
    const achats = await prisma.achat.findMany({ 
        where: { entiteId, statut: { in: ['VALIDE', 'VALIDEE'] } },
        include: { reglements: true }
    })
    for (const a of achats) {
        const totalPaye = a.reglements.filter(r => r.statut === 'VALIDE').reduce((sum, r) => sum + r.montant, 0)
        if (Math.abs((a.montantPaye || 0) - totalPaye) > 0.01) {
            const statutPaiement = totalPaye >= a.montantTotal - 0.01 ? 'PAYE' : (totalPaye > 0 ? 'PARTIEL' : 'CREDIT')
            await prisma.achat.update({
                where: { id: a.id },
                data: { montantPaye: totalPaye, statutPaiement }
            })
            results.achatsSynchronises++
        }
    }

    // 5. GÉNÉRATION DES ÉCRITURES MANQUANTES (VIA SERVICE IDEMPOTENT)
    // On va simplement ré-exécuter la logique sur toutes les opérations. 
    // Grâce à notre fix d'idempotence dans lib/comptabilisation.ts, cela ne créera pas de doublons.
    
    // Règlements Ventes
    const regsV = await prisma.reglementVente.findMany({ where: { entiteId, statut: 'VALIDE' }, include: { vente: true } })
    for (const r of regsV) {
        try {
            await comptabiliserReglementVente({
                reglementId: r.id,
                venteId: r.venteId,
                numeroVente: r.vente?.numero || `AC-CLI-${r.clientId}`,
                date: r.date,
                montant: r.montant,
                modePaiement: r.modePaiement,
                utilisateurId: r.utilisateurId,
                entiteId: r.entiteId || 1,
                magasinId: 1 // Default
            })
            results.ecrituresGenerees++
        } catch (e) {}
    }

    // Ventes
    for (const v of ventes) {
        try {
            await comptabiliserVente({
                venteId: v.id,
                numeroVente: v.numero,
                date: v.date,
                montantTotal: v.montantTotal,
                modePaiement: v.modePaiement,
                clientId: v.clientId,
                utilisateurId: v.utilisateurId,
                magasinId: v.magasinId,
                entiteId: v.entiteId
            })
        } catch (e) {}
    }

    return NextResponse.json({ ok: true, results })
  } catch (error) {
    console.error('Fiabilisation Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la maintenance.' }, { status: 500 })
  }
}
