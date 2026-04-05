/**
 * Système de rôles et permissions pour GestiCom
 * 
 * Rôles définis :
 * - SUPER_ADMIN : Accès total, gestion des utilisateurs et paramètres
 * - ADMIN : Gestion opérationnelle, peut créer/modifier la plupart des données
 * - COMPTABLE : Accès comptable, consultation et validation des transactions
 * - GESTIONNAIRE : Gestion des stocks, ventes, achats
 * - MAGASINIER : Gestion des stocks uniquement
 * - ASSISTANTE : Saisie et consultation limitée
 */

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'COMPTABLE'
  | 'GESTIONNAIRE'
  | 'MAGASINIER'
  | 'ASSISTANTE'

export type Permission =
  // Dashboard
  | 'dashboard:view'

  // Rapports
  | 'rapports:view'
  | 'rapports:ventes'

  // Produits
  | 'produits:view'
  | 'produits:create'
  | 'produits:edit'
  | 'produits:delete'

  // Stocks
  | 'stocks:view'
  | 'stocks:entree'
  | 'stocks:sortie'
  | 'stocks:init'

  // Ventes
  | 'ventes:view'
  | 'ventes:create'
  | 'ventes:edit'
  | 'ventes:delete'
  | 'ventes:annuler'

  // Achats
  | 'achats:view'
  | 'achats:create'
  | 'achats:edit'
  | 'achats:delete'

  // Dépenses
  | 'depenses:view'
  | 'depenses:create'
  | 'depenses:edit'
  | 'depenses:delete'

  // Caisse
  | 'caisse:view'
  | 'caisse:create'
  | 'caisse:delete'

  // Banque
  | 'banque:view'
  | 'banque:create'
  | 'banque:delete'

  // Charges
  | 'charges:view'
  | 'charges:create'
  | 'charges:edit'
  | 'charges:delete'

  // Comptabilité
  | 'comptabilite:view'
  | 'comptabilite:rapports'
  | 'comptabilite:export'

  // Utilisateurs
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'

  // Paramètres
  | 'parametres:view'
  | 'parametres:edit'

  // Sauvegardes
  | 'sauvegardes:view'
  | 'sauvegardes:create'
  | 'sauvegardes:restore'
  | 'sauvegardes:delete'

  // Audit
  | 'audit:view'

  // Clients & Fournisseurs
  | 'clients:view'
  | 'clients:create'
  | 'clients:edit'
  | 'clients:delete'
  | 'fournisseurs:view'
  | 'fournisseurs:create'
  | 'fournisseurs:edit'
  | 'fournisseurs:delete'

