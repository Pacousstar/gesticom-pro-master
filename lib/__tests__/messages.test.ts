import { describe, it, expect } from 'vitest'
import { MESSAGES } from '@/lib/messages'

describe('MESSAGES', () => {
  it('contient les messages de succès', () => {
    expect(MESSAGES.ENREGISTREMENT_SUCCES).toBe('Enregistrement effectué avec succès.')
    expect(MESSAGES.VENTE_ENREGISTREE).toBe('Vente enregistrée avec succès.')
    expect(MESSAGES.ACHAT_ENREGISTRE).toBe('Achat enregistré avec succès.')
  })

  it('contient les messages de modification', () => {
    expect(MESSAGES.MODIFICATION_SUCCES).toBe('Modification effectuée avec succès.')
    expect(MESSAGES.UTILISATEUR_MODIFIE).toBe('Utilisateur modifié avec succès.')
  })

  it('contient les messages de droits insuffisants', () => {
    expect(MESSAGES.DROITS_INSUFFISANTS).toBe('Droits insuffisants pour effectuer cette action.')
    expect(MESSAGES.RESERVE_SUPER_ADMIN).toBe('Cette action est réservée au Super Administrateur.')
  })

  it('tous les messages sont des chaînes non vides', () => {
    const entries = Object.entries(MESSAGES)
    expect(entries.length).toBeGreaterThan(10)
    for (const [, value] of entries) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})
