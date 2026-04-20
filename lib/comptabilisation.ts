import { prisma } from './db'
import {
  htNetDepuisTtcEtTauxGlobal,
  montantHtNetTotalLignesCompta,
  montantTvaDepuisTtcEtHtNet,
} from './calculs-commerciaux'

/**
 * Service de comptabilisation automatique SYSCOHADA
 * Génère automatiquement les écritures comptables à partir des opérations métier
 */

// Comptes SYSCOHADA par défaut
export const COMPTES_DEFAUT = {
  // CLASSE 3 - STOCKS
  STOCK_MARCHANDISES: '311', // Stock de marchandises (corrigé de 31 à 311)
  VARIATION_STOCKS: '603',   // Variation de stocks
  
  // CLASSE 4 - TIERS
  FOURNISSEURS: '401', // Fournisseurs
  CLIENTS: '411', // Clients
  TVA_COLLECTEE: '443', // État, TVA collectée (Ventes)
  TVA_DEDUCTIBLE: '445', // État, TVA récupérable (Achats)
  
  // CLASSE 5 - TRÉSORERIE
  CAISSE: '531', // Caisse
  BANQUE: '521', // Banque (corrigé de 512 à 521)
  
  // CLASSE 6 - CHARGES
  ACHATS_MARCHANDISES: '601', // Achats de marchandises
  ACHATS_MATIERES: '602', // Achats de matières premières
  SERVICES_EXTERIEURS: '606', // Services extérieurs
  IMPOTS_TAXES: '631', // Impôts, taxes et versements assimilés
  CHARGES_PERSONNEL: '641', // Charges de personnel
  AUTRES_CHARGES: '658', // Autres charges
  
  // CLASSE 7 - PRODUITS
  VENTES_MARCHANDISES: '701', // Ventes de marchandises
  VENTES_PRODUITS_FINIS: '703', // Ventes de produits finis
  PRODUITS_DIVERS: '758', // Produits divers
}

// Alias pour compatibilité
const VENTES_MARCHANDISES = COMPTES_DEFAUT.VENTES_MARCHANDISES

/**
 * Récupère ou crée un compte par son numéro
 */
async function getOrCreateCompte(numero: string, libelle: string, classe: string, type: string, tx?: any) {
  const p = tx || prisma
  return await p.planCompte.upsert({
    where: { numero },
    update: {},
    create: { numero, libelle, classe, type, actif: true },
  })
}

/**
 * Récupère ou crée un journal par son code
 */
async function getOrCreateJournal(code: string, libelle: string, type: string, tx?: any) {
  const p = tx || prisma
  return await p.journal.upsert({
    where: { code },
    update: {},
    create: { code, libelle, type, actif: true },
  })
}

/**
 * Crée une écriture comptable
 */
