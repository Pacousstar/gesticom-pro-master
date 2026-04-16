/**
 * Schémas Zod pour la validation des entrées API.
 * Limite les chaînes à une longueur raisonnable pour éviter les abus.
 */

import { z } from 'zod'

const MAX_STRING = 500
const MAX_TEXT = 2000
const MAX_LOGIN = 80

/** Connexion : login + mot de passe */
export const loginSchema = z.object({
  login: z.string().min(1, 'Identifiant requis.').max(MAX_LOGIN).trim(),
  motDePasse: z.string().min(1, 'Mot de passe requis.').transform((s) => s.trim()),
  redirect: z.string().max(200).optional(),
})

/** Restauration : nom de fichier de sauvegarde (sécurisé) */
export const restoreSchema = z.object({
  name: z
    .string()
    .min(1, 'Nom de sauvegarde requis.')
    .max(100)
    .refine(
      (n) => /^gesticom-backup-\d{4}-\d{2}-\d{2}-\d{6}\.db$/.test(n),
      'Nom de sauvegarde invalide.'
    ),
})

/** Paramètres entreprise (PATCH) — champs optionnels, tvaParDefaut peut être string ou number */
export const parametresPatchSchema = z.object({
  nomEntreprise: z.string().max(MAX_STRING).optional(),
  slogan: z.string().max(MAX_STRING).nullable().optional(),
  contact: z.string().max(MAX_STRING).optional(),
  email: z.string().email('Email invalide').max(MAX_STRING).nullable().optional().or(z.literal('')),
  siteWeb: z.string().url('URL invalide').max(MAX_STRING).nullable().optional().or(z.literal('')),
  localisation: z.string().max(MAX_STRING).optional(),
  numNCC: z.string().max(100).nullable().optional(),
  registreCommerce: z.string().max(100).nullable().optional(),
  devise: z.string().max(20).optional(),
  tvaParDefaut: z.coerce.number().min(0).max(100).optional(),
  typeCommerce: z.string().max(50).optional(),
  logo: z.string().nullable().optional(), // URL du logo (fichiers ou web)
  logoLocal: z.string().nullable().optional(), // Image en Base64 ou chemin local
  piedDePage: z.string().max(MAX_TEXT).nullable().optional(),
  mentionSpeciale: z.string().max(MAX_TEXT).nullable().optional(),

  // Envoi d'emails (SMTP)
  smtpHost: z.string().max(MAX_STRING).nullable().optional(),
  smtpPort: z.coerce.number().min(1).max(65535).nullable().optional(),
  smtpUser: z.string().max(MAX_STRING).nullable().optional(),
  smtpPass: z.string().max(MAX_STRING).nullable().optional(),

  // Sauvegardes
  backupAuto: z.boolean().optional(),
  backupFrequence: z.enum(['QUOTIDIEN', 'HEBDOMADAIRE', 'MENSUEL']).optional(),
  backupDestination: z.enum(['LOCAL', 'EMAIL', 'GDRIVE']).optional(),
  backupEmailDest: z.string().max(MAX_STRING).nullable().optional(),

  // Fidélisation
  fideliteActive: z.boolean().optional(),
  fideliteSeuilPoints: z.coerce.number().min(1).optional(),
  fideliteTauxRemise: z.coerce.number().min(0).max(100).optional(),
})

/** Produit : code, désignation, catégorie, prix */
export const produitSchema = z.object({
  code: z.string().min(1, 'Le code est requis.').max(50, 'Le code ne peut pas dépasser 50 caractères.').trim(),
  designation: z.string().min(1, 'La désignation est requise.').max(MAX_STRING, 'La désignation ne peut pas dépasser 500 caractères.').trim(),
  categorie: z.string().min(1, 'La catégorie est requise.').max(100).trim(),
  prixAchat: z.coerce.number().min(0, 'Le prix d\'achat doit être positif.').nullable().optional(),
  prixVente: z.coerce.number().min(0, 'Le prix de vente doit être positif.').nullable().optional(),
  seuilMin: z.coerce.number().int().min(0, 'Le seuil minimum doit être positif.').default(5),
})

