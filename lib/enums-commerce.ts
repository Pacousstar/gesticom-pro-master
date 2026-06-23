/**
 * Constantes et types pour le module COMMERCE.
 * Remplace les enums Prisma par des constantes TypeScript + validation Zod.
 * Avantage : aucune migration DB nécessaire, les données existantes restent compatibles.
 *
 * Valeurs alignées sur la production GestiCom Pro :
 *   Espèces, Mobile Money, Virement, Chèque, Crédit (Dette)
 */

// ─── MODES DE PAIEMENT ────────────────────────────────────────────────

export const MODES_PAIEMENT = [
  'ESPECES',
  'MOBILE_MONEY',
  'VIREMENT',
  'CHEQUE',
  'CREDIT',
  'MULTI',
] as const
export type ModePaiement = (typeof MODES_PAIEMENT)[number]

/** Variants historiques/alias acceptés à l'entrée (normalisés avant stockage) */
export const MODES_PAIEMENT_ALIAS: Record<string, ModePaiement> = {
  ESPECE: 'ESPECES',
  CASH: 'ESPECES',
  especes: 'ESPECES',
  'Mobile Money': 'MOBILE_MONEY',
  'mobile money': 'MOBILE_MONEY',
  'mobile_money': 'MOBILE_MONEY',
  Virement: 'VIREMENT',
  Cheque: 'CHEQUE',
  Credit: 'CREDIT',
  'Crédit': 'CREDIT',
  credit: 'CREDIT',
}

/** Normalise un mode de paiement saisi en valeur canonique */
export function normaliserModePaiement(v: string): ModePaiement | null {
  const upper = (v || '').toUpperCase().trim()
  if ((MODES_PAIEMENT as readonly string[]).includes(upper)) return upper as ModePaiement
  if (upper in MODES_PAIEMENT_ALIAS) return MODES_PAIEMENT_ALIAS[upper]
  if (v in MODES_PAIEMENT_ALIAS) return MODES_PAIEMENT_ALIAS[v]
  return null
}

/** Mode spécial pour les règlements multiples */
export const MODE_PAIEMENT_MULTI = 'MULTI' as const

// ─── STATUTS DE PAIEMENT ──────────────────────────────────────────────

export const STATUTS_PAIEMENT = ['PAYE', 'PARTIEL', 'CREDIT', 'REMBOURSE'] as const
export type StatutPaiement = (typeof STATUTS_PAIEMENT)[number]

export const STATUTS_PAIEMENT_ALIAS: Record<string, StatutPaiement> = {
  REGLÉ: 'PAYE',
  REGLE: 'PAYE',
  NON_SOLDER: 'CREDIT',
  'NON_SOLDÉ': 'CREDIT',
}

export function normaliserStatutPaiement(v: string): StatutPaiement | null {
  const upper = (v || '').toUpperCase().trim()
  if ((STATUTS_PAIEMENT as readonly string[]).includes(upper)) return upper as StatutPaiement
  if (upper in STATUTS_PAIEMENT_ALIAS) return STATUTS_PAIEMENT_ALIAS[upper]
  if (v in STATUTS_PAIEMENT_ALIAS) return STATUTS_PAIEMENT_ALIAS[v]
  return null
}

/** Calcule le statut de paiement à partir des montants */
export function calculerStatutPaiement(montantPaye: number, montantTotal: number): StatutPaiement {
  if (montantPaye <= 0 && montantTotal > 0) return 'REMBOURSE'
  if (montantPaye >= montantTotal) return 'PAYE'
  if (montantPaye > 0) return 'PARTIEL'
  return 'CREDIT'
}

const STATUT_LABELS: Record<StatutPaiement, string> = {
  PAYE: 'Payé',
  PARTIEL: 'Partiel',
  CREDIT: 'Crédit',
  REMBOURSE: 'Remboursé',
}