async function createEcriture(data: {
  date: Date
  journalId: number
  entiteId?: number
  piece: string | null
  libelle: string
  compteId: number
  debit: number
  credit: number
  reference: string | null
  referenceType: string | null
  referenceId: number | null
  utilisateurId: number
}, tx?: any) {
  if ((data.debit || 0) <= 0 && (data.credit || 0) <= 0) {
    console.warn(`[Comptabilisation] Barrière de validation => Ignore l'écriture (${data.libelle}): Débit=${data.debit}, Crédit=${data.credit}`);
    return null;
  }

  const p = tx || prisma
  
  // IDEMPOTENCE : Vérifier si une écriture identique existe déjà
  if (data.referenceId && data.referenceType) {
    const exist = await p.ecritureComptable.findFirst({
      where: {
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        compteId: data.compteId,
        debit: Math.round(data.debit || 0),
        credit: Math.round(data.credit || 0),
        entiteId: data.entiteId || 1
      }
    })
    if (exist) {
      // console.log(`[Comptabilisation] Écriture déjà existante (ignorée) : ${data.referenceType}#${data.referenceId}`);
      return exist
    }
  }

  const numero = `ECR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  
  return await p.ecritureComptable.create({
    data: {
      numero,
      ...data,
      debit: Math.round(data.debit || 0),
      credit: Math.round(data.credit || 0),
      entiteId: data.entiteId || 1
    },
  })
}

/**
 * Comptabilise une vente
 */
export async function comptabiliserVente(data: {
  venteId: number
  numeroVente: string
  date: Date
  montantTotal: number
  modePaiement: string
  clientId?: number | null
  entiteId?: number
  utilisateurId: number
  magasinId: number
  fraisApproche?: number
  reglements?: { mode: string; montant: number }[]
  lignes?: { produitId: number; designation: string; quantite: number; prixUnitaire: number; coutUnitaire: number; tva?: number; remise?: number }[]
}, tx?: any) {
  const p = tx || prisma
  console.log(`[DEBUG] comptabiliserVente: numero=${data.numeroVente}, montant=${data.montantTotal}`);

  if (data.montantTotal <= 0) {
    // console.log(`[Comptabilisation] Ignore vente nulle : ${data.numeroVente}`);
    return null;
  }

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  // Supprime toutes les écritures liées à cette vente ou ses règlements pour éviter les doublons lors des mises à jour
  await p.ecritureComptable.deleteMany({
    where: {
      OR: [
        { referenceType: 'VENTE', referenceId: data.venteId },
        { referenceType: 'VENTE_STOCK', referenceId: data.venteId },
        { referenceType: 'VENTE_FRAIS', referenceId: data.venteId },
        { referenceType: 'VENTE_REGLEMENT', referenceId: data.venteId }
      ]
    }
  })
  
  const journalVentes = await getOrCreateJournal('VE', 'Journal des Ventes', 'VENTES', tx)
  const compteVentes = await getOrCreateCompte('701', 'Ventes de marchandises', '7', 'PRODUITS', tx)
  const compteClient = await getOrCreateCompte(COMPTES_DEFAUT.CLIENTS, 'Clients', '4', 'ACTIF', tx)
  const compteTva = await getOrCreateCompte(COMPTES_DEFAUT.TVA_COLLECTEE, 'TVA Collectée', '4', 'PASSIF', tx)
  const compteVariationStock = await getOrCreateCompte(COMPTES_DEFAUT.VARIATION_STOCKS, 'Variation de stocks', '6', 'CHARGES', tx)
  const compteStock = await getOrCreateCompte(COMPTES_DEFAUT.STOCK_MARCHANDISES, 'Stock de marchandises', '3', 'ACTIF', tx)
  
  const entiteId = data.entiteId
  if (!entiteId) throw new Error('[Comptabilisation] entiteId requis')
  
  // Calcul TVA et HT global (GestiCom travaille en prix unitaires HT)
  let montantTTC = data.montantTotal
  let montantHT = 0
  let montantTVA = 0
  
  if (data.lignes && data.lignes.length > 0) {
    montantHT = montantHtNetTotalLignesCompta(
      data.lignes.map((l) => ({
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        remise: l.remise ?? 0,
      }))
    )
    montantTVA = montantTvaDepuisTtcEtHtNet(montantTTC, montantHT)
  } else {
    const param = await p.parametre.findFirst({ orderBy: { id: 'asc' } })
    montantHT = htNetDepuisTtcEtTauxGlobal(montantTTC, param?.tvaParDefaut || 0)
    montantTVA = montantTvaDepuisTtcEtHtNet(montantTTC, montantHT)
  }

  // 1. Écriture de CRÉDIT (Ventes HT)
  await createEcriture({
    date: data.date,
    journalId: journalVentes.id,
    entiteId,
    piece: data.numeroVente,
    libelle: `Vente ${data.numeroVente} (HT)`,
    compteId: compteVentes.id,
    debit: 0,
    credit: montantHT,
    reference: data.numeroVente,
    referenceType: 'VENTE',
    referenceId: data.venteId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // 2. Écriture de CRÉDIT (TVA Collectée)
  if (montantTVA > 0) {
    await createEcriture({
      date: data.date,
      journalId: journalVentes.id,
      entiteId,
      piece: data.numeroVente,
      libelle: `TVA sur Vente ${data.numeroVente}`,
      compteId: compteTva.id,
      debit: 0,
      credit: montantTVA,
      reference: data.numeroVente,
      referenceType: 'VENTE',
      referenceId: data.venteId,
      utilisateurId: data.utilisateurId,
    }, tx)
  }

  // 3. Écriture de DÉBIT (Compte Client)
  await createEcriture({
    date: data.date,
    journalId: journalVentes.id,
    entiteId,
    piece: data.numeroVente,
    libelle: `Créance Client - Vente ${data.numeroVente}`,
    compteId: compteClient.id,
    debit: montantTTC,
    credit: 0,
    reference: data.numeroVente,
    referenceType: 'VENTE',
    referenceId: data.venteId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // 4. ÉCRITURE DE FRAIS LOGISTIQUES (Si applicable)
  const fraisVente = data.fraisApproche || 0
  if (fraisVente > 0) {
    const compteTransport = await getOrCreateCompte('624', 'Transport sur vente', '6', 'CHARGES', tx)
    const compteCaisse = await getOrCreateCompte(COMPTES_DEFAUT.CAISSE, 'Caisse', '5', 'ACTIF', tx)
    
    await createEcriture({
      date: data.date,
      journalId: journalVentes.id,
      entiteId,
      piece: data.numeroVente,
      libelle: `Frais logistiques - Vente ${data.numeroVente}`,
      compteId: compteTransport.id,
      debit: fraisVente,
      credit: 0,
      reference: data.numeroVente,
      referenceType: 'VENTE_FRAIS',
      referenceId: data.venteId,
      utilisateurId: data.utilisateurId,
    }, tx)

    await createEcriture({
      date: data.date,
      journalId: journalVentes.id,
      entiteId,
      piece: data.numeroVente,
      libelle: `Paiement frais Vente ${data.numeroVente}`,
      compteId: compteCaisse.id,
      debit: 0,
      credit: fraisVente,
      reference: data.numeroVente,
      referenceType: 'VENTE_FRAIS',
      referenceId: data.venteId,
      utilisateurId: data.utilisateurId,
    }, tx)
    
    // Synchronisation physique de la caisse (Sortie)
    if (data.magasinId) {
      await p.caisse.create({
        data: {
          date: data.date,
          magasinId: data.magasinId,
          type: 'SORTIE',
          motif: `FRAIS LOGISTIQUES VENTE ${data.numeroVente}`,
          montant: fraisVente,
          utilisateurId: data.utilisateurId,
          entiteId: entiteId
        }
      })
    }
  }

  // 5. SORTIE DE STOCK (Classe 3)
  if (data.lignes && data.lignes.length > 0) {
    const coutTotal = data.lignes.reduce((sum, l) => sum + (l.coutUnitaire * l.quantite), 0)
    if (coutTotal > 0) {
      const journalOD = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
      // Débit 603 (Variation) / Crédit 311 (Stock)
      await createEcriture({
        date: data.date,
        journalId: journalOD.id,
        entiteId,
        piece: data.numeroVente,
        libelle: `Sortie Stock - Vente ${data.numeroVente}`,
        compteId: compteVariationStock.id,
        debit: coutTotal,
        credit: 0,
        reference: data.numeroVente,
        referenceType: 'VENTE_STOCK',
        referenceId: data.venteId,
        utilisateurId: data.utilisateurId,
      }, tx)
      await createEcriture({
        date: data.date,
        journalId: journalOD.id,
        entiteId,
        piece: data.numeroVente,
        libelle: `Sortie Stock - Vente ${data.numeroVente}`,
        compteId: compteStock.id,
        debit: 0,
        credit: coutTotal,
        reference: data.numeroVente,
        referenceType: 'VENTE_STOCK',
        referenceId: data.venteId,
        utilisateurId: data.utilisateurId,
      }, tx)
    }
  }

  // 5. Règlements (Écritures de Trésorerie)
  if (data.reglements && data.reglements.length > 0) {
    for (const reg of data.reglements) {
      if (reg.montant <= 0) continue
      await comptabiliserReglementVente({
        venteId: data.venteId,
        numeroVente: data.numeroVente,
        date: data.date,
        montant: reg.montant,
        modePaiement: reg.mode,
        utilisateurId: data.utilisateurId,
        entiteId: data.entiteId,
        magasinId: data.magasinId
      }, tx)
    }
  }
}

/**
 * Comptabilise un règlement sur une vente (Crédit vers Règlement)
 */
export async function comptabiliserReglementVente(data: {
  reglementId?: number | null
  venteId: number | null
  numeroVente: string
  date: Date
  montant: number
  modePaiement: string
  utilisateurId: number
  entiteId?: number
  magasinId?: number | null
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  if (data.reglementId) {
    await p.ecritureComptable.deleteMany({
      where: { referenceType: 'VENTE_REGLEMENT', referenceId: data.reglementId }
    })
  }

  const journal = await getOrCreateJournal('CA', 'Journal de Caisse', 'CAISSE', tx)
  const compteClient = await getOrCreateCompte(
    COMPTES_DEFAUT.CLIENTS,
    'Clients',
    '4',
    'ACTIF',
    tx
  )
  const entiteId = data.entiteId
  if (!entiteId) throw new Error('[Comptabilisation] entiteId requis')
  
  // Déterminer le compte de trésorerie dynamiquement
  let compteTresorerie: { id: number }
  const m = (data.modePaiement || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isCash = m === 'ESPECES' || m === 'CASH' || m === 'ESPECE'
  
  if (isCash) {
    compteTresorerie = await getOrCreateCompte(COMPTES_DEFAUT.CAISSE, 'Caisse', '5', 'ACTIF', tx)
  } else {
    // Mobile Money, Chèque, Virement vont en 521 (Banque/MM)
    const banque = await p.banque.findFirst({
      where: { entiteId, actif: true },
      orderBy: { id: 'asc' }
    })
    
    if (banque && banque.compteId) {
      const dbCompte = await p.planCompte.findUnique({ where: { id: banque.compteId } })
      compteTresorerie = dbCompte || await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    } else {
      compteTresorerie = await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    }
  }
  
  // Écriture : Débit Caisse/Banque (entrée d'argent), Crédit Clients (réduit la créance)
  // FIX: Sécurisation de l'idempotence (Point 3 Audit)
  // Si reglementId est absent, on génère une clé basée sur le montant et la date pour éviter les collisions
  const referenceId = data.reglementId || data.venteId || 0
  const uniqueRef = data.reglementId 
    ? `REG-VEN-${data.reglementId}` 
    : `REG-VEN-V${data.venteId}-M${data.montant}-${data.date.getTime()}`

  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId,
    piece: data.numeroVente,
    libelle: `Règlement Vente ${data.numeroVente}`,
    compteId: compteTresorerie.id,
    debit: data.montant,
    credit: 0,
    reference: uniqueRef,
    referenceType: 'VENTE_REGLEMENT',
    referenceId: referenceId,
    utilisateurId: data.utilisateurId,
  }, tx)
  
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId,
    piece: data.numeroVente,
    libelle: `Règlement Vente ${data.numeroVente}`,
    compteId: compteClient.id,
    debit: 0,
    credit: data.montant,
    reference: uniqueRef,
    referenceType: 'VENTE_REGLEMENT',
    referenceId: referenceId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // NOTE: Les mouvements physiques de Caisse/Banque ne sont JAMAIS gérés ici.
  // C'est à l'API métier de décider si le paiement doit impacter la trésorerie physique
  // (selon la règle de flexibilité métier adoptée).
}

/**
 * Comptabilise un achat
 */
export async function comptabiliserAchat(data: {
  achatId: number
  numeroAchat: string
  date: Date
  montantTotal: number
  fraisApproche?: number
  modePaiement: string
  fournisseurId?: number | null
  entiteId?: number
  utilisateurId: number
  magasinId: number
  reglements?: { mode: string; montant: number }[]
  lignes?: { produitId: number; designation: string; quantite: number; prixUnitaire: number; tva?: number; remise?: number }[]
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: {
      OR: [
        { referenceType: 'ACHAT', referenceId: data.achatId },
        { referenceType: 'ACHAT_STOCK', referenceId: data.achatId },
        { referenceType: 'ACHAT_REGLEMENT', referenceId: data.achatId }
      ]
    }
  })

  const journalAchats = await getOrCreateJournal('AC', 'Journal des Achats', 'ACHATS', tx)
  const compteAchats = await getOrCreateCompte(COMPTES_DEFAUT.ACHATS_MARCHANDISES, 'Achats de marchandises', '6', 'CHARGES', tx)
  const compteFournisseur = await getOrCreateCompte(COMPTES_DEFAUT.FOURNISSEURS, 'Fournisseurs', '4', 'PASSIF', tx)
  const compteTva = await getOrCreateCompte(COMPTES_DEFAUT.TVA_DEDUCTIBLE, 'TVA Récupérable', '4', 'ACTIF', tx)
  const compteStock = await getOrCreateCompte(COMPTES_DEFAUT.STOCK_MARCHANDISES, 'Stock de marchandises', '3', 'ACTIF', tx)
  const compteVariationStock = await getOrCreateCompte(COMPTES_DEFAUT.VARIATION_STOCKS, 'Variation de stocks', '6', 'CHARGES', tx)
  
  const entiteId = data.entiteId
  if (!entiteId) throw new Error('[Comptabilisation] entiteId requis')
  
  // Calcul TVA et HT (GestiCom travaille en prix unitaires HT)
  let montantTTC = data.montantTotal
  let montantHT = 0
  let montantTVA = 0
  
  if (data.lignes && data.lignes.length > 0) {
    montantHT = montantHtNetTotalLignesCompta(
      data.lignes.map((l) => ({
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        remise: l.remise ?? 0,
      }))
    )
    montantTVA = montantTvaDepuisTtcEtHtNet(montantTTC, montantHT)
  } else {
    const param = await p.parametre.findFirst({ orderBy: { id: 'asc' } })
    montantHT = htNetDepuisTtcEtTauxGlobal(montantTTC, param?.tvaParDefaut || 0)
    montantTVA = montantTvaDepuisTtcEtHtNet(montantTTC, montantHT)
  }

  // 1. Écriture de DÉBIT (Achats HT)
  await createEcriture({
    date: data.date,
    journalId: journalAchats.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Achat ${data.numeroAchat} (HT)`,
    compteId: compteAchats.id,
    debit: montantHT,
    credit: 0,
    reference: data.numeroAchat,
    referenceType: 'ACHAT',
    referenceId: data.achatId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // 2. Écriture de DÉBIT (TVA Récupérable)
  if (montantTVA > 0) {
    await createEcriture({
      date: data.date,
      journalId: journalAchats.id,
      entiteId,
      piece: data.numeroAchat,
      libelle: `TVA sur Achat ${data.numeroAchat}`,
      compteId: compteTva.id,
      debit: montantTVA,
      credit: 0,
      reference: data.numeroAchat,
      referenceType: 'ACHAT',
      referenceId: data.achatId,
      utilisateurId: data.utilisateurId,
    }, tx)
  }

  // 3. Écriture de CRÉDIT (Fournisseur TTC)
  await createEcriture({
    date: data.date,
    journalId: journalAchats.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Dette Fournisseur - Achat ${data.numeroAchat}`,
    compteId: compteFournisseur.id,
    debit: 0,
    credit: montantTTC,
    reference: data.numeroAchat,
    referenceType: 'ACHAT',
    referenceId: data.achatId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // 4. ENTRÉE EN STOCK (Classe 3)
  // VALORISATION = HT + Frais d'approche (pour être cohérent avec le PAMP)
  const journalOD = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
  const frais = data.fraisApproche || 0
  const valorisationStock = montantHT + frais
  
  await createEcriture({
    date: data.date,
    journalId: journalOD.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Entrée Stock - Achat ${data.numeroAchat}`,
    compteId: compteStock.id,
    debit: valorisationStock,
    credit: 0,
    reference: data.numeroAchat,
    referenceType: 'ACHAT_STOCK',
    referenceId: data.achatId,
    utilisateurId: data.utilisateurId,
  }, tx)
  await createEcriture({
    date: data.date,
    journalId: journalOD.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Entrée Stock - Achat ${data.numeroAchat}`,
    compteId: compteVariationStock.id,
    debit: 0,
    credit: valorisationStock,
    reference: data.numeroAchat,
    referenceType: 'ACHAT_STOCK',
    referenceId: data.achatId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // 5. Règlements (Écritures de Trésorerie)
  if (data.reglements && data.reglements.length > 0) {
    for (const reg of data.reglements) {
      if (reg.montant <= 0) continue
      await comptabiliserReglementAchat({
        achatId: data.achatId,
        numeroAchat: data.numeroAchat,
        date: data.date,
        montant: reg.montant,
        modePaiement: reg.mode,
        utilisateurId: data.utilisateurId,
        entiteId: data.entiteId,
        magasinId: data.magasinId
      }, tx)
    }
  }
}

/**
 * Comptabilise un règlement sur un achat (Crédit vers Règlement)
 */
export async function comptabiliserReglementAchat(data: {
  reglementId?: number | null
  achatId: number | null
  numeroAchat: string
  date: Date
  montant: number
  modePaiement: string
  utilisateurId: number
  entiteId?: number
  magasinId?: number | null
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  if (data.reglementId) {
    await p.ecritureComptable.deleteMany({
      where: { referenceType: 'ACHAT_REGLEMENT', referenceId: data.reglementId }
    })
  }

  const journal = await getOrCreateJournal('CA', 'Journal de Caisse', 'CAISSE', tx)
  const compteFournisseur = await getOrCreateCompte(
    COMPTES_DEFAUT.FOURNISSEURS,
    'Fournisseurs',
    '4',
    'PASSIF',
    tx
  )
  const entiteId = data.entiteId || 1
  
  // Déterminer le compte de trésorerie dynamiquement
  let compteTresorerie: { id: number }
  const m = (data.modePaiement || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const isCash = m === 'ESPECES' || m === 'CASH' || m === 'ESPECE'
  
  if (isCash) {
    compteTresorerie = await getOrCreateCompte(COMPTES_DEFAUT.CAISSE, 'Caisse', '5', 'ACTIF', tx)
  } else {
    // Mobile Money, Chèque, Virement vont en 521 (Banque/MM)
    compteTresorerie = await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
  }
  
  // Écriture : Débit Fournisseurs (réduit la dette), Crédit Caisse/Banque (sortie d'argent)
  const referenceId = data.reglementId || data.achatId || 0

  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Règlement Achat ${data.numeroAchat}`,
    compteId: compteFournisseur.id,
    debit: data.montant,
    credit: 0,
    reference: `REG-ACH-${referenceId}`,
    referenceType: 'ACHAT_REGLEMENT',
    referenceId: referenceId,
    utilisateurId: data.utilisateurId,
  }, tx)
  
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId,
    piece: data.numeroAchat,
    libelle: `Règlement Achat ${data.numeroAchat}`,
    compteId: compteTresorerie.id,
    debit: 0,
    credit: data.montant,
    reference: `REG-ACH-${referenceId}`,
    referenceType: 'ACHAT_REGLEMENT',
    referenceId: referenceId,
    utilisateurId: data.utilisateurId,
  }, tx)

  // NOTE: Les mouvements physiques de Caisse/Banque ne sont JAMAIS gérés ici (Lib).
  // C'est à l'API métier de décider si le paiement doit impacter la trésorerie physique.
}

