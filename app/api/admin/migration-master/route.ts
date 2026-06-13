import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import {
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserDepense,
  comptabiliserCharge
} from '@/lib/comptabilisation'
import { repairCaisseIntegrity, repairStockIntegrity, repairBankIntegrity } from '@/lib/repair'
import path from 'path'
import fs from 'fs'

/**
 * API de Migration Master GestiCom Pro
 * Déclenche le réajustement complet de la base de données
 * POST /api/admin/migration-master
 */

export async function POST(request: NextRequest) {
  const maintenanceEnabled = process.env.ENABLE_DANGEROUS_MAINTENANCE === 'true'
  if (process.env.NODE_ENV === 'production' || !maintenanceEnabled) {
    return NextResponse.json({ error: 'Route de maintenance désactivée en production.' }, { status: 403 })
  }
  const session = await getSession()
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // 🛡️ SÉCURITÉ : Vérification de la clé de migration
  const authHeader = request.headers.get('x-migration-key')
  const envKey = process.env.MIGRATION_KEY
  const confirmHeader = request.headers.get('x-maintenance-confirm')
  
  if (!envKey || authHeader !== envKey || confirmHeader !== 'YES_I_UNDERSTAND_THE_RISKS') {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
  }

  const logs: string[] = []
  const addLog = (msg: string) => {
    logs.push(msg)
  }

  try {
    addLog('🏁 DÉMARRAGE DE LA MIGRATION INTERNE (VERSION MASTER)')

    // 1. SÉCURITÉ: ne jamais réinitialiser les mots de passe depuis une route de maintenance.
    addLog('🔒 Étape sécurité: aucune réinitialisation de mot de passe effectuée.')

    // 2. RÉPARATIONS STRUCTURELLES MASSIVES (Rattrapage Entité/Magasin)
    addLog('🔍 Réparation massive de la visibilité Master...')
    const entite = await prisma.entite.findFirst({ orderBy: { id: 'asc' } })
    const magasin = await prisma.magasin.findFirst({ orderBy: { id: 'asc' } })
    
    if (entite && magasin) {
      const eid = entite.id
      const mid = magasin.id

      // Rattrapage Stocks & Produits
      await prisma.stock.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
      await prisma.produit.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid } })

      // Rattrapage Dépenses & Charges
      await prisma.depense.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
      await prisma.charge.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })

      // Rattrapage Écritures Comptables (BILAN)
      await prisma.ecritureComptable.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid } })

      // Rattrapage Mouvements, Caisse, Ventes, Achats
      await prisma.mouvement.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
      await prisma.caisse.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
      await prisma.vente.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })
      await prisma.achat.updateMany({ where: { OR: [{ entiteId: { not: eid } }, { entiteId: 0 }] }, data: { entiteId: eid, magasinId: mid } })

      addLog('✅ Toutes les données ont été rattachées à l\'entité et au magasin par défaut.')
    }

    // 3. PURGE COMPTABLE (dans une transaction pour sécurité)
    addLog('🧹 Purge du Grand Livre historique...')
    await prisma.$transaction([
      prisma.ecritureComptable.deleteMany({}),
    ])

    // 4. RECALCUL DU PAMP
    addLog('📉 Recalcul du Coût Moyen Pondéré (PAMP)...')
    const produits = await prisma.produit.findMany({ include: { achatsLignes: { include: { achat: true } } } })
    for (const p of produits) {
      let stockCumul = 0
      let valeurCumul = 0
      const achatsTries = p.achatsLignes.sort((a, b) => a.achat.date.getTime() - b.achat.date.getTime())
      for (const al of achatsTries) {
        stockCumul += al.quantite
        valeurCumul += al.montant
      }
      const nouveauPamp = stockCumul > 0 ? (valeurCumul / stockCumul) : (p.prixAchat || 0)
      await prisma.produit.update({ where: { id: p.id }, data: { pamp: Math.round(nouveauPamp) } })
    }

    // 5. RECONSTRUCTION COMPTABILITÉ (Backfill Forcé)
    addLog('🏛️ Reconstruction de la comptabilité SYCOHADA Master...')
    
    // Ventes & Règlements
    const ventes = await prisma.vente.findMany({ where: { statut: 'VALIDEE' }, include: { lignes: true, reglements: true } })
    for (const v of ventes) {
      await comptabiliserVente({ 
        ...v, 
        venteId: v.id, 
        numeroVente: v.numero, 
        montantTotal: Number(v.montantTotal),
        reglements: v.reglements.map(r => ({ mode: r.modePaiement, montant: Number(r.montant) }))
      })
    }
    
    // Achats & Règlements
    const achats = await prisma.achat.findMany({ include: { lignes: true, reglements: true } })
    for (const a of achats) {
      await comptabiliserAchat({ 
        ...a, 
        achatId: a.id, 
        numeroAchat: a.numero, 
        montantTotal: Number(a.montantTotal),
        reglements: a.reglements.map(r => ({ mode: r.modePaiement, montant: Number(r.montant) }))
      })
    }

    // Dépenses & Charges
    const depenses = await prisma.depense.findMany({})
    for (const d of depenses) await comptabiliserDepense({ 
        depenseId: d.id, date: d.date, montantTotal: Number(d.montant), montantPaye: Number(d.montantPaye || d.montant), categorie: d.categorie, libelle: d.libelle, modePaiement: d.modePaiement, utilisateurId: d.utilisateurId, entiteId: d.entiteId, magasinId: d.magasinId
    })
    const charges = await prisma.charge.findMany({})
    for (const c of charges) await comptabiliserCharge({ 
        ...c, chargeId: c.id, libelle: c.rubrique, montant: Number(c.montant), date: c.date 
    })

    addLog('⚖️ Réalignement des soldes tiers terminé.')

    // 6. REALIGNEMENT DES SOLDES CAISSE, STOCKS ET BANQUES (Post-Corrections C1-C8)
    addLog('💰 Réalignement des soldes caisse...')
    const caissesReparees = await repairCaisseIntegrity()
    addLog(`   ${caissesReparees} magasin(s) de caisse recalculé(s)`)

    addLog('📦 Réalignement des stocks...')
    const stocksReparess = await repairStockIntegrity()
    addLog(`   ${stocksReparess} stock(s) recalculé(s)`)

    addLog('🏦 Réalignement des soldes bancaires...')
    const banksReparees = await repairBankIntegrity()
    addLog(`   ${banksReparees} banque(s) recalculée(s)`)

    addLog('🌟 MIGRATION MASTER TERMINÉE AVEC SUCCÈS.')

    return NextResponse.json({ success: true, logs })

  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    addLog(`❌ ERREUR DURANT LA MIGRATION : ${errorMsg}`)
    try {
      const logPath = path.join(process.cwd(), 'gesticom-error.log')
      fs.appendFileSync(logPath, new Date().toISOString() + ' [migration-api] ' + errorMsg + '\n', 'utf8')
    } catch (_) {
      // Ignorer l'échec d'écriture du log fichier, l'erreur API est déjà renvoyée.
    }
    return NextResponse.json({ success: false, error: errorMsg, logs }, { status: 500 })
  }
}
