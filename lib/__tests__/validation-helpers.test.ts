import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { validateForm, validateApiRequest, formatApiError, ErrorMessages } from '../validation-helpers'

describe('validateForm', () => {
  const schema = z.object({ nom: z.string().min(1, 'Nom requis.'), age: z.coerce.number().min(0) })

  it('retourne success avec les donnees valides', () => {
    const r = validateForm(schema, { nom: 'Jean', age: 30 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.nom).toBe('Jean')
      expect(r.data.age).toBe(30)
    }
  })

  it('retourne error avec message unique', () => {
    const r = validateForm(schema, { nom: '', age: 30 })
    expect(r.success).toBe(false)
    if (!r.success) { expect(typeof r.error).toBe('string') }
  })

  it('retourne erreurs multiple separees par newline', () => {
    const r = validateForm(schema, { nom: '', age: -5 })
    expect(r.success).toBe(false)
    if (!r.success) { expect(r.error).toContain('Nom') }
  })
})

describe('validateApiRequest', () => {
  const schema = z.object({ nom: z.string().min(1) })

  it('retourne data si valide', () => {
    const r = validateApiRequest(schema, { nom: 'Test' })
    expect(r.success).toBe(true)
    if (r.success) { expect(r.data.nom).toBe('Test') }
  })

  it('retourne Response 400 si invalide', () => {
    const r = validateApiRequest(schema, { nom: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.response.status).toBe(400)
    }
  })

  it('retourne Response avec message derreur', async () => {
    const r = validateApiRequest(schema, {})
    expect(r.success).toBe(false)
    if (!r.success) {
      const body = await r.response.json()
      expect(body.error).toContain('Validation')
    }
  })
})

describe('formatApiError', () => {
  it('retourne une string telle quelle', () => {
    expect(formatApiError('Erreur simple')).toBe('Erreur simple')
  })

  it('formate une Error', () => {
    const e = new Error('Message derreur')
    expect(formatApiError(e)).toBe('Message derreur')
  })

  it('detecte les erreurs reseau', () => {
    const e = new Error('fetch failed')
    expect(formatApiError(e)).toBe(ErrorMessages.NETWORK_ERROR)
  })

  it('extrait error depuis un objet', () => {
    expect(formatApiError({ error: 'Erreur API' })).toBe('Erreur API')
  })

  it('fallback pour les cas inconnus', () => {
    expect(formatApiError(42)).toBe(ErrorMessages.SERVER_ERROR)
  })

  it('retourne null', () => {
    expect(formatApiError(null)).toBe(ErrorMessages.SERVER_ERROR)
  })
})

describe('ErrorMessages', () => {
  it('REQUIRED formate le champ', () => {
    expect(ErrorMessages.REQUIRED('nom')).toBe('Le champ "nom" est requis.')
  })
  it('NOT_FOUND formate la ressource', () => {
    expect(ErrorMessages.NOT_FOUND('Produit')).toBe('Produit introuvable.')
  })
  it('ALREADY_EXISTS formate la ressource', () => {
    expect(ErrorMessages.ALREADY_EXISTS('Client')).toBe('Client existe déjà.')
  })
})