/**
 * Comptabilise un mouvement de stock (Entrée/Sortie manuelle ou Inventaire)
 */
export async function comptabiliserMouvementStock(data: {
  produitId: number
  magasinId: number
  type: 'ENTREE' | 'SORTIE'
  quantite: number
  date: Date
  motif: string
  utilisateurId: number
  entiteId?: number
  mouvementId?: number | null
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  if (data.mouvementId) {
    await p.ecritureComptable.deleteMany({
      where: {
        OR: [
          { referenceType: 'STOCK_AJUSTEMENT', referenceId: data.mouvementId },
          { referenceType: 'STOCK_MVT', referenceId: data.mouvementId }
        ]
      }
    })
  }

  const journalOD = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
  const compteStock = await getOrCreateCompte(COMPTES_DEFAUT.STOCK_MARCHANDISES, 'Stock de marchandises', '3', 'ACTIF', tx)
  const compteVariation = await getOrCreateCompte(COMPTES_DEFAUT.VARIATION_STOCKS, 'Variation de stocks', '6', 'CHARGES', tx)
  const entiteId = data.entiteId || 1

  // Récupérer le produit pour son PAMP (Valorisation)
  const produit = await p.produit.findUnique({ where: { id: data.produitId } })
  const valeur = (produit?.pamp || produit?.prixAchat || 0) * data.quantite

  if (valeur <= 0) return

  if (data.type === 'ENTREE') {
    // Régul positive : Débit Stock (311) / Crédit Variation (603)
    await createEcriture({
      date: data.date,
      journalId: journalOD.id,
      entiteId,
      piece: 'STOCK',
      libelle: `Régul. Stock (+) : ${data.motif}`,
      compteId: compteStock.id,
      debit: valeur,
      credit: 0,
      reference: `STK-IN-${data.mouvementId || data.produitId}`,
      referenceType: 'STOCK_AJUSTEMENT',
      referenceId: data.mouvementId || data.produitId,
      utilisateurId: data.utilisateurId,
    }, tx)
    await createEcriture({
      date: data.date,
      journalId: journalOD.id,
      entiteId,
      piece: 'STOCK',
      libelle: `Régul. Stock (+) : ${data.motif}`,
      compteId: compteVariation.id,
      debit: 0,
      credit: valeur,
      reference: `STK-IN-${data.mouvementId || data.produitId}`,
      referenceType: 'STOCK_AJUSTEMENT',
      referenceId: data.mouvementId || data.produitId,
      utilisateurId: data.utilisateurId,
    }, tx)
  } else {
    // Régul négative / Perte : Débit Variation (603) / Crédit Stock (311)
    await createEcriture({
      date: data.date,
      journalId: journalOD.id,
      entiteId,
      piece: 'STOCK',
      libelle: `Régul. Stock (-) : ${data.motif}`,
      compteId: compteVariation.id,
      debit: valeur,
      credit: 0,
      reference: `STK-OUT-${data.mouvementId || data.produitId}`,
      referenceType: 'STOCK_AJUSTEMENT',
      referenceId: data.mouvementId || data.produitId,
      utilisateurId: data.utilisateurId,
    }, tx)
    await createEcriture({
      date: data.date,
      journalId: journalOD.id,
      entiteId,
      piece: 'STOCK',
      libelle: `Régul. Stock (-) : ${data.motif}`,
      compteId: compteStock.id,
      debit: 0,
      credit: valeur,
      reference: `STK-OUT-${data.mouvementId || data.produitId}`,
      referenceType: 'STOCK_AJUSTEMENT',
      referenceId: data.mouvementId || data.produitId,
      utilisateurId: data.utilisateurId,
    }, tx)
  }
}

/**
 * Comptabilise une dépense
 */
export async function comptabiliserDepense(data: {
  depenseId: number
  date: Date
  montant: number
  categorie: string
  libelle: string
  modePaiement: string
  utilisateurId: number
  entiteId: number
  magasinId?: number | null
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: { referenceType: 'DEPENSE', referenceId: data.depenseId }
  })

  const journal = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
  const entiteId = data.entiteId
  
  // Déterminer le compte de charge selon la catégorie
  let compteCharge: { id: number }
  const categorieUpper = data.categorie.toUpperCase()
  
  if (categorieUpper.includes('LOYER')) {
    compteCharge = await getOrCreateCompte('613', 'Loyers', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('SALAIRE')) {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.CHARGES_PERSONNEL,
      'Charges de personnel',
      '6',
      'CHARGES',
      tx
    )
  } else if (categorieUpper.includes('TRANSPORT')) {
    compteCharge = await getOrCreateCompte('624', 'Transports', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('COMMUNICATION')) {
    compteCharge = await getOrCreateCompte('626', 'Services bancaires et assimilés', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('MAINTENANCE')) {
    compteCharge = await getOrCreateCompte('615', 'Entretien et réparations', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('PUBLICITE')) {
    compteCharge = await getOrCreateCompte('612', 'Publicité, publications, relations publiques', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('ASSURANCE')) {
    compteCharge = await getOrCreateCompte('616', 'Primes d\'assurances', '6', 'CHARGES', tx)
  } else if (categorieUpper.includes('IMPOT')) {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.IMPOTS_TAXES,
      'Impôts, taxes et versements assimilés',
      '6',
      'CHARGES',
      tx
    )
  } else {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.AUTRES_CHARGES,
      'Autres charges',
      '6',
      'CHARGES',
      tx
    )
  }
  
  // Déterminer le compte de règlement dynamiquement
  const m = data.modePaiement?.toUpperCase() || ''
  let compteReglement: { id: number }
  
  if (m === 'ESPECES' || m === 'CASH') {
    compteReglement = await getOrCreateCompte(COMPTES_DEFAUT.CAISSE, 'Caisse', '5', 'ACTIF', tx)
  } else {
    // Tentative de récupération du compte spécifique à la banque
    const banque = await p.banque.findFirst({
      where: { entiteId, actif: true },
      orderBy: { id: 'asc' }
    })
    
    if (banque && banque.compteId) {
      const dbCompte = await p.planCompte.findUnique({ where: { id: banque.compteId } })
      compteReglement = dbCompte || await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    } else {
      compteReglement = await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    }
  }
  
  // Écriture 1 : Débit Charge, Crédit Caisse
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId: entiteId,
    piece: null,
    libelle: data.libelle,
    compteId: compteCharge.id,
    debit: data.montant,
    credit: 0,
    reference: `DEP-${data.depenseId}`,
    referenceType: 'DEPENSE',
    referenceId: data.depenseId,
    utilisateurId: data.utilisateurId,
  }, tx)
  
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    entiteId: entiteId,
    piece: null,
    libelle: data.libelle,
    compteId: compteReglement.id,
    debit: 0,
    credit: data.montant,
    reference: `DEP-${data.depenseId}`,
    referenceType: 'DEPENSE',
    referenceId: data.depenseId,
    utilisateurId: data.utilisateurId,
  }, tx)


}

