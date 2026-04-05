import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserDepense,
  comptabiliserCharge,
  comptabiliserReglementVente,
  comptabiliserReglementAchat
} from '@/lib/comptabilisation'
import path from 'path'
import fs from 'fs'

/**
 * API de Migration Master GestiCom Pro
 * Déclenche le réajustement complet de la base de données
 * POST /api/admin/migration-master
 */

export async function POST(request: NextRequest) {
  // 🛡️ SÉCURITÉ : Vérification de la clé de migration
  const authHeader = request.headers.get('x-migration-key')
  const envKey = process.env.MIGRATION_KEY || 'GestiComMaster2026'
  
  if (authHeader !== envKey) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
  }

  const logs: string[] = []
  const addLog = (msg: string) => {
    console.log(`[MIGRATION-MASTER] ${msg}`)
    logs.push(msg)
  }

  try {
    addLog('🏁 DÉMARRAGE DE LA MIGRATION INTERNE (VERSION MASTER)')

    // 1. RÉINITIALISATION ADMIN (Mot de passe Admin@123)
    addLog('🔒 Configuration du compte Administrateur...')
    const hash = "$2a$10$cI1CEqQEGIqdQ4M6y97K3uplfQnNSF1/SirUpjAtwWUW/8IfHCZtK" 
    await prisma.utilisateur.updateMany({
      where: { OR: [{ login: 'admin' }, { role: 'SUPER_ADMIN' }] },
      data: { motDePasse: hash, actif: true }
    })

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

    // 3. PURGE COMPTABLE
    addLog('🧹 Purge du Grand Livre historique...')
    await prisma.ecritureComptable.deleteMany({})

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
        ...d, depenseId: d.id, montant: Number(d.montant), date: d.date 
    })
    const charges = await prisma.charge.findMany({})
    for (const c of charges) await comptabiliserCharge({ 
        ...c, chargeId: c.id, libelle: c.rubrique, montant: Number(c.montant), date: c.date 
    })

    addLog('⚖️ Réalignement des soldes tiers terminé.')
    addLog('🌟 MIGRATION MASTER TERMINÉE AVEC SUCCÈS.')

    return NextResponse.json({ success: true, logs })

  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    addLog(`❌ ERREUR DURANT LA MIGRATION : ${errorMsg}`)
    try {
      const logPath = path.join(process.cwd(), 'gesticom-error.log')
      fs.appendFileSync(logPath, new Date().toISOString() + ' [migration-api] ' + errorMsg + '\n', 'utf8')
    } catch (_) {}
    return NextResponse.json({ success: false, error: errorMsg, logs }, { status: 500 })
  }
}
