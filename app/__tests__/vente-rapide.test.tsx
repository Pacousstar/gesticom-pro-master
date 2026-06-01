import { describe, it, expect } from 'vitest'
import { pointsFideliteDepuisEncaissement } from '@/lib/calculs-commerciaux'
import { formatApiError } from '@/lib/validation-helpers'

describe('Points fidélité — Vente Rapide', () => {
  it('0 point pour un montant < 1000 FCFA', () => {
    expect(pointsFideliteDepuisEncaissement(0)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(500)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(999)).toBe(0)
  })

  it('1 point par tranche de 1000 FCFA', () => {
    expect(pointsFideliteDepuisEncaissement(1000)).toBe(1)
    expect(pointsFideliteDepuisEncaissement(2500)).toBe(2)
    expect(pointsFideliteDepuisEncaissement(10000)).toBe(10)
  })

  it('retourne 0 pour les montants négatifs', () => {
    expect(pointsFideliteDepuisEncaissement(-100)).toBe(0)
    expect(pointsFideliteDepuisEncaissement(-5000)).toBe(0)
  })
})

describe('formatApiError — messages utilisateur', () => {
  it('retourne la chaîne telle quelle', () => {
    expect(formatApiError('Erreur test')).toBe('Erreur test')
  })

  it('extrait error d\'un objet', () => {
    expect(formatApiError({ error: 'Erreur métier' })).toBe('Erreur métier')
  })

  it('retourne le message d\'une Error', () => {
    expect(formatApiError(new Error('Erreur JS'))).toBe('Erreur JS')
  })

  it('message générique pour les erreurs réseau', () => {
    const networkError = new Error('fetch failed: connection refused')
    expect(formatApiError(networkError)).toBe('Erreur de connexion. Vérifiez votre connexion internet.')
  })

  it('message générique pour les valeurs inconnues', () => {
    expect(formatApiError(null)).toBe('Erreur serveur. Veuillez réessayer plus tard.')
    expect(formatApiError(undefined)).toBe('Erreur serveur. Veuillez réessayer plus tard.')
    expect(formatApiError(42 as any)).toBe('Erreur serveur. Veuillez réessayer plus tard.')
  })
})