/**
 * Comptabilise une charge
 */
export async function comptabiliserCharge(data: {
  chargeId: number
  date: Date
  montant: number
  rubrique: string
  libelle?: string | null
  utilisateurId: number
  entiteId: number
  magasinId?: number | null
  modePaiement?: string
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: { referenceType: 'CHARGE', referenceId: data.chargeId }
  })

  const journal = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
  const entiteId = data.entiteId
  
  // Déterminer le compte de charge selon la rubrique
  let compteCharge: { id: number }
  const rubriqueUpper = data.rubrique.toUpperCase()
  
  if (rubriqueUpper.includes('LOYER')) {
    compteCharge = await getOrCreateCompte('613', 'Loyers', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('SALAIRE')) {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.CHARGES_PERSONNEL,
      'Charges de personnel',
      '6',
      'CHARGES',
      tx
    )
  } else if (rubriqueUpper.includes('ELECTRICITE') || rubriqueUpper.includes('EAU')) {
    compteCharge = await getOrCreateCompte('614', 'Charges locatives et de copropriété', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('TRANSPORT')) {
    compteCharge = await getOrCreateCompte('624', 'Transports', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('COMMUNICATION')) {
    compteCharge = await getOrCreateCompte('626', 'Services bancaires et assimilés', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('MAINTENANCE')) {
    compteCharge = await getOrCreateCompte('615', 'Entretien et réparations', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('PUBLICITE')) {
    compteCharge = await getOrCreateCompte('612', 'Publicité, publications, relations publiques', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('ASSURANCE')) {
    compteCharge = await getOrCreateCompte('616', 'Primes d\'assurances', '6', 'CHARGES', tx)
  } else if (rubriqueUpper.includes('IMPOT')) {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.IMPOTS_TAXES,
      'Impôts, taxes et versements assimilés',
      '6',
      'CHARGES',
      tx
    )
  } else {
    compteCharge = await getOrCreateCompte(
      COMPTES_DEFAUT.AUTRES_CHARGES,
      'Autres charges',
      '6',
      'CHARGES',
      tx
    )
  }
  
  // Déterminer le compte de règlement dynamiquement (Défaut Caisse si non précisé)
  const m = data.modePaiement?.toUpperCase() || ''
  const isCash = m === 'ESPECES' || m === 'CASH' || m === ''
  let compteReglement: { id: number }
  
  if (isCash) {
    compteReglement = await getOrCreateCompte(COMPTES_DEFAUT.CAISSE, 'Caisse', '5', 'ACTIF', tx)
  } else {
    // Tentative de récupération du compte spécifique à la banque
    const banque = await p.banque.findFirst({
      where: { entiteId, actif: true },
      orderBy: { id: 'asc' }
    })
    
    if (banque && banque.compteId) {
      const dbCompte = await p.planCompte.findUnique({ where: { id: banque.compteId } })
      compteReglement = dbCompte || await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    } else {
      compteReglement = await getOrCreateCompte(COMPTES_DEFAUT.BANQUE, 'Banque/MM', '5', 'ACTIF', tx)
    }
  }
  
  const libelle = data.libelle || `Charge: ${data.rubrique}`
  
  // Écriture 1 : Débit Charge, Crédit Caisse
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    piece: null,
    libelle,
    compteId: compteCharge.id,
    debit: data.montant,
    credit: 0,
    reference: `CHG-${data.chargeId}`,
    referenceType: 'CHARGE',
    referenceId: data.chargeId,
    utilisateurId: data.utilisateurId,
  }, tx)
  
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    piece: null,
    libelle,
    compteId: compteReglement.id,
    debit: 0,
    credit: data.montant,
    reference: `CHG-${data.chargeId}`,
    referenceType: 'CHARGE',
    referenceId: data.chargeId,
    utilisateurId: data.utilisateurId,
  }, tx)


}

