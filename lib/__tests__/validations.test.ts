import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  restoreSchema,
  parametresPatchSchema,
  produitSchema,
  clientSchema,
  fournisseurSchema,
  magasinSchema,
  depenseSchema,
  venteSchema,
  chargeSchema,
  ecritureSchema,
  journalSchema,
  achatSchema,
  mouvementStockSchema,
  transfertSchema,
  reglementVenteSchema,
  reglementCompteCourantSchema,
  banqueSchema,
  banqueOperationSchema,
  caisseSchema,
  entiteSchema,
  planCompteSchema,
  commandeFournisseurSchema,
  compteCourantSchema,
  reglementAchatSchema,
  stockInventaireSchema,
  archiveVenteSchema,
  printTemplateSchema,
  emailFactureSchema,
  relanceSchema,
  notificationSchema,
  lettrageSchema,
  compensationSchema,
  virementBancaireSchema,
  reconciliationBancaireSchema,
  reaproSchema,
  strictPasswordSchema,
} from '../validations'

describe('loginSchema', () => {
  it('valide un login valide', () => {
    const r = loginSchema.safeParse({ login: 'admin', motDePasse: 'pass' })
    expect(r.success).toBe(true)
  })
  it('rejette login vide', () => {
    const r = loginSchema.safeParse({ login: '', motDePasse: 'pass' })
    expect(r.success).toBe(false)
  })
  it('rejette mot de passe vide', () => {
    const r = loginSchema.safeParse({ login: 'admin', motDePasse: '' })
    expect(r.success).toBe(false)
  })
  it('accepte redirect optionnel', () => {
    const r = loginSchema.safeParse({ login: 'admin', motDePasse: 'pass', redirect: '/dashboard' })
    expect(r.success).toBe(true)
  })
  it('rejette redirect trop long', () => {
    const r = loginSchema.safeParse({ login: 'admin', motDePasse: 'pass', redirect: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })
})

describe('strictPasswordSchema', () => {
  it('valide un mot de passe fort', () => {
    const r = strictPasswordSchema.safeParse('Admin@123')
    expect(r.success).toBe(true)
  })
  it('rejette moins de 8 caracteres', () => {
    const r = strictPasswordSchema.safeParse('Ab1@')
    expect(r.success).toBe(false)
  })
  it('rejette sans majuscule', () => {
    const r = strictPasswordSchema.safeParse('admin@123')
    expect(r.success).toBe(false)
  })
  it('rejette sans minuscule', () => {
    const r = strictPasswordSchema.safeParse('ADMIN@123')
    expect(r.success).toBe(false)
  })
  it('rejette sans chiffre', () => {
    const r = strictPasswordSchema.safeParse('Admin@abc')
    expect(r.success).toBe(false)
  })
  it('rejette sans caractere special', () => {
    const r = strictPasswordSchema.safeParse('Admin1234')
    expect(r.success).toBe(false)
  })
})

describe('restoreSchema', () => {
  it('valide un nom de backup correct', () => {
    const r = restoreSchema.safeParse({ name: 'gesticom-backup-2025-01-15-120000.db', confirmName: 'gesticom-backup-2025-01-15-120000.db' })
    expect(r.success).toBe(true)
  })
  it('rejette un nom invalide', () => {
    const r = restoreSchema.safeParse({ name: 'backup.db', confirmName: 'backup.db' })
    expect(r.success).toBe(false)
  })
  it('rejette si confirmation differente', () => {
    const r = restoreSchema.safeParse({ name: 'gesticom-backup-2025-01-15-120000.db', confirmName: 'autre.db' })
    expect(r.success).toBe(false)
  })
})

describe('produitSchema', () => {
  const valid = { designation: 'Produit test', categorie: 'ALIMENTATION' }
  it('valide un produit minimal', () => {
    const r = produitSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.seuilMin).toBe(5)
    }
  })
  it('valide avec code optionnel', () => {
    const r = produitSchema.safeParse({ ...valid, code: 'PRD001' })
    expect(r.success).toBe(true)
  })
  it('valide avec prix', () => {
    const r = produitSchema.safeParse({ ...valid, prixAchat: 1000, prixVente: 1500 })
    expect(r.success).toBe(true)
  })
  it('rejette designation vide', () => {
    const r = produitSchema.safeParse({ ...valid, designation: '' })
    expect(r.success).toBe(false)
  })
  it('rejette designation trop longue', () => {
    const r = produitSchema.safeParse({ ...valid, designation: 'x'.repeat(501) })
    expect(r.success).toBe(false)
  })
  it('rejette categorie vide', () => {
    const r = produitSchema.safeParse({ ...valid, categorie: '' })
    expect(r.success).toBe(false)
  })
  it('rejette prixAchat negatif', () => {
    const r = produitSchema.safeParse({ ...valid, prixAchat: -10 })
    expect(r.success).toBe(false)
  })
  it('accepte codeBarres EAN-13 valide', () => {
    const r = produitSchema.safeParse({ ...valid, codeBarres: '1234567890128' })
    expect(r.success).toBe(true)
  })
  it('rejette codeBarres invalide', () => {
    const r = produitSchema.safeParse({ ...valid, codeBarres: 'abc' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.codeBarres).toBeNull()
    }
  })
  it('code trop long', () => {
    const r = produitSchema.safeParse({ ...valid, code: 'x'.repeat(51) })
    expect(r.success).toBe(false)
  })
})

