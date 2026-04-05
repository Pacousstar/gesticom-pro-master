/**
 * Helpers pour la validation côté client avec messages d'erreur explicites
 */

import { z } from 'zod'
import type { 
  produitSchema, 
  clientSchema, 
  fournisseurSchema, 
  magasinSchema,
  depenseSchema,
  chargeSchema,
  ecritureSchema,
  journalSchema 
} from './validations'

/**
 * Valide les données avec un schéma Zod et retourne un message d'erreur formaté
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  // Formater les erreurs de manière lisible
  const errors = result.error.issues
  if (errors.length === 1) {
    return { success: false, error: errors[0].message }
  }
  
  // Plusieurs erreurs : les lister
  const errorMessages = errors.map(e => {
    const path = e.path.length > 0 ? `${e.path.join('.')} : ` : ''
    return `${path}${e.message}`
  })
  
  return { 
    success: false, 
    error: errorMessages.join('\n') 
  }
}

/**
 * Messages d'erreur standardisés pour les opérations courantes
 */
export const ErrorMessages = {
  REQUIRED: (field: string) => `Le champ "${field}" est requis.`,
  INVALID: (field: string) => `Le champ "${field}" contient une valeur invalide.`,
  TOO_LONG: (field: string, max: number) => `Le champ "${field}" ne peut pas dépasser ${max} caractères.`,
  TOO_SHORT: (field: string, min: number) => `Le champ "${field}" doit contenir au moins ${min} caractères.`,
  POSITIVE: (field: string) => `Le champ "${field}" doit être un nombre positif.`,
  MIN_VALUE: (field: string, min: number) => `Le champ "${field}" doit être supérieur ou égal à ${min}.`,
  MAX_VALUE: (field: string, max: number) => `Le champ "${field}" doit être inférieur ou égal à ${max}.`,
  EMAIL_INVALID: 'L\'adresse email n\'est pas valide.',
  NETWORK_ERROR: 'Erreur de connexion. Vérifiez votre connexion internet.',
  SERVER_ERROR: 'Erreur serveur. Veuillez réessayer plus tard.',
  UNAUTHORIZED: 'Vous n\'êtes pas autorisé à effectuer cette action.',
  NOT_FOUND: (resource: string) => `${resource} introuvable.`,
  ALREADY_EXISTS: (resource: string) => `${resource} existe déjà.`,
  OPERATION_FAILED: (operation: string) => `Échec de l'opération : ${operation}.`,
  OPERATION_SUCCESS: (operation: string) => `${operation} effectué avec succès.`,
}

/**
 * Formate les erreurs API en messages utilisateur
 */
export function formatApiError(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }
  
  if (error instanceof Error) {
    // Erreurs réseau
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return ErrorMessages.NETWORK_ERROR
    }
    return error.message
  }
  
  if (error && typeof error === 'object' && 'error' in error) {
    return String(error.error)
  }
  
  return ErrorMessages.SERVER_ERROR
}