/**
 * Comptabilise un mouvement de caisse
 */
export async function comptabiliserCaisse(data: {
  caisseId: number
  date: Date
  type: 'ENTREE' | 'SORTIE'
  montant: number
  motif: string
  modePaiement?: string
  utilisateurId: number
  entiteId: number
}, tx?: any) {
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: { referenceType: 'CAISSE', referenceId: data.caisseId }
  })

  const journal = await getOrCreateJournal('CA', 'Journal de Caisse', 'CAISSE', tx)
  const entiteId = data.entiteId
  
  const compteCaisse = await getOrCreateCompte(
    COMPTES_DEFAUT.CAISSE,
    'Caisse',
    '5',
    'ACTIF',
    tx
  )
  
  if (data.type === 'ENTREE') {
    // Entrée de caisse : Débit Caisse, Crédit Produits divers
    const compteProduits = await getOrCreateCompte(
      COMPTES_DEFAUT.PRODUITS_DIVERS,
      'Produits divers',
      '7',
      'PRODUITS',
      tx
    )
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      piece: null,
      libelle: `Entrée caisse: ${data.motif}`,
      compteId: compteCaisse.id,
      debit: data.montant,
      credit: 0,
      reference: `CAISSE-${data.caisseId}`,
      referenceType: 'CAISSE',
      referenceId: data.caisseId,
      utilisateurId: data.utilisateurId,
    }, tx)
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      piece: null,
      libelle: `Entrée caisse: ${data.motif}`,
      compteId: compteProduits.id,
      debit: 0,
      credit: data.montant,
      reference: `CAISSE-${data.caisseId}`,
      referenceType: 'CAISSE',
      referenceId: data.caisseId,
      utilisateurId: data.utilisateurId,
    }, tx)
  } else {
    // Sortie de caisse : Débit Charges diverses, Crédit Caisse
    const compteCharges = await getOrCreateCompte(
      COMPTES_DEFAUT.AUTRES_CHARGES,
      'Autres charges',
      '6',
      'CHARGES',
      tx
    )
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      piece: null,
      libelle: `Sortie caisse: ${data.motif}`,
      compteId: compteCharges.id,
      debit: data.montant,
      credit: 0,
      reference: `CAISSE-${data.caisseId}`,
      referenceType: 'CAISSE',
      referenceId: data.caisseId,
      utilisateurId: data.utilisateurId,
    }, tx)
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      entiteId,
      piece: null,
      libelle: `Sortie caisse: ${data.motif}`,
      compteId: compteCaisse.id,
      debit: 0,
      credit: data.montant,
      reference: `CAISSE-${data.caisseId}`,
      referenceType: 'CAISSE',
      referenceId: data.caisseId,
      utilisateurId: data.utilisateurId,
    }, tx)
  }
}

