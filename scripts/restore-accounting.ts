import { PrismaClient } from '@prisma/client'
import { 
  comptabiliserVente, 
  comptabiliserAchat, 
  comptabiliserDepense, 
  comptabiliserCharge 
} from '../lib/comptabilisation'

const prisma = new PrismaClient()

async function restore() {
  console.log('--- DÉBUT DE LA RÉGÉNÉRATION COMPTABLE (2026) ---')
  
  const now = new Date()
  const yearStart = new Date(2026, 0, 1)

  // 1. RÉGÉNÉRER LES VENTES
  console.log('Traitement des Ventes...')
  const ventes = await prisma.vente.findMany({
    where: { date: { gte: yearStart }, statut: { in: ['VALIDE', 'VALIDEE'] } },
    include: { lignes: true, reglements: true }
  })
  
  for (const v of ventes) {
    try {
      await comptabiliserVente({
        venteId: v.id,
        numeroVente: v.numero,
        date: v.date,
        montantTotal: v.montantTotal,
        modePaiement: v.modePaiement || 'COMPTANT',
        clientId: v.clientId,
        entiteId: v.entiteId,
        utilisateurId: v.utilisateurId,
        magasinId: v.magasinId,
        fraisApproche: v.fraisApproche || 0,
        reglements: v.reglements.map(r => ({ mode: r.mode, montant: r.montant })),
        lignes: v.lignes.map(l => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          coutUnitaire: l.coutUnitaire,
          tva: l.tva,
          remise: l.remise
        }))
      })
    } catch (e) {
      console.error(`Erreur Vente ${v.numero}:`, e)
    }
  }

  // 2. RÉGÉNÉRER LES ACHATS
  console.log('Traitement des Achats...')
  const achats = await prisma.achat.findMany({
    where: { date: { gte: yearStart }, statut: { in: ['VALIDE', 'VALIDEE'] } },
    include: { lignes: true, reglements: true }
  })
  
  for (const a of achats) {
    try {
      await comptabiliserAchat({
        achatId: a.id,
        numeroAchat: a.numero,
        date: a.date,
        montantTotal: a.montantTotal,
        fraisApproche: a.fraisApproche || 0,
        modePaiement: a.modePaiement || 'COMPTANT',
        fournisseurId: a.fournisseurId,
        entiteId: a.entiteId,
        utilisateurId: a.utilisateurId,
        magasinId: a.magasinId,
        reglements: a.reglements.map(r => ({ mode: r.mode, montant: r.montant })),
        lignes: a.lignes.map(l => ({
          produitId: l.produitId,
          designation: l.designation,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva,
          remise: l.remise
        }))
      })
    } catch (e) {
      console.error(`Erreur Achat ${a.numero}:`, e)
    }
  }

  // 3. RÉGÉNÉRER LES DÉPENSES
  console.log('Traitement des Dépenses...')
  const depenses = await prisma.depense.findMany({
    where: { date: { gte: yearStart } }
  })
  for (const d of depenses) {
    try {
      await comptabiliserDepense({
        depenseId: d.id,
        date: d.date,
        montant: d.montant,
        categorie: d.categorie,
        libelle: d.libelle,
        modePaiement: d.modePaiement || 'ESPECES',
        utilisateurId: d.utilisateurId,
        entiteId: d.entiteId,
        magasinId: d.magasinId
      })
    } catch (e) {
      console.error(`Erreur Dépense ${d.id}:`, e)
    }
  }

  console.log('--- RÉGÉNÉRATION COMPTABLE TERMINÉE ---')
}

restore()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
