/**
 * Formatage des montants monétaires - UN SEUL ENDROIT POUR LA DEVISE
 */

// Devise standard - un seul endroit à modifier si changement futur
export const DEVISE = 'FCFA' as const
export const DEVISE_SYMBOLE = '' // Pas de symbole, on utilise le nom complet

/**
 * Format un nombre en devise GestiCom
 * @param value - Le montant à formater
 * @returns Chaîne formatée ex: "10 000FCFA"
 */
export function formatDevise(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return `0 ${DEVISE}`
  const formatted = Math.round(Number(value)).toLocaleString('fr-FR')
  return `${formatted} ${DEVISE}`
}

/**
 * Format court pour les espaces limités
 * @param value - Le montant à formater
 * @returns Chaîne formatée ex: "10K"
 */
export function formatDeviseCourt(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return '0'
  const v = Number(value)
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v.toLocaleString('fr-FR')
}

/**
 * Parse un string de montant (gère les formats variés)
 */
export function parseMontant(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Math.max(0, value)
  // Enlever les espaces, remplacer les virgules par des points si nécessaire
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.')
  return Math.max(0, parseFloat(cleaned) || 0)
}