const STATUT_COLORS: Record<StatutPaiement, { bg: string; text: string; border: string }> = {
  PAYE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PARTIEL: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  CREDIT: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  REMBOURSE: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

export function getStatutPaiementLabel(statut: string): string {
  return STATUT_LABELS[statut as StatutPaiement] || statut
}

export function getStatutPaiementColors(statut: string) {
  return STATUT_COLORS[statut as StatutPaiement] || STATUT_COLORS.CREDIT
}

// ─── STATUTS D'OPÉRATION ──────────────────────────────────────────────

export const STATUTS_OPERATION = ['VALIDEE', 'ANNULEE'] as const
export type StatutOperation = (typeof STATUTS_OPERATION)[number]

export const STATUTS_OPERATION_ALIAS: Record<string, StatutOperation> = {
  VALIDE: 'VALIDEE',
  ANNULE: 'ANNULEE',
}

export function normaliserStatutOperation(v: string): StatutOperation | null {
  const upper = (v || '').toUpperCase().trim()
  if ((STATUTS_OPERATION as readonly string[]).includes(upper)) return upper as StatutOperation
  if (upper in STATUTS_OPERATION_ALIAS) return STATUTS_OPERATION_ALIAS[upper]
  if (v in STATUTS_OPERATION_ALIAS) return STATUTS_OPERATION_ALIAS[v]
  return null
}

/** Valeurs à utiliser dans les requêtes Prisma pour filtrer les opérations valides */
export const STATUTS_OPERATION_VALIDES: string[] = ['VALIDEE', 'VALIDE']

// ─── STATUTS DE RÈGLEMENT ─────────────────────────────────────────────

export const STATUTS_REGLEMENT = ['VALIDE', 'ANNULE'] as const
export type StatutReglement = (typeof STATUTS_REGLEMENT)[number]

// ─── TYPES DE MOUVEMENT ───────────────────────────────────────────────

export const TYPES_MOUVEMENT = ['ENTREE', 'SORTIE'] as const
export type TypeMouvement = (typeof TYPES_MOUVEMENT)[number]

// ─── TYPES D'OPÉRATION BANCAIRE ───────────────────────────────────────

export const TYPES_OPERATION_BANCAIRE = [
  'DEPOT',
  'RETRAIT',
  'VIREMENT_ENTRANT',
  'VIREMENT_SORTANT',
  'FRAIS',
  'INTERETS',
  'REGLEMENT_CLIENT',
  'REGLEMENT_FOURNISSEUR',
  'DEPENSE',
  'CHARGE',
  'VENTE',
  'ENTREE',
  'REVENU',
  'SOLDE_INITIAL',
  'REGLEMENT',
] as const
export type TypeOperationBancaire = (typeof TYPES_OPERATION_BANCAIRE)[number]

export function estTypeOperationBanqueEntree(type: string | null | undefined): boolean {
  const t = String(type || '').toUpperCase()
  return ['DEPOT', 'VIREMENT_ENTRANT', 'INTERETS', 'REGLEMENT_CLIENT', 'VENTE', 'ENTREE', 'REVENU'].includes(t)
}

export function estTypeOperationBanqueSortie(type: string | null | undefined): boolean {
  const t = String(type || '').toUpperCase()
  return ['RETRAIT', 'VIREMENT_SORTANT', 'FRAIS', 'REGLEMENT_FOURNISSEUR', 'DEPENSE', 'CHARGE'].includes(t)
}

// ─── TYPES DE CLIENT ──────────────────────────────────────────────────

export const TYPES_CLIENT = ['CASH', 'CREDIT'] as const
export type TypeClient = (typeof TYPES_CLIENT)[number]

// ─── TYPES DE CHARGE ──────────────────────────────────────────────────

export const TYPES_CHARGE = ['FIXE', 'VARIABLE'] as const
export type TypeCharge = (typeof TYPES_CHARGE)[number]

// ─── HELPERS ───────────────────────────────────────────────────────────

export function estModeEspeces(mode: string): boolean {
  const m = normaliserModePaiement(mode)
  return m === 'ESPECES'
}

// ─── MODES D'INSTALLATION ──────────────────────────────────────────────

export const MODES_INSTALLATION = [
  'MODE_1',
  'MODE_2',
  'MODE_3',
] as const
export type ModeInstallation = (typeof MODES_INSTALLATION)[number]

export const LABELS_MODE_INSTALLATION: Record<ModeInstallation, string> = {
  MODE_1: 'Poste unique (Local)',
  MODE_2: 'Réseau (Serveur interne)',
  MODE_3: 'Migration (MODE_1 → MODE_2)',
}

export function labelModeInstallation(mode: string): string {
  return LABELS_MODE_INSTALLATION[mode as ModeInstallation] || mode
}

export function estModeBanque(mode: string): boolean {
  const m = normaliserModePaiement(mode)
  return m === 'VIREMENT' || m === 'MOBILE_MONEY' || m === 'CHEQUE'
}

export function estModeCredit(mode: string): boolean {
  return normaliserModePaiement(mode) === 'CREDIT'
}