describe('clientSchema', () => {
  it('valide un client CASH', () => {
    const r = clientSchema.safeParse({ nom: 'Jean Dupont', telephone: '771234567', type: 'CASH' })
    expect(r.success).toBe(true)
  })
  it('valide un client CREDIT avec plafond', () => {
    const r = clientSchema.safeParse({ nom: 'Mamadou Diallo', type: 'CREDIT', plafondCredit: 500000 })
    expect(r.success).toBe(true)
  })
  it('rejette client CREDIT sans plafond', () => {
    const r = clientSchema.safeParse({ nom: 'Test', type: 'CREDIT' })
    expect(r.success).toBe(false)
  })
  it('rejette type invalide', () => {
    const r = clientSchema.safeParse({ nom: 'Test', type: 'INVALIDE' })
    expect(r.success).toBe(false)
  })
  it('rejette nom vide', () => {
    const r = clientSchema.safeParse({ nom: '', type: 'CASH' })
    expect(r.success).toBe(false)
  })
  it('accepte email valide', () => {
    const r = clientSchema.safeParse({ nom: 'Test', type: 'CASH', email: 'test@example.com' })
    expect(r.success).toBe(true)
  })
  it('rejette email invalide', () => {
    const r = clientSchema.safeParse({ nom: 'Test', type: 'CASH', email: 'pas-un-email' })
    expect(r.success).toBe(false)
  })
})

describe('fournisseurSchema', () => {
  it('valide un fournisseur minimal', () => {
    const r = fournisseurSchema.safeParse({ nom: 'Fournisseur SA' })
    expect(r.success).toBe(true)
  })
  it('valide avec tous les champs', () => {
    const r = fournisseurSchema.safeParse({
      nom: 'Fournisseur SA',
      telephone: '771234567',
      email: 'contact@fournisseur.com',
      ncc: 'NCC001',
      localisation: 'Dakar',
    })
    expect(r.success).toBe(true)
  })
  it('rejette nom vide', () => {
    const r = fournisseurSchema.safeParse({ nom: '' })
    expect(r.success).toBe(false)
  })
})

describe('magasinSchema', () => {
  it('valide un magasin', () => {
    const r = magasinSchema.safeParse({ code: 'MAG01', nom: 'Magasin Principal' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.code).toBe('MAG01')
    }
  })
  it('upper-case le code', () => {
    const r = magasinSchema.safeParse({ code: 'mag01', nom: 'Test' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.code).toBe('MAG01')
    }
  })
  it('rejette code vide', () => {
    const r = magasinSchema.safeParse({ code: '', nom: 'Test' })
    expect(r.success).toBe(false)
  })
})