/** Client : nom, téléphone, type, plafond crédit */
export const clientSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis.').max(MAX_STRING, 'Le nom ne peut pas dépasser 500 caractères.').trim(),
  telephone: z.string().max(20, 'Le téléphone ne peut pas dépasser 20 caractères.').trim().nullable().optional(),
  type: z.enum(['CASH', 'CREDIT'], { message: 'Le type doit être CASH ou CREDIT.' }),
  plafondCredit: z.coerce.number().min(0, 'Le plafond de crédit doit être positif.').nullable().optional(),
  ncc: z.string().max(50, 'Le NCC ne peut pas dépasser 50 caractères.').trim().nullable().optional(),
  localisation: z.string().max(MAX_STRING).trim().nullable().optional(),
  soldeInitial: z.coerce.number().min(0).default(0),
  avoirInitial: z.coerce.number().min(0).default(0),
  email: z.string().email('Email invalide.').max(100).trim().nullable().optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.type === 'CREDIT' && (!data.plafondCredit || data.plafondCredit <= 0)) {
      return false
    }
    return true
  },
  {
    message: 'Un plafond de crédit est requis pour les clients de type CREDIT.',
    path: ['plafondCredit'],
  }
)

/** Fournisseur : nom, téléphone, email, NCC */
export const fournisseurSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis.').max(MAX_STRING, 'Le nom ne peut pas dépasser 500 caractères.').trim(),
  telephone: z.string().max(20, 'Le téléphone ne peut pas dépasser 20 caractères.').trim().nullable().optional(),
  email: z.string().email('Email invalide.').max(100, 'L\'email ne peut pas dépasser 100 caractères.').trim().nullable().optional(),
  ncc: z.string().max(50, 'Le NCC ne peut pas dépasser 50 caractères.').trim().nullable().optional(),
  localisation: z.string().max(MAX_STRING).trim().nullable().optional(),
  numeroCamion: z.string().max(100).trim().nullable().optional(),
  soldeInitial: z.coerce.number().min(0).default(0),
  avoirInitial: z.coerce.number().min(0).default(0),
})

/** Magasin : code, nom, localisation */
export const magasinSchema = z.object({
  code: z.string().min(1, 'Le code est requis.').max(20, 'Le code ne peut pas dépasser 20 caractères.').trim().toUpperCase(),
  nom: z.string().min(1, 'Le nom est requis.').max(MAX_STRING, 'Le nom ne peut pas dépasser 500 caractères.').trim(),
  localisation: z.string().max(MAX_STRING, 'La localisation ne peut pas dépasser 500 caractères.').trim().optional(),
})

/** Dépense : libellé, montant, catégorie, mode paiement */
export const depenseSchema = z.object({
  date: z.string().min(1, 'La date est requise.'),
  magasinId: z.coerce.number().int().positive('Le magasin est requis.').nullable().optional(),
  categorie: z.string().min(1, 'La catégorie est requise.').max(100).trim(),
  libelle: z.string().min(1, 'Le libellé est requis.').max(MAX_STRING, 'Le libellé ne peut pas dépasser 500 caractères.').trim(),
  montant: z.coerce.number().positive('Le montant doit être supérieur à 0.'),
  montantPaye: z.coerce.number().min(0, 'Le montant payé doit être positif.').optional(),
  modePaiement: z.enum(['ESPECES', 'MOBILE_MONEY', 'CREDIT', 'VIREMENT', 'CHEQUE'], {
    message: 'Mode de paiement invalide.',
  }),
  banqueId: z.coerce.number().int().positive().nullable().optional(),
  pieceJustificative: z.string().max(MAX_STRING).trim().nullable().optional(),
  beneficiaire: z.string().max(MAX_STRING, 'Le bénéficiaire ne peut pas dépasser 500 caractères.').trim().nullable().optional(),
})

/** Vente : client, montant, remise, lignes de produits */
export const venteSchema = z.object({
  date: z.string().min(1, 'La date est requise.'),
  magasinId: z.coerce.number().int().positive('Le magasin est requis.').nullable().optional(),
  clientId: z.coerce.number().int().positive('Le client est requis.').nullable().optional(),
  clientLibre: z.string().max(MAX_STRING).nullable().optional(),
  montantTotal: z.coerce.number().min(0),
  remiseGlobale: z.coerce.number().min(0).optional().default(0),
  montantPaye: z.coerce.number().min(0).optional().default(0),
  modePaiement: z.enum(['ESPECES', 'MOBILE_MONEY', 'CREDIT']),
  observation: z.string().max(MAX_TEXT).nullable().optional(),
  lignes: z.array(
    z.object({
      produitId: z.coerce.number().int().positive('Le produit est requis.'),
      quantite: z.coerce.number().min(1, 'La quantité doit être au moins 1.'),
      prixUnitaire: z.coerce.number().min(0, 'Le prix unitaire doit être positif.'),
      tva: z.coerce.number().min(0).optional(),
      remise: z.coerce.number().min(0).optional(),
    })
  ).min(1, 'Au moins une ligne est requise.'),
})