/**
 * Comptabilise une opération bancaire
 */
export async function comptabiliserOperationBancaire(data: {
  operationId: number
  banqueId: number
  date: Date
  type: string
  montant: number
  libelle: string
  compteId: number | null
  utilisateurId: number
  entiteId: number
}, tx?: any) {
  const entiteId = data.entiteId
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: { referenceType: 'BANQUE', referenceId: data.operationId }
  })

  // Journal Banque
  const journal = await getOrCreateJournal('BA', 'Journal de Banque', 'BANQUE', tx)
  
  // Compte bancaire (utiliser le compte lié ou le compte par défaut)
  let compteBanque
  if (data.compteId) {
    compteBanque = await prisma.planCompte.findUnique({ where: { id: data.compteId } })
  }
  if (!compteBanque) {
    compteBanque = await getOrCreateCompte(
      COMPTES_DEFAUT.BANQUE,
      'Banque',
      '5',
      'ACTIF',
      tx
    )
  }
  
  const isEntree = data.type === 'DEPOT' || data.type === 'VIREMENT_ENTRANT' || data.type === 'INTERETS'
  
  if (isEntree) {
    // Entrée bancaire : Débit Banque, Crédit selon le type
    let compteCredit
    if (data.type === 'DEPOT') {
      // Dépôt : généralement depuis Caisse ou Produits divers
      compteCredit = await getOrCreateCompte(
        COMPTES_DEFAUT.PRODUITS_DIVERS,
        'Produits divers',
        '7',
        'PRODUITS',
        tx
      )
    } else if (data.type === 'VIREMENT_ENTRANT') {
      // Virement entrant : depuis un autre compte bancaire ou tiers
      compteCredit = await getOrCreateCompte(
        '411', // Clients ou autre compte selon le contexte
        'Clients',
        '4',
        'PASSIF',
        tx
      )
    } else if (data.type === 'INTERETS') {
      // Intérêts : Produits financiers
      compteCredit = await getOrCreateCompte(
        '758',
        'Produits divers',
        '7',
        'PRODUITS',
        tx
      )
    } else {
      compteCredit = await getOrCreateCompte(
        COMPTES_DEFAUT.PRODUITS_DIVERS,
        'Produits divers',
        '7',
        'PRODUITS',
        tx
      )
    }
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      entiteId,
      piece: null,
      libelle: data.libelle,
      compteId: compteBanque.id,
      debit: data.montant,
      credit: 0,
      reference: `BANQUE-${data.operationId}`,
      referenceType: 'BANQUE',
      referenceId: data.operationId,
      utilisateurId: data.utilisateurId,
    }, tx)
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      entiteId,
      piece: null,
      libelle: data.libelle,
      compteId: compteCredit.id,
      debit: 0,
      credit: data.montant,
      reference: `BANQUE-${data.operationId}`,
      referenceType: 'BANQUE',
      referenceId: data.operationId,
      utilisateurId: data.utilisateurId,
    }, tx)
  } else {
    // Sortie bancaire : Débit selon le type, Crédit Banque
    let compteDebit
    if (data.type === 'RETRAIT') {
      // Retrait : généralement vers Caisse
      compteDebit = await getOrCreateCompte(
        COMPTES_DEFAUT.CAISSE,
        'Caisse',
        '5',
        'ACTIF',
        tx
      )
    } else if (data.type === 'VIREMENT_SORTANT') {
      // Virement sortant : vers un autre compte bancaire ou tiers
      compteDebit = await getOrCreateCompte(
        '401', // Fournisseurs ou autre compte selon le contexte
        'Fournisseurs',
        '4',
        'PASSIF',
        tx
      )
    } else if (data.type === 'FRAIS') {
      // Frais bancaires : Charges financières
      compteDebit = await getOrCreateCompte(
        '658',
        'Autres charges',
        '6',
        'CHARGES',
        tx
      )
    } else {
      compteDebit = await getOrCreateCompte(
        COMPTES_DEFAUT.AUTRES_CHARGES,
        'Autres charges',
        '6',
        'CHARGES',
        tx
      )
    }
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      entiteId,
      piece: null,
      libelle: data.libelle,
      compteId: compteDebit.id,
      debit: data.montant,
      credit: 0,
      reference: `BANQUE-${data.operationId}`,
      referenceType: 'BANQUE',
      referenceId: data.operationId,
      utilisateurId: data.utilisateurId,
    }, tx)
    
    await createEcriture({
      date: data.date,
      journalId: journal.id,
      entiteId,
      piece: null,
      libelle: data.libelle,
      compteId: compteBanque.id,
      debit: 0,
      credit: data.montant,
      reference: `BANQUE-${data.operationId}`,
      referenceType: 'BANQUE',
      referenceId: data.operationId,
      utilisateurId: data.utilisateurId,
    }, tx)
  }
}