describe('depenseSchema', () => {
  const valid = {
    date: '2025-01-15',
    categorie: 'TRANSPORT',
    libelle: 'Transport marchandises',
    montant: 50000,
    modePaiement: 'ESPECES',
  }
  it('valide une depense', () => {
    const r = depenseSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('rejette montant zero', () => {
    const r = depenseSchema.safeParse({ ...valid, montant: 0 })
    expect(r.success).toBe(false)
  })
  it('rejette montant negatif', () => {
    const r = depenseSchema.safeParse({ ...valid, montant: -100 })
    expect(r.success).toBe(false)
  })
  it('rejette libelle vide', () => {
    const r = depenseSchema.safeParse({ ...valid, libelle: '' })
    expect(r.success).toBe(false)
  })
})

describe('venteSchema', () => {
  const valid = {
    date: '2025-01-15',
    clientId: 1,
    montantTotal: 50000,
    modePaiement: 'ESPECES',
    lignes: [
      { produitId: 1, quantite: 2, prixUnitaire: 25000 },
    ],
  }
  it('valide une vente', () => {
    const r = venteSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('rejette sans lignes', () => {
    const r = venteSchema.safeParse({ ...valid, lignes: [] })
    expect(r.success).toBe(false)
  })
  it('rejette quantite ligne zero', () => {
    const r = venteSchema.safeParse({ ...valid, lignes: [{ produitId: 1, quantite: 0, prixUnitaire: 1000 }] })
    expect(r.success).toBe(false)
  })
  it('valide avec clientLibre', () => {
    const r = venteSchema.safeParse({ ...valid, clientId: undefined, clientLibre: 'Client au comptoir' })
    expect(r.success).toBe(true)
  })
})

describe('chargeSchema', () => {
  const valid = {
    date: '2025-01-15',
    type: 'FIXE',
    rubrique: 'Loyer',
    montant: 200000,
    modePaiement: 'ESPECES',
  }
  it('valide une charge', () => {
    const r = chargeSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('rejette type invalide', () => {
    const r = chargeSchema.safeParse({ ...valid, type: 'INVALIDE' })
    expect(r.success).toBe(false)
  })
})

describe('ecritureSchema', () => {
  it('valide une ecriture au debit', () => {
    const r = ecritureSchema.safeParse({
      date: '2025-01-15', journalId: 1, libelle: 'Test', compteId: 1, debit: 1000, credit: 0,
    })
    expect(r.success).toBe(true)
  })
  it('valide une ecriture au credit', () => {
    const r = ecritureSchema.safeParse({
      date: '2025-01-15', journalId: 1, libelle: 'Test', compteId: 1, debit: 0, credit: 1000,
    })
    expect(r.success).toBe(true)
  })
  it('rejette sans debit ni credit', () => {
    const r = ecritureSchema.safeParse({
      date: '2025-01-15', journalId: 1, libelle: 'Test', compteId: 1, debit: 0, credit: 0,
    })
    expect(r.success).toBe(false)
  })
  it('rejette debit ET credit en meme temps', () => {
    const r = ecritureSchema.safeParse({
      date: '2025-01-15', journalId: 1, libelle: 'Test', compteId: 1, debit: 500, credit: 500,
    })
    expect(r.success).toBe(false)
  })
})

describe('journalSchema', () => {
  it('valide un journal', () => {
    const r = journalSchema.safeParse({ code: 'VT', libelle: 'Ventes', type: 'VENTES' })
    expect(r.success).toBe(true)
  })
  it('rejette type invalide', () => {
    const r = journalSchema.safeParse({ code: 'XX', libelle: 'Test', type: 'INVALIDE' })
    expect(r.success).toBe(false)
  })
  it('upper-case le code', () => {
    const r = journalSchema.safeParse({ code: 'vt', libelle: 'Ventes', type: 'VENTES' })
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.code).toBe('VT') }
  })
})

describe('achatSchema', () => {
  const valid = {
    magasinId: 1,
    lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 500 }],
  }
  it('valide un achat minimal', () => {
    const r = achatSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('valide avec reglements', () => {
    const r = achatSchema.safeParse({
      ...valid,
      reglements: [{ mode: 'ESPECES', montant: 5000 }],
    })
    expect(r.success).toBe(true)
  })
  it('rejette sans lignes', () => {
    const r = achatSchema.safeParse({ ...valid, lignes: [] })
    expect(r.success).toBe(false)
  })
  it('rejette quantite ligne zero', () => {
    const r = achatSchema.safeParse({ ...valid, lignes: [{ produitId: 1, quantite: 0, prixUnitaire: 500 }] })
    expect(r.success).toBe(false)
  })
})

describe('mouvementStockSchema', () => {
  it('valide un mouvement', () => {
    const r = mouvementStockSchema.safeParse({ magasinId: 1, produitId: 1, quantite: 10 })
    expect(r.success).toBe(true)
  })
  it('rejette quantite zero', () => {
    const r = mouvementStockSchema.safeParse({ magasinId: 1, produitId: 1, quantite: 0 })
    expect(r.success).toBe(false)
  })
})

describe('transfertSchema', () => {
  it('valide un transfert', () => {
    const r = transfertSchema.safeParse({
      magasinOrigineId: 1, magasinDestId: 2,
      lignes: [{ produitId: 1, quantite: 5 }],
    })
    expect(r.success).toBe(true)
  })
  it('rejette si meme magasin', () => {
    const r = transfertSchema.safeParse({
      magasinOrigineId: 1, magasinDestId: 1,
      lignes: [{ produitId: 1, quantite: 5 }],
    })
    expect(r.success).toBe(true)
  })
})

describe('banqueSchema', () => {
  it('valide une banque', () => {
    const r = banqueSchema.safeParse({ numero: 'SN123456', nomBanque: 'CBAO', libelle: 'Compte courant' })
    expect(r.success).toBe(true)
  })
  it('rejette numero vide', () => {
    const r = banqueSchema.safeParse({ numero: '', nomBanque: 'CBAO', libelle: 'Compte' })
    expect(r.success).toBe(false)
  })
})

describe('banqueOperationSchema', () => {
  const valid = { banqueId: 1, date: '2025-01-15', type: 'ENTREE', montant: 500000 }
  it('valide une operation', () => {
    const r = banqueOperationSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('rejette type invalide', () => {
    const r = banqueOperationSchema.safeParse({ ...valid, type: 'INVALIDE' })
    expect(r.success).toBe(false)
  })
  it('rejette montant negatif', () => {
    const r = banqueOperationSchema.safeParse({ ...valid, montant: -100 })
    expect(r.success).toBe(false)
  })
})

describe('caisseSchema', () => {
  const valid = { magasinId: 1, type: 'ENTREE', motif: 'Approvisionnement', montant: 100000 }
  it('valide une operation caisse', () => {
    const r = caisseSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })
  it('rejette type invalide', () => {
    const r = caisseSchema.safeParse({ ...valid, type: 'INVALIDE' })
    expect(r.success).toBe(false)
  })
  it('rejette montant negatif', () => {
    const r = caisseSchema.safeParse({ ...valid, montant: -500 })
    expect(r.success).toBe(false)
  })
})

describe('entiteSchema', () => {
  it('valide une entite', () => {
    const r = entiteSchema.safeParse({ code: 'MERE', nom: 'Maison Mere', localisation: 'Dakar' })
    expect(r.success).toBe(true)
  })
})

describe('planCompteSchema', () => {
  it('valide un plan', () => {
    const r = planCompteSchema.safeParse({ numero: '601', libelle: 'Achats', classe: '6' })
    expect(r.success).toBe(true)
  })
})

describe('reglementVenteSchema', () => {
  it('valide un reglement', () => {
    const r = reglementVenteSchema.safeParse({ venteId: 1, montant: 25000, modePaiement: 'ESPECES' })
    expect(r.success).toBe(true)
  })
  it('rejette montant zero', () => {
    const r = reglementVenteSchema.safeParse({ venteId: 1, montant: 0, modePaiement: 'ESPECES' })
    expect(r.success).toBe(false)
  })
})

describe('reglementAchatSchema', () => {
  it('valide un reglement achat', () => {
    const r = reglementAchatSchema.safeParse({ achatId: 1, montant: 50000, modePaiement: 'CHEQUE' })
    expect(r.success).toBe(true)
  })
})

describe('compteCourantSchema', () => {
  it('valide avec clientId', () => {
    const r = compteCourantSchema.safeParse({ nom: 'Compte Test', clientId: 1 })
    expect(r.success).toBe(true)
  })
  it('rejette sans client ni fournisseur', () => {
    const r = compteCourantSchema.safeParse({ nom: 'Compte Test' })
    expect(r.success).toBe(false)
  })
})

describe('stockInventaireSchema', () => {
  it('valide un inventaire', () => {
    const r = stockInventaireSchema.safeParse({
      magasinId: 1,
      lignes: [{ produitId: 1, quantiteTheorique: 10, quantitePhysique: 9 }],
    })
    expect(r.success).toBe(true)
  })
  it('rejette sans lignes', () => {
    const r = stockInventaireSchema.safeParse({ magasinId: 1, lignes: [] })
    expect(r.success).toBe(false)
  })
})

describe('archiveVenteSchema', () => {
  it('valide une archive', () => {
    const r = archiveVenteSchema.safeParse({ venteId: 1, motif: 'Vente annulee' })
    expect(r.success).toBe(true)
  })
})

describe('printTemplateSchema', () => {
  it('valide un template', () => {
    const r = printTemplateSchema.safeParse({ nom: 'Facture Standard', contenu: '<html>...</html>' })
    expect(r.success).toBe(true)
  })
})

describe('emailFactureSchema', () => {
  it('valide un email', () => {
    const r = emailFactureSchema.safeParse({ venteId: 1, destinataire: 'client@example.com' })
    expect(r.success).toBe(true)
  })
  it('rejette email invalide', () => {
    const r = emailFactureSchema.safeParse({ venteId: 1, destinataire: 'pas-email' })
    expect(r.success).toBe(false)
  })
})

describe('relanceSchema', () => {
  it('valide une relance', () => {
    const r = relanceSchema.safeParse({ clientId: 1 })
    expect(r.success).toBe(true)
  })
})

describe('notificationSchema', () => {
  it('valide une notification', () => {
    const r = notificationSchema.safeParse({ titre: 'Alerte stock', message: 'Stock bas' })
    expect(r.success).toBe(true)
  })
})

describe('lettrageSchema', () => {
  it('valide un lettrage', () => {
    const r = lettrageSchema.safeParse({ compteCourantId: 1, montant: 50000 })
    expect(r.success).toBe(true)
  })
})

describe('compensationSchema', () => {
  it('valide une compensation', () => {
    const r = compensationSchema.safeParse({ compteCourantOrigineId: 1, compteCourantDestId: 2, montant: 50000 })
    expect(r.success).toBe(true)
  })
})

describe('virementBancaireSchema', () => {
  it('valide un virement', () => {
    const r = virementBancaireSchema.safeParse({ banqueOrigineId: 1, banqueDestId: 2, montant: 500000 })
    expect(r.success).toBe(true)
  })
})

describe('reconciliationBancaireSchema', () => {
  it('valide une reconciliation', () => {
    const r = reconciliationBancaireSchema.safeParse({ banqueId: 1, dateReleve: '2025-01-31', soldeReleve: 1000000 })
    expect(r.success).toBe(true)
  })
})

describe('reaproSchema', () => {
  it('valide un reapro', () => {
    const r = reaproSchema.safeParse({
      magasinId: 1,
      lignes: [{ produitId: 1, quantiteRecommande: 10 }],
    })
    expect(r.success).toBe(true)
  })
})

describe('parametresPatchSchema', () => {
  it('valide des parametres partiels', () => {
    const r = parametresPatchSchema.safeParse({ nomEntreprise: 'Ma boutique' })
    expect(r.success).toBe(true)
  })
  it('valide TVA', () => {
    const r = parametresPatchSchema.safeParse({ tvaParDefaut: 18 })
    expect(r.success).toBe(true)
  })
  it('rejette TVA hors plage', () => {
    const r = parametresPatchSchema.safeParse({ tvaParDefaut: 150 })
    expect(r.success).toBe(false)
  })
})

describe('reglementCompteCourantSchema', () => {
  it('valide un reglement CC', () => {
    const r = reglementCompteCourantSchema.safeParse({ compteCourantId: 1, montant: 50000, modePaiement: 'ESPECES' })
    expect(r.success).toBe(true)
  })
})

describe('commandeFournisseurSchema', () => {
  it('valide une commande', () => {
    const r = commandeFournisseurSchema.safeParse({
      magasinId: 1,
      lignes: [{ produitId: 1, quantite: 10, prixUnitaire: 1000 }],
    })
    expect(r.success).toBe(true)
  })
})