/** Charge : rubrique, montant, type */
export const chargeSchema = z.object({
  date: z.string().min(1, 'La date est requise.'),
  magasinId: z.coerce.number().int().positive('Le magasin est requis.').nullable().optional(),
  type: z.enum(['FIXE', 'VARIABLE'], {
    message: 'Le type doit être FIXE ou VARIABLE.',
  }),
  rubrique: z.string().min(1, 'La rubrique est requise.').max(100, 'La rubrique ne peut pas dépasser 100 caractères.').trim(),
  montant: z.coerce.number().positive('Le montant doit être supérieur à 0.'),
  modePaiement: z.enum(['ESPECES', 'MOBILE_MONEY', 'VIREMENT', 'CHEQUE'], {
    message: 'Mode de paiement invalide.',
  }).default('ESPECES'),
  banqueId: z.coerce.number().int().positive().nullable().optional(),
  pieceJustificative: z.string().max(MAX_STRING).trim().nullable().optional(),
  beneficiaire: z.string().max(MAX_STRING).trim().nullable().optional(),
  observation: z.string().max(MAX_TEXT, 'L\'observation ne peut pas dépasser 2000 caractères.').trim().nullable().optional(),
})

/** Écriture comptable : date, journal, compte, débit/crédit */
export const ecritureSchema = z.object({
  date: z.string().min(1, 'La date est requise.'),
  journalId: z.coerce.number().int().positive('Le journal est requis.'),
  piece: z.string().max(50, 'La pièce ne peut pas dépasser 50 caractères.').trim().nullable().optional(),
  libelle: z.string().min(1, 'Le libellé est requis.').max(MAX_STRING, 'Le libellé ne peut pas dépasser 500 caractères.').trim(),
  compteId: z.coerce.number().int().positive('Le compte est requis.'),
  debit: z.coerce.number().min(0, 'Le débit doit être positif.').default(0),
  credit: z.coerce.number().min(0, 'Le crédit doit être positif.').default(0),
  reference: z.string().max(100, 'La référence ne peut pas dépasser 100 caractères.').trim().nullable().optional(),
  referenceType: z.string().max(50, 'Le type de référence ne peut pas dépasser 50 caractères.').trim().nullable().optional(),
  referenceId: z.coerce.number().int().positive().nullable().optional(),
}).refine(
  (data) => {
    // Au moins un débit ou crédit doit être > 0
    return data.debit > 0 || data.credit > 0
  },
  {
    message: 'Au moins un débit ou crédit doit être supérieur à 0.',
    path: ['debit'],
  }
).refine(
  (data) => {
    // Débit et crédit ne peuvent pas être tous les deux > 0
    return !(data.debit > 0 && data.credit > 0)
  },
  {
    message: 'Le débit et le crédit ne peuvent pas être tous les deux supérieurs à 0.',
    path: ['credit'],
  }
)

/** Journal comptable : code, libellé, type */
export const journalSchema = z.object({
  code: z.string().min(1, 'Le code est requis.').max(10, 'Le code ne peut pas dépasser 10 caractères.').trim().toUpperCase(),
  libelle: z.string().min(1, 'Le libellé est requis.').max(MAX_STRING, 'Le libellé ne peut pas dépasser 500 caractères.').trim(),
  type: z.enum(['ACHATS', 'VENTES', 'BANQUE', 'CAISSE', 'OD'], {
    message: 'Type de journal invalide.',
  }),
})

/** Type inféré pour le body login */
export type LoginBody = z.infer<typeof loginSchema>
export type RestoreBody = z.infer<typeof restoreSchema>
export type ParametresPatchBody = z.infer<typeof parametresPatchSchema>
export type ProduitBody = z.infer<typeof produitSchema>
export type ClientBody = z.infer<typeof clientSchema>
export type FournisseurBody = z.infer<typeof fournisseurSchema>
export type MagasinBody = z.infer<typeof magasinSchema>
export type DepenseBody = z.infer<typeof depenseSchema>
export type ChargeBody = z.infer<typeof chargeSchema>
export type EcritureBody = z.infer<typeof ecritureSchema>
export type JournalBody = z.infer<typeof journalSchema>