/**
 * Définition des permissions par rôle
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    // Accès total
    'dashboard:view',
    'produits:view', 'produits:create', 'produits:edit', 'produits:delete',
    'stocks:view', 'stocks:entree', 'stocks:sortie', 'stocks:init',
    'ventes:view', 'ventes:create', 'ventes:edit', 'ventes:delete', 'ventes:annuler',
    'achats:view', 'achats:create', 'achats:edit', 'achats:delete',
    'depenses:view', 'depenses:create', 'depenses:edit', 'depenses:delete',
    'charges:view', 'charges:create', 'charges:edit', 'charges:delete',
    'caisse:view', 'caisse:create', 'caisse:delete',
    'banque:view', 'banque:create', 'banque:delete',
    'comptabilite:view', 'comptabilite:rapports', 'comptabilite:export',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'parametres:view', 'parametres:edit',
    'sauvegardes:view', 'sauvegardes:create', 'sauvegardes:restore', 'sauvegardes:delete',
    'audit:view',
    'rapports:view', 'rapports:ventes',
    'clients:view', 'clients:create', 'clients:edit', 'clients:delete',
    'fournisseurs:view', 'fournisseurs:create', 'fournisseurs:edit', 'fournisseurs:delete',
  ],

  ADMIN: [
    // Gestion opérationnelle complète
    'dashboard:view',
    'produits:view', 'produits:create', 'produits:edit',
    'stocks:view', 'stocks:entree', 'stocks:sortie', 'stocks:init',
    'ventes:view', 'ventes:create', 'ventes:edit', 'ventes:annuler',
    'achats:view', 'achats:create', 'achats:edit',
    'depenses:view', 'depenses:create', 'depenses:edit',
    'charges:view', 'charges:create', 'charges:edit',
    'comptabilite:view', 'comptabilite:rapports',
    'users:view', 'users:create', 'users:edit',
    'parametres:view', 'parametres:edit',
    'caisse:view', 'caisse:create',
    'sauvegardes:view', 'sauvegardes:create',
    'audit:view',
    'rapports:view', 'rapports:ventes',
    'clients:view', 'clients:create', 'clients:edit',
    'fournisseurs:view', 'fournisseurs:create', 'fournisseurs:edit',
  ],

  COMPTABLE: [
    // Accès comptable et consultation
    'dashboard:view',
    'produits:view',
    'stocks:view',
    'ventes:view',
    'achats:view',
    'depenses:view', 'depenses:create', 'depenses:edit',
    'charges:view', 'charges:create', 'charges:edit',
    'caisse:view',
    'comptabilite:view', 'comptabilite:rapports', 'comptabilite:export',
    'rapports:view', 'rapports:ventes',
    'clients:view', 'fournisseurs:view',
  ],

  GESTIONNAIRE: [
    // Gestion des opérations commerciales
    'dashboard:view',
    'produits:view', 'produits:create', 'produits:edit',
    'stocks:view', 'stocks:entree', 'stocks:sortie',
    'ventes:view', 'ventes:create', 'ventes:edit',
    'achats:view', 'achats:create', 'achats:edit',
    'depenses:view', 'depenses:create',
    'caisse:view', 'caisse:create',
    'charges:view', 'charges:create',
    'rapports:view',
    'clients:view', 'clients:create', 'clients:edit',
    'fournisseurs:view', 'fournisseurs:create', 'fournisseurs:edit',
  ],

  MAGASINIER: [
    // Gestion des stocks uniquement
    'dashboard:view',
    'produits:view',
    'stocks:view', 'stocks:entree', 'stocks:sortie',
    'ventes:view',
    'achats:view',
    'clients:view',
    'fournisseurs:view',
  ],

  ASSISTANTE: [
    // Saisie et consultation limitée
    'dashboard:view',
    'produits:view',
    'stocks:view',
    'ventes:view', 'ventes:create',
    'achats:view', 'achats:create',
    'caisse:view', 'caisse:create',
    'depenses:view', 'depenses:create',
    'clients:view', 'clients:create',
    'fournisseurs:view', 'fournisseurs:create',
  ],
}

/**
 * Vérifie si un rôle (ou une liste de permissions custom) a une permission donnée.
 * Si customPermissions est fourni et non vide, il remplace les permissions du rôle.
 */
export function hasPermission(role: Role, permission: Permission, customPermissions?: string[]): boolean {
  if (customPermissions !== undefined) {
    return customPermissions.includes(permission)
  }
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

/**
 * Vérifie si un rôle (ou une liste de permissions custom) a au moins une des permissions données.
 */
export function hasAnyPermission(role: Role, permissions: Permission[], customPermissions?: string[]): boolean {
  return permissions.some(perm => hasPermission(role, perm, customPermissions))
}

/**
 * Vérifie si un rôle (ou une liste de permissions custom) a toutes les permissions données.
 */
export function hasAllPermissions(role: Role, permissions: Permission[], customPermissions?: string[]): boolean {
  return permissions.every(perm => hasPermission(role, perm, customPermissions))
}

/**
 * Rôles pouvant accéder aux paramètres
 */
export const ROLES_ADMIN = ['SUPER_ADMIN', 'ADMIN'] as const

/**
 * Rôles pouvant accéder à la comptabilité
 */
export const ROLES_COMPTA = ['SUPER_ADMIN', 'COMPTABLE'] as const

/**
 * Rôles pouvant gérer les utilisateurs
 */
export const ROLES_USER_MANAGEMENT = ['SUPER_ADMIN', 'ADMIN'] as const

/**
 * Rôles pouvant gérer les sauvegardes
 */
export const ROLES_BACKUP = ['SUPER_ADMIN', 'ADMIN'] as const

/**
 * Description des rôles pour l'interface
 */
export const ROLE_DESCRIPTIONS: Record<Role, { label: string; description: string }> = {
  SUPER_ADMIN: {
    label: 'Super Administrateur',
    description: 'Accès total au système. Gestion des utilisateurs, paramètres et sauvegardes.',
  },
  ADMIN: {
    label: 'Administrateur',
    description: 'Gestion opérationnelle complète. Peut créer/modifier les données et gérer les utilisateurs.',
  },
  COMPTABLE: {
    label: 'Comptable',
    description: 'Accès comptable. Consultation et validation des transactions, rapports financiers.',
  },
  GESTIONNAIRE: {
    label: 'Gestionnaire',
    description: 'Gestion des opérations commerciales. Stocks, ventes, achats et dépenses.',
  },
  MAGASINIER: {
    label: 'Magasinier',
    description: 'Gestion des stocks uniquement. Entrées et sorties de stock.',
  },
  ASSISTANTE: {
    label: 'Assistante',
    description: 'Saisie et consultation limitée. Création de ventes, achats et dépenses.',
  },
}