/**
 * Comptabilise un transfert entre magasins (OD : Stock 31 Débit/Crédit)
 */
export async function comptabiliserTransfert(data: {
  transfertId: number
  numero: string
  date: Date
  magasinOrigineNom: string
  magasinDestNom: string
  montantTotal: number
  utilisateurId: number
}, tx?: any) {
  if (data.montantTotal <= 0) return
  const p = tx || prisma

  // NETTOYAGE PRÉALABLE (IDEMPOTENCE STRICTE)
  await p.ecritureComptable.deleteMany({
    where: { referenceType: 'TRANSFERT', referenceId: data.transfertId }
  })

  const journal = await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD', tx)
  const compteStock = await getOrCreateCompte(
    COMPTES_DEFAUT.STOCK_MARCHANDISES,
    'Stock de marchandises',
    '3',
    'ACTIF',
    tx
  )
  const libelle = `Transfert ${data.numero} ${data.magasinOrigineNom} → ${data.magasinDestNom}`
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    piece: data.numero,
    libelle,
    compteId: compteStock.id,
    debit: data.montantTotal,
    credit: 0,
    reference: data.numero,
    referenceType: 'TRANSFERT',
    referenceId: data.transfertId,
    utilisateurId: data.utilisateurId,
  }, tx)
  await createEcriture({
    date: data.date,
    journalId: journal.id,
    piece: data.numero,
    libelle,
    compteId: compteStock.id,
    debit: 0,
    credit: data.montantTotal,
    reference: data.numero,
    referenceType: 'TRANSFERT',
    referenceId: data.transfertId,
    utilisateurId: data.utilisateurId,
  }, tx)
}

