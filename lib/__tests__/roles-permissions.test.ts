import { describe, it, expect } from 'vitest'
import { hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/roles-permissions'

describe('hasPermission', () => {
  it('SUPER_ADMIN a les permissions listées', () => {
    expect(hasPermission('SUPER_ADMIN', 'produits:create')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'ventes:delete')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'dashboard:view')).toBe(true)
  })

  it('ASSISTANTE ne peut pas créer de produits', () => {
    expect(hasPermission('ASSISTANTE', 'produits:create')).toBe(false)
  })

  it('MAGASINIER peut voir les stocks', () => {
    expect(hasPermission('MAGASINIER', 'stocks:view')).toBe(true)
  })

  it('MAGASINIER ne peut pas gérer les utilisateurs', () => {
    expect(hasPermission('MAGASINIER', 'users:create')).toBe(false)
  })
})

describe('hasAnyPermission', () => {
  it('retourne true si au moins une permission est accordée', () => {
    expect(hasAnyPermission('ADMIN', ['produits:view', 'stocks:entree'])).toBe(true)
  })

  it('retourne false si aucune permission accordée', () => {
    expect(hasAnyPermission('MAGASINIER', ['ventes:create', 'achats:create'])).toBe(false)
  })
})

describe('hasAllPermissions', () => {
  it('retourne true si toutes les permissions sont accordées', () => {
    expect(hasAllPermissions('ADMIN', ['produits:view', 'produits:create'])).toBe(true)
  })

  it('retourne false si une permission manque', () => {
    expect(hasAllPermissions('MAGASINIER', ['stocks:view', 'ventes:create'])).toBe(false)
  })
})
