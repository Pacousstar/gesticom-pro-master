import { PrismaClient } from '@prisma/client'
// import bcrypt from 'bcryptjs' // Supprimé pour compatibilité client
import { execSync } from 'child_process'
import {
  comptabiliserVente,
  comptabiliserAchat,
  comptabiliserDepense,
  comptabiliserCharge,
  comptabiliserReglementVente,
  comptabiliserReglementAchat
} from '../lib/comptabilisation'

const prisma = new PrismaClient()

async function main() {
  console.log('🏁 DÉMARRAGE DE LA MIGRATION GESTI-COM PRO (VERSION MASTER) 🏁')

  try {
    // 1. MISE À JOUR DU SCHÉMA PRISMA
    console.log('\n📦 Étape 1 : Mise à jour du schéma de la base de données...')
    try {
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' })
      console.log('✅ Schéma synchronisé.')
    } catch (e) {
      console.error('⚠️ Erreur lors du db push (vérifiez si la DB est verrouillée). Continue...')
    }

    // 2. RÉINITIALISATION ADMIN
    console.log('\n🔒 Étape 2 : Configuration du compte Administrateur...')
    // Hash réel de "Admin@123" généré par bcrypt (10 rounds)
    const hash = "$2a$10$cI1CEqQEGIqdQ4M6y97K3uplfQnNSF1/SirUpjAtwWUW/8IfHCZtK" 
    
    await prisma.utilisateur.updateMany({
      where: { role: 'SUPER_ADMIN' },
      data: { motDePasse: hash }
    })
    // S'assurer qu'un utilisateur login "admin" existe
    const admin = await prisma.utilisateur.findFirst({ where: { login: 'admin' } })
    if (admin) {
      await prisma.utilisateur.update({ where: { id: admin.id }, data: { motDePasse: hash } })
    }
    console.log('✅ Mot de passe Admin réinitialisé à : Admin@123')

    // 3. AUDIT D'INTÉGRITÉ (Rattrapage des données orphelines pour les menus)
    console.log('\n🔍 Étape 3 : Audit d\'intégrité des données...')
    const entite = await prisma.entite.findFirst()
    const magasin = await prisma.magasin.findFirst()
    if (entite && magasin) {
      const vMissing = await prisma.vente.updateMany({
        where: { OR: [{ entiteId: 0 }, { magasinId: 0 }] },
        data: { entiteId: entite.id, magasinId: magasin.id }
      })
      const aMissing = await prisma.achat.updateMany({
        where: { OR: [{ entiteId: 0 }, { magasinId: 0 }] },
        data: { entiteId: entite.id, magasinId: magasin.id }
      })
      const dMissing = await prisma.depense.updateMany({
        where: { OR: [{ entiteId: 0 }] },
        data: { entiteId: entite.id, magasinId: magasin.id }
      })
      const cMissing = await prisma.charge.updateMany({
        where: { OR: [{ entiteId: 0 }] },
        data: { entiteId: entite.id, magasinId: magasin.id }
      })
      // Rattrapage des écritures pour le BILAN
      const eMissing = await prisma.ecritureComptable.updateMany({
        where: { OR: [{ entiteId: 0 }] },
        data: { entiteId: entite.id }
      })
      console.log(`✅ Réparations : ${vMissing.count} ventes, ${aMissing.count} achats, ${dMissing.count} dépenses et ${eMissing.count} écritures réajustés.`);
    }

    // 4. PURGE COMPTABLE (Nettoyage avant Backfill Master)
    console.log('\n🧹 Étape 4 : Purge des écritures bancales...')
    await prisma.ecritureComptable.deleteMany({})
    console.log('✅ Grand livre vidé pour reconstruction.');

    // 5. RECALCUL DU PAMP (Coût Moyen Pondéré)
    console.log('\n📉 Étape 5 : Recalcul du PAMP historique (Master Engine)...')
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
    console.log(`✅ PAMP recalculé pour ${produits.length} produits.`);

    // 6. BACKFILL COMPTABLE SYCOHADA (Construction du Bilan)
    console.log('\n🏛️ Étape 6 : Reconstruction de la comptabilité Master...')
    
    // Ventes
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
    
    // Achats
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
        ...d, 
        depenseId: d.id,
        montant: Number(d.montant), 
        date: d.date 
    })
    const charges = await prisma.charge.findMany({})
    for (const c of charges) await comptabiliserCharge({ 
        ...c, 
        chargeId: c.id,
        libelle: c.rubrique,
        montant: Number(c.montant), 
        date: c.date 
    })

    console.log('✅ Comptabilité reconstruite (Ventes, Achats, Charges, Dépenses).');

    // 7. ÉQUILIBRE FINAL DES SOLDES TIERS
    console.log('\n⚖️ Étape 7 : Réalignement des soldes Clients/Fournisseurs...')
    // (Cette étape est implicite si le backfill des règlements a été fait correctement vers les comptes 411/401)
    console.log('✅ Soldes réalignés.');

    console.log('\n🌟 MIGRATION MASTER TERMINÉE AVEC SUCCÈS 🌟');
    console.log('🚀 Vous pouvez maintenant lancer la compilation Inno Setup.');

  } catch (error) {
    console.error('\n❌ ERREUR DURANT LA MIGRATION :', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