/**
 * Initialise le plan de comptes et les journaux par défaut
 */
export async function initialiserComptabilite() {
  // Créer les journaux par défaut
  await getOrCreateJournal('VE', 'Journal des Ventes', 'VENTES')
  await getOrCreateJournal('AC', 'Journal des Achats', 'ACHATS')
  await getOrCreateJournal('CA', 'Journal de Caisse', 'CAISSE')
  await getOrCreateJournal('BA', 'Journal de Banque', 'BANQUE')
  await getOrCreateJournal('OD', 'Journal des Opérations Diverses', 'OD')
  
  // Créer les comptes principaux
  await getOrCreateCompte('101', 'Capital', '1', 'PASSIF')
  await getOrCreateCompte('311', 'Stock de marchandises', '3', 'ACTIF')
  await getOrCreateCompte('401', 'Fournisseurs', '4', 'PASSIF')
  await getOrCreateCompte('411', 'Clients', '4', 'ACTIF')
  await getOrCreateCompte('521', 'Banque', '5', 'ACTIF')
  await getOrCreateCompte('531', 'Caisse', '5', 'ACTIF')
  await getOrCreateCompte('601', 'Achats de marchandises', '6', 'CHARGES')
  await getOrCreateCompte('603', 'Variation de stocks', '6', 'CHARGES')
  await getOrCreateCompte('443', 'État, TVA collectée', '4', 'PASSIF')
  await getOrCreateCompte('445', 'État, TVA récupérable', '4', 'ACTIF')
  await getOrCreateCompte('701', 'Ventes de marchandises', '7', 'PRODUITS')
  await getOrCreateCompte('703', 'Ventes de produits finis', '7', 'PRODUITS')
}
