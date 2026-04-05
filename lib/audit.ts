/**
 * Système d'audit et de traçabilité pour GestiCom
 * Enregistre toutes les actions importantes des utilisateurs
 */

import { prisma } from './db'
import type { Session } from './auth'

export type ActionType = 
  | 'CONNEXION'
  | 'DECONNEXION'
  | 'CREATION'
  | 'MODIFICATION'
  | 'SUPPRESSION'
  | 'LECTURE'
  | 'EXPORT'
  | 'IMPORT'
  | 'VALIDATION'
  | 'ANNULATION'

export type EntityType =
  | 'UTILISATEUR'
  | 'PRODUIT'
  | 'STOCK'
  | 'VENTE'
  | 'ACHAT'
  | 'DEPENSE'
  | 'CHARGE'
  | 'CLIENT'
  | 'FOURNISSEUR'
  | 'MAGASIN'
  | 'ENTITE'
  | 'PARAMETRE'
  | 'SAUVEGARDE'
  | 'RESTAURATION'
  | 'BANQUE'
  | 'OPERATION_BANQUE'
  | 'CAISSE'
  | 'COMPTABILITE'
  | 'ECRITURE_COMPTABLE'
  | 'PLAN_COMPTE'
  | 'JOURNAL'
  | 'TRANSFERT'

export interface AuditLogData {
  utilisateurId: number
  action: ActionType
  type: EntityType
  entiteId?: number
  description: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Créer un log d'audit
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        utilisateurId: data.utilisateurId,
        action: data.action,
        type: data.type,
        entiteId: data.entiteId,
        description: data.description,
        details: data.details ? JSON.stringify(data.details) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
  } catch (error) {
    // Ne pas faire échouer l'opération principale si l'audit échoue
    console.error('Erreur lors de la création du log d\'audit:', error)
  }
}

/**
 * Logger une connexion
 */
export async function logConnexion(
  session: Session,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action: 'CONNEXION',
    type: 'UTILISATEUR',
    description: `Connexion de ${session.nom} (${session.login})`,
    ipAddress,
    userAgent,
  })
}

/**
 * Logger une déconnexion
 */
export async function logDeconnexion(
  session: Session,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action: 'DECONNEXION',
    type: 'UTILISATEUR',
    description: `Déconnexion de ${session.nom} (${session.login})`,
    ipAddress,
  })
}

/**
 * Logger une création
 */
export async function logCreation(
  session: Session,
  type: EntityType,
  entiteId: number,
  description: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action: 'CREATION',
    type,
    entiteId,
    description: `${session.nom} a créé : ${description}`,
    details,
    ipAddress,
  })
}

/**
 * Logger une modification
 */
export async function logModification(
  session: Session,
  type: EntityType,
  entiteId: number,
  description: string,
  anciennesValeurs?: Record<string, any>,
  nouvellesValeurs?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action: 'MODIFICATION',
    type,
    entiteId,
    description: `${session.nom} a modifié : ${description}`,
    details: {
      anciennesValeurs,
      nouvellesValeurs,
    },
    ipAddress,
  })
}

/**
 * Logger une suppression
 */
export async function logSuppression(
  session: Session,
  type: EntityType,
  entiteId: number,
  description: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action: 'SUPPRESSION',
    type,
    entiteId,
    description: `${session.nom} a supprimé : ${description}`,
    details,
    ipAddress,
  })
}

/**
 * Logger une action générique
 */
export async function logAction(
  session: Session,
  action: ActionType,
  type: EntityType,
  description: string,
  entiteId?: number,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await createAuditLog({
    utilisateurId: session.userId,
    action,
    type,
    entiteId,
    description: `${session.nom} : ${description}`,
    details,
    ipAddress,
  })
}

/**
 * Obtenir l'adresse IP depuis une requête Next.js
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  return undefined
}

/**
 * Obtenir le user agent depuis une requête Next.js
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
