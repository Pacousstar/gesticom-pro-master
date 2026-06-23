import { describe, it, expect } from 'vitest'
import { formatDevise, formatDeviseCourt, parseMontant, DEVISE } from '@/lib/formats/devise'

describe('devise constants', () => {
  it('DEVISE est FCFA', () => {
    expect(DEVISE).toBe('FCFA')
  })
})

describe('formatDevise', () => {
  it('formate un nombre en devise', () => {
    const result = formatDevise(1000)
    expect(result).toContain('FCFA')
    expect(result.replace(/\s/g, ' ')).toContain('1 000')
  })

  it('retourne 0 FCFA pour null', () => {
    expect(formatDevise(null)).toBe('0 FCFA')
  })

  it('retourne 0 FCFA pour undefined', () => {
    expect(formatDevise(undefined)).toBe('0 FCFA')
  })

  it('retourne 0 FCFA pour NaN', () => {
    expect(formatDevise(NaN)).toBe('0 FCFA')
  })

  it('formate avec séparateur de milliers', () => {
    const result = formatDevise(1500000)
    expect(result.replace(/\s/g, ' ')).toBe('1 500 000 FCFA')
  })
})

describe('formatDeviseCourt', () => {
  it('format K pour milliers', () => {
    expect(formatDeviseCourt(1500)).toBe('2K')
  })

  it('format M pour millions', () => {
    expect(formatDeviseCourt(2500000)).toBe('2.5M')
  })

  it('retourne le nombre en clair pour les petites valeurs', () => {
    expect(formatDeviseCourt(500)).toBe('500')
  })

  it('retourne 0 pour null', () => {
    expect(formatDeviseCourt(null)).toBe('0')
  })
})

describe('parseMontant', () => {
  it('parse un nombre', () => {
    expect(parseMontant(1000)).toBe(1000)
  })

  it('parse un string simple', () => {
    expect(parseMontant('1000')).toBe(1000)
  })

  it('gère la virgule décimale', () => {
    expect(parseMontant('1000,50')).toBe(1000.5)
  })

  it('enlève les espaces', () => {
    expect(parseMontant('1 000')).toBe(1000)
  })

  it('retourne 0 pour null', () => {
    expect(parseMontant(null)).toBe(0)
  })

  it('retourne 0 pour undefined', () => {
    expect(parseMontant(undefined)).toBe(0)
  })